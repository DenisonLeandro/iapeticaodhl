// =============================================================================
// PR-4.4A — analyze-legal-template
// Extrai texto do arquivo do modelo (.docx/.pdf/.txt), pede à IA a análise de
// estrutura/estilo/seções/padrões/riscos/diretrizes e persiste em
// public.legal_templates.
//
// IMPORTANTE (segurança):
//   - Nunca copiar dados pessoais/valores/fatos do arquivo para outros lugares.
//   - Nunca gravar o texto completo em telemetria.
//   - Multi-tenant estrito: usa organization_id do modelo, validado contra o
//     usuário chamador via profiles.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_EXTRACTED_CHARS = 120_000; // ~30k tokens, salva no banco
const MAX_PROMPT_CHARS = 60_000; // limite enviado ao modelo

const SYSTEM_PROMPT = `Você é um especialista em redação jurídica brasileira, analisando MODELOS de peças do escritório.
Seu trabalho é extrair APENAS características de ESTRUTURA, ESTILO, ORGANIZAÇÃO e PADRÕES de redação.
Você NUNCA extrai fatos, nomes, CPF/CNPJ, valores, endereços ou datas do documento — esses dados pertencem a outro caso e não podem ser reutilizados.
Retorne SEMPRE JSON válido no formato solicitado, em português do Brasil.`;

const OUTPUT_SCHEMA = `{
  "structure_summary": "string curta descrevendo a estrutura geral da peça",
  "style_summary": "string curta descrevendo o estilo de escrita",
  "standard_sections": ["seção 1", "seção 2", "..."],
  "topic_structure": [{"section": "nome", "purpose": "para que serve"}],
  "writing_patterns": {
    "opening_style": "string",
    "facts_style": "string",
    "legal_reasoning_style": "string",
    "requests_style": "string",
    "closing_style": "string"
  },
  "request_patterns": ["pedido genérico 1", "pedido genérico 2"],
  "risk_notes": ["cuidado 1", "cuidado 2"],
  "usage_guidelines": "orientação de como usar este modelo em novos casos, sem copiar dados"
}`;

// ------------------ Extração de texto ------------------

