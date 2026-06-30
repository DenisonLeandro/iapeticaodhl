// =============================================================================
// Edge Function: analyze-case (PR-4.1A)
// Gera análise inicial estruturada do caso, com prioridade:
//   1) RAG/embeddings (match_case_chunks) quando existem
//   2) chunks/texto extraído sem embeddings
//   3) ficha do cliente + interações + observações + lista de arquivos
// Salva em public.case_analyses com status running -> done|failed.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";
import { estimateCost } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMBEDDING_MODEL = "google/gemini-embedding-001";
const EMBEDDING_VERSION = "gemini-embedding-001@v1";
const EMBEDDING_DIMS = 1536;
const TOP_K_PER_QUERY = 6;
const MAX_CHUNK_CHARS = 1200;
const MAX_CONTEXT_CHARS = 28000;

const TOPIC_QUERIES = [
  "fatos relevantes do caso, partes envolvidas, datas, valores e pedidos",
  "pontos fortes, teses jurídicas favoráveis, jurisprudência aplicável e provas robustas",
  "riscos processuais, fragilidades, possíveis defesas da parte contrária e pontos sensíveis",
  "documentos juntados, provas existentes, exames, contratos, holerites, atestados, prints e laudos",
  "lacunas probatórias, documentos faltantes e diligências necessárias",
];

const STRUCTURE = `{
  "summary": "",
  "case_type": "",
  "represented_party": "",
  "facts": [],
  "strengths": [],
  "risks": [],
  "relevant_documents": [],
  "missing_documents": [],
  "legal_theories": [],
  "next_action": "",
  "recommended_piece": "",
  "confidence_level": "",
  "human_review_notes": []
}`;

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro que produz a ANÁLISE INICIAL de um caso para apoiar o advogado.

REGRAS:
- NÃO invente fatos, datas, nomes, valores, decisões ou jurisprudência. Use apenas o que está no contexto fornecido.
- Quando não houver informação suficiente, diga isso claramente no campo correspondente e em "human_review_notes".
- Não redija peças. Apenas analise e oriente.
- Use linguagem jurídica formal, objetiva, em português do Brasil.
- "confidence_level" deve ser "alto", "médio" ou "baixo" conforme a quantidade e qualidade de material disponível.
- "facts", "strengths", "risks", "relevant_documents", "missing_documents", "legal_theories" e "human_review_notes" devem ser arrays de STRINGS curtas e claras.
- "recommended_piece" deve sugerir a peça inicial provável quando aplicável (ex.: "Petição inicial trabalhista", "Contestação", "Recurso ordinário"), ou string vazia.

SAÍDA OBRIGATÓRIA: retorne APENAS um objeto JSON válido seguindo EXATAMENTE este formato (sem texto fora do JSON, sem markdown, sem comentários):
${STRUCTURE}`;

interface ReqBody {
  caseId: string;
  force?: boolean;
}

interface ChunkLite {
  file_id: string;
  page_from: number | null;
  page_to: number | null;
  content: string;
  similarity?: number;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function callEmbedding(input: string, key: string): Promise<number[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input, dimensions: EMBEDDING_DIMS }),
  });
  if (!res.ok) throw new Error(`embedding ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("embedding malformado");
  return vec;
}