async function extractText(
  bytes: Uint8Array,
  mime: string | null,
  fileName: string,
): Promise<string> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const kind = mime ?? "";

  // TXT
  if (kind.startsWith("text/") || ext === "txt") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  // DOCX
  if (
    ext === "docx" ||
    kind ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import(
      "https://esm.sh/mammoth@1.7.2?target=deno&no-check"
    );
    const result = await mammoth.extractRawText({
      // deno-lint-ignore no-explicit-any
      arrayBuffer: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as any,
    });
    return String(result?.value ?? "");
  }

  // PDF
  if (ext === "pdf" || kind === "application/pdf") {
    const { extractText: pdfExtract, getDocumentProxy } = await import(
      "https://esm.sh/unpdf@0.12.1"
    );
    const doc = await getDocumentProxy(bytes);
    const { text } = await pdfExtract(doc, { mergePages: true });
    return typeof text === "string" ? text : (text as string[]).join("\n");
  }

  throw new Error(`unsupported_mime: ${mime ?? ext ?? "unknown"}`);
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* try fenced */
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ------------------ Handler ------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const startedAt = Date.now();
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return json({ error: "no_organization" }, 403);

  let body: { template_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const templateId = body.template_id;
  if (!templateId || typeof templateId !== "string") {
    return json({ error: "template_id_required" }, 400);
  }

  const { data: tpl, error: tplErr } = await admin
    .from("legal_templates")
    .select("id, organization_id, file_path, file_mime_type, file_name, name")
    .eq("id", templateId)
    .maybeSingle();
  if (tplErr || !tpl) return json({ error: "template_not_found" }, 404);
  if (tpl.organization_id !== profile.organization_id) {
    return json({ error: "forbidden" }, 403);
  }
  if (!tpl.file_path) {
    return json({ error: "no_file_uploaded" }, 400);
  }

  // Marca como processando
  await admin
    .from("legal_templates")
    .update({
      analysis_status: "processing",
      analysis_error: null,
    })
    .eq("id", tpl.id);

  const taskChoice = selectAIModelForTask("legal_template_analysis");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    await admin
      .from("legal_templates")
      .update({
        analysis_status: "error",
        analysis_error: "LOVABLE_API_KEY ausente",
      })
      .eq("id", tpl.id);
    return json({ error: "missing_api_key" }, 500);
  }

  try {
    // 1. Baixa arquivo
    const download = await admin.storage
      .from("legal-templates")
      .download(tpl.file_path);
    if (download.error || !download.data) {
      throw new Error(`download_failed: ${download.error?.message ?? "no data"}`);
    }
    const bytes = new Uint8Array(await download.data.arrayBuffer());

    // 2. Extrai texto
    let extracted = "";
    try {
      extracted = await extractText(bytes, tpl.file_mime_type, tpl.file_name ?? "");
    } catch (e) {
      throw new Error(`extract_failed: ${(e as Error).message}`);
    }
    extracted = extracted.replace(/\s+\n/g, "\n").trim();
    const wasTruncated = extracted.length > MAX_EXTRACTED_CHARS;
    if (wasTruncated) extracted = extracted.slice(0, MAX_EXTRACTED_CHARS);

    if (extracted.length < 200) {
      throw new Error(
        "extracted_too_short: texto insuficiente (talvez PDF escaneado; OCR fora do escopo deste PR)",
      );
    }

    // 3. Prepara prompt
    const promptText = extracted.slice(0, MAX_PROMPT_CHARS);
    const userPrompt = [
      `Nome do modelo (referência interna): ${tpl.name}`,
      "",
      "Analise APENAS estrutura, estilo, seções, padrões de redação, padrões de pedidos, riscos e diretrizes de uso.",
      "NÃO extraia nomes, CPF/CNPJ, valores monetários, datas específicas, endereços, nomes de partes ou fatos.",
      "NÃO reproduza trechos literais do documento em nenhum campo.",
      "",
      "Retorne EXCLUSIVAMENTE JSON no seguinte formato:",
      OUTPUT_SCHEMA,
      "",
      "TEXTO DO MODELO (pode estar truncado):",
      "---",
      promptText,
      "---",
    ].join("\n");

    // 4. Chama LLM
    const llmStart = Date.now();
    const llmRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: taskChoice.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );
    if (llmRes.status === 429) throw new Error("rate_limit");
    if (llmRes.status === 402) throw new Error("payment_required");
    if (!llmRes.ok) {
      throw new Error(`llm_${llmRes.status}: ${await llmRes.text()}`);
    }
    const llmData = await llmRes.json();
    const llmMs = Date.now() - llmStart;
    const rawText: string = llmData?.choices?.[0]?.message?.content ?? "";
    const inputTokens = llmData?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
    const outputTokens = llmData?.usage?.completion_tokens ?? Math.ceil(rawText.length / 4);

    const parsed = extractJson(rawText);
    if (!parsed) throw new Error("invalid_llm_json");

    // 5. Persiste
    const updatePayload = {
      extracted_text: extracted,
      structure_summary: String(parsed.structure_summary ?? "").slice(0, 4000) || null,
      style_summary: String(parsed.style_summary ?? "").slice(0, 4000) || null,
      standard_sections: Array.isArray(parsed.standard_sections)
        ? parsed.standard_sections
        : null,
      topic_structure: Array.isArray(parsed.topic_structure)
        ? parsed.topic_structure
        : null,
      writing_patterns:
        parsed.writing_patterns && typeof parsed.writing_patterns === "object"
          ? parsed.writing_patterns
          : null,
      request_patterns: Array.isArray(parsed.request_patterns)
        ? parsed.request_patterns
        : null,
      risk_notes: Array.isArray(parsed.risk_notes) ? parsed.risk_notes : null,
      usage_guidelines: String(parsed.usage_guidelines ?? "").slice(0, 4000) || null,
      analysis_status: "done",
      analysis_error: null,
      analysis_model: taskChoice.model,
      analyzed_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin
      .from("legal_templates")
      .update(updatePayload)
      .eq("id", tpl.id);
    if (upErr) throw new Error(`persist_failed: ${upErr.message}`);

    const totalMs = Date.now() - startedAt;

    // 6. Telemetria (sem texto)
    await logAiUsage(admin, {
      organization_id: profile.organization_id,
      profile_id: user.id,
      operation: "legal_template_analysis",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      cost_estimated: 0,
      processing_time_ms: totalMs,
      prompt_summary: summaryTag("chat", tpl.id).replace("chat", "tpl"),
      metadata: {
        template_id: tpl.id,
        file_mime_type: tpl.file_mime_type,
        extracted_chars: extracted.length,
        was_truncated: wasTruncated,
        llm_ms: llmMs,
      },
    });

    return json({ ok: true, template_id: tpl.id, truncated: wasTruncated });
  } catch (err) {
    const msg = (err as Error).message;
    console.error("analyze-legal-template:error", msg);
    await admin
      .from("legal_templates")
      .update({
        analysis_status: "error",
        analysis_error: msg.slice(0, 500),
      })
      .eq("id", tpl.id);
    return json({ error: msg }, 500);
  }
});