function extractJson(text: string): unknown {
  const trimmed = (text || "").trim();
  // Tenta limpar cercas markdown
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAnalysis(raw: unknown): Record<string, unknown> {
  const obj = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) ?? {};
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()) : [];
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return {
    summary: str(obj.summary),
    case_type: str(obj.case_type),
    represented_party: str(obj.represented_party),
    facts: arr(obj.facts),
    strengths: arr(obj.strengths),
    risks: arr(obj.risks),
    relevant_documents: arr(obj.relevant_documents),
    missing_documents: arr(obj.missing_documents),
    legal_theories: arr(obj.legal_theories),
    next_action: str(obj.next_action),
    recommended_piece: str(obj.recommended_piece),
    confidence_level: str(obj.confidence_level).toLowerCase() || "baixo",
    human_review_notes: arr(obj.human_review_notes),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const startedAt = Date.now();
  let analysisId: string | null = null;
  let adminSupabase: ReturnType<typeof createClient> | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as ReqBody;
    if (!body?.caseId) return json({ error: "caseId é obrigatório" }, 400);
    const force = body.force === true;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Caso + cliente
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select(
        "id, organization_id, client_id, case_number, court, branch, subject, opposing_party, status, represented_party",
      )
      .eq("id", body.caseId)
      .maybeSingle();
    if (caseErr || !caseRow) return json({ error: "Caso não encontrado" }, 404);

    // 1.1 Evitar duplicidade: análise em execução
    const { data: runningExisting } = await adminSupabase
      .from("case_analyses")
      .select("id")
      .eq("case_id", caseRow.id)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1);
    if (runningExisting && runningExisting.length > 0) {
      const { data: existing } = await adminSupabase
        .from("case_analyses")
        .select("*")
        .eq("id", runningExisting[0].id)
        .maybeSingle();
      return json({ analysis: existing, reused: true, reason: "running" });
    }

    // 1.2 Se !force e já existe done -> retorna a mais recente
    if (!force) {
      const { data: doneExisting } = await adminSupabase
        .from("case_analyses")
        .select("*")
        .eq("case_id", caseRow.id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (doneExisting) {
        return json({ analysis: doneExisting, reused: true, reason: "exists" });
      }
    }

    // 2. Cria linha running
    const taskChoice = selectAIModelForTask("analyze_case");
    const { data: createdRow, error: createErr } = await adminSupabase
      .from("case_analyses")
      .insert({
        organization_id: caseRow.organization_id,
        case_id: caseRow.id,
        client_id: caseRow.client_id ?? null,
        analysis_type: "initial",
        status: "running",
        model_task: "analyze_case",
        model_used: taskChoice.model,
        provider: taskChoice.provider,
        created_by: userId,
        content_json: {},
        metadata: { started_at: new Date().toISOString() },
      })
      .select("*")
      .single();
    if (createErr || !createdRow) throw new Error(`create_analysis: ${createErr?.message ?? "unknown"}`);
    analysisId = createdRow.id as string;

    // 3. Cliente + interações + arquivos + ficha inteligente
    const [clientResp, interactionsResp, filesResp, intakeResp] = await Promise.all([
      caseRow.client_id
        ? supabase
            .from("clients")
            .select("id, full_name, document_type, document_number, notes")
            .eq("id", caseRow.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as unknown as { data: null; error: null }),
      caseRow.client_id
        ? supabase
            .from("client_interactions")
            .select("interaction_date, subject, notes")
            .eq("client_id", caseRow.client_id)
            .order("interaction_date", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null } as unknown as { data: unknown[]; error: null }),
      supabase
        .from("client_files")
        .select(
          "id, file_name, classification, document_kind, pipeline_stage, extracted_text, page_count, parent_file_id",
        )
        .eq("case_id", caseRow.id),
      supabase
        .from("case_intake_forms")
        .select("*")
        .eq("case_id", caseRow.id)
        .maybeSingle(),
    ]);
    const intake = (intakeResp as { data: Record<string, unknown> | null }).data;


    const client = (clientResp as { data: Record<string, unknown> | null }).data;
    const interactions = ((interactionsResp as { data: unknown[] }).data ?? []) as Array<{
      interaction_date: string;
      subject: string;
      notes: string | null;
    }>;
    const allFiles = (filesResp.data ?? []) as Array<{
      id: string;
      file_name: string;
      classification: string | null;
      document_kind: string | null;
      pipeline_stage: string | null;
      extracted_text: string | null;
      page_count: number | null;
      parent_file_id: string | null;
    }>;

    // Consideramos apenas arquivos "principais" (sem parent), para evitar duplicidade
    // com partes lógicas. Os chunks já são por parte e referem-se a esses parent_ids.
    const topFiles = allFiles.filter((f) => !f.parent_file_id);
    const filesDone = topFiles.filter((f) => f.pipeline_stage === "done");

    // 4. Contexto via prioridades
    let strategy: "rag" | "chunks" | "extracted_text" | "metadata_only" = "metadata_only";
    let contextBlocks: string[] = [];
    let sources: Array<Record<string, unknown>> = [];
    let embedTokensApprox = 0;

    // Tenta RAG quando há filesDone
    if (filesDone.length > 0) {
      try {
        const fileMeta = new Map(filesDone.map((f) => [f.id, f]));
        const collected: Array<ChunkLite & { topic: string }> = [];
        for (const q of TOPIC_QUERIES) {
          embedTokensApprox += Math.ceil(q.length / 4);
          const vec = await callEmbedding(q, key);
          const { data: rows, error: rpcErr } = await supabase.rpc("match_case_chunks", {
            p_case_id: caseRow.id,
            p_query_embedding: vec,
            p_match_count: TOP_K_PER_QUERY,
            p_embedding_version: EMBEDDING_VERSION,
          });
          if (rpcErr) throw new Error(`match_case_chunks: ${rpcErr.message}`);
          for (const r of (rows ?? []) as ChunkLite[]) {
            collected.push({ ...r, topic: q.slice(0, 40) });
          }
        }
        // Dedup por chunk id-ish: usar file_id+page+prefix
        const seen = new Set<string>();
        const picked: typeof collected = [];
        for (const c of collected.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))) {
          const key2 = `${c.file_id}:${c.page_from ?? "?"}:${(c.content || "").slice(0, 60)}`;
          if (seen.has(key2)) continue;
          seen.add(key2);
          picked.push(c);
        }
        if (picked.length > 0) {
          strategy = "rag";
          let total = 0;
          for (const c of picked) {
            const meta = fileMeta.get(c.file_id);
            const head = `[${meta?.classification ?? meta?.document_kind ?? "Documento"} · ${meta?.file_name ?? "arquivo"} · pp. ${c.page_from ?? "?"}–${c.page_to ?? "?"}]`;
            const block = `${head}\n${truncate(c.content, MAX_CHUNK_CHARS)}`;
            if (total + block.length > MAX_CONTEXT_CHARS) break;
            contextBlocks.push(block);
            total += block.length;
            sources.push({
              file_id: c.file_id,
              file_name: meta?.file_name ?? null,
              page_from: c.page_from,
              page_to: c.page_to,
              document_type: meta?.classification ?? meta?.document_kind ?? null,
              similarity: c.similarity ?? null,
            });
          }
        }
      } catch (e) {
        console.error("analyze-case:rag_error", (e as Error).message);
        // segue para próxima prioridade
      }
    }

    // Prioridade 2: texto extraído sem embeddings (quando RAG não trouxe nada)
    if (strategy === "metadata_only" && topFiles.some((f) => (f.extracted_text ?? "").length > 0)) {
      strategy = "extracted_text";
      let total = 0;
      for (const f of topFiles) {
        const txt = (f.extracted_text ?? "").trim();
        if (!txt) continue;
        const head = `[${f.classification ?? f.document_kind ?? "Documento"} · ${f.file_name}]`;
        const block = `${head}\n${truncate(txt, MAX_CHUNK_CHARS * 2)}`;
        if (total + block.length > MAX_CONTEXT_CHARS) break;
        contextBlocks.push(block);
        total += block.length;
        sources.push({
          file_id: f.id,
          file_name: f.file_name,
          document_type: f.classification ?? f.document_kind ?? null,
        });
      }
    }

    // Prioridade 3: apenas metadados (lista de arquivos)
    const filesListText =
      topFiles.length === 0
        ? "(nenhum arquivo enviado)"
        : topFiles
            .map(
              (f) =>
                `- ${f.file_name}${f.classification ? ` [${f.classification}]` : ""} (status: ${f.pipeline_stage ?? "?"})`,
            )
            .join("\n");

    const interactionsText =
      interactions.length === 0
        ? "(sem interações registradas)"
        : interactions
            .map(
              (i) =>
                `- ${new Date(i.interaction_date).toLocaleDateString("pt-BR")} — ${i.subject}${i.notes ? `: ${truncate(i.notes, 400)}` : ""}`,
            )
            .join("\n");

    const clientBlock = client
      ? `Cliente: ${client.full_name}${client.document_type ? ` (${String(client.document_type).toUpperCase()}: ${client.document_number ?? "—"})` : ""}\nObservações: ${truncate((client.notes as string) ?? "—", 1200)}`
      : "Cliente: (não vinculado)";

    const caseBlock = [
      `Número do processo: ${caseRow.case_number?.trim() || "(não cadastrado / caso novo)"}`,
      `Tribunal: ${caseRow.court ?? "—"}`,
      `Vara: ${caseRow.branch ?? "—"}`,
      `Assunto: ${caseRow.subject ?? "—"}`,
      `Parte representada: ${caseRow.represented_party ?? "—"}`,
      `Parte contrária: ${caseRow.opposing_party ?? "—"}`,
      `Status: ${caseRow.status ?? "—"}`,
    ].join("\n");

    const limitationNote =
      strategy === "metadata_only"
        ? "ATENÇÃO: ainda não há texto extraído suficiente dos documentos. Esta análise é PRELIMINAR e deve ser baseada apenas em ficha, relato e lista de arquivos."
        : strategy === "extracted_text"
          ? "OBSERVAÇÃO: os documentos têm texto extraído mas ainda não há embeddings; a análise usa trechos diretos."
          : "";

    const documentsContext =
      contextBlocks.length > 0
        ? `TRECHOS DOS DOCUMENTOS:\n\n${contextBlocks.join("\n\n---\n\n")}`
        : "TRECHOS DOS DOCUMENTOS: (indisponíveis)";

    const userPrompt = [
      "Produza a análise inicial estruturada do caso a seguir.",
      "",
      "DADOS DO CASO:",
      caseBlock,
      "",
      clientBlock,
      "",
      "INTERAÇÕES COM O CLIENTE:",
      interactionsText,
      "",
      "ARQUIVOS DO CASO:",
      filesListText,
      "",
      documentsContext,
      "",
      limitationNote,
      "",
      `Retorne APENAS o JSON no formato exigido. Estrutura: ${STRUCTURE}`,
    ]
      .filter(Boolean)
      .join("\n");

    // 5. Chama o modelo
    const llmStart = Date.now();
    const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: taskChoice.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (llmRes.status === 429) throw new Error("rate_limit: tente novamente em instantes");
    if (llmRes.status === 402) throw new Error("payment_required: créditos esgotados");
    if (!llmRes.ok) throw new Error(`llm ${llmRes.status}: ${await llmRes.text()}`);

    const llmData = await llmRes.json();
    const llmMs = Date.now() - llmStart;
    const rawText: string = llmData?.choices?.[0]?.message?.content ?? "";
    const inputTokens = llmData?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
    const outputTokens = llmData?.usage?.completion_tokens ?? Math.ceil(rawText.length / 4);

    const parsed = extractJson(rawText);
    const normalized = normalizeAnalysis(parsed);
    const parseOk = parsed !== null;

    const cost = estimateCost(taskChoice.model, inputTokens, outputTokens);
    const totalMs = Date.now() - startedAt;

    // 6. Persiste resultado
    const finalMetadata = {
      strategy,
      sources,
      counts: {
        files_total: topFiles.length,
        files_done: filesDone.length,
        chunks_used: contextBlocks.length,
        interactions: interactions.length,
      },
      tokens: { input: inputTokens, output: outputTokens, embedding_approx: embedTokensApprox },
      timings_ms: { llm: llmMs, total: totalMs },
      cost_usd: cost,
      parse_ok: parseOk,
      limitation: strategy === "metadata_only",
    };

    const finalStatus = parseOk ? "done" : "failed";
    const { data: updated, error: updErr } = await adminSupabase
      .from("case_analyses")
      .update({
        status: finalStatus,
        content_json: normalized,
        summary: truncate(normalized.summary as string, 800),
        metadata: finalMetadata,
      })
      .eq("id", analysisId)
      .select("*")
      .single();
    if (updErr) throw new Error(`update_analysis: ${updErr.message}`);

    // 7. Telemetria
    await logAiUsage(adminSupabase, {
      organization_id: caseRow.organization_id,
      profile_id: userId,
      operation: "case_analysis",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      cost_estimated: cost,
      processing_time_ms: totalMs,
      case_id: caseRow.id,
      client_id: caseRow.client_id ?? null,
      prompt_summary: summaryTag("case_analysis", analysisId),
      metadata: {
        strategy,
        chunks_used: contextBlocks.length,
        files_done: filesDone.length,
        parse_ok: parseOk,
      },
    });

    return json({ analysis: updated, reused: false });
  } catch (e) {
    const msg = (e as Error).message || "erro desconhecido";
    console.error("analyze-case:error", msg);
    if (analysisId && adminSupabase) {
      try {
        await adminSupabase
          .from("case_analyses")
          .update({
            status: "failed",
            metadata: { error: msg.slice(0, 500), failed_at: new Date().toISOString() },
          })
          .eq("id", analysisId);
      } catch (e2) {
        console.error("analyze-case:fail_update", (e2 as Error).message);
      }
    }
    return json({ error: msg }, 500);
  }
});
