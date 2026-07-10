// =============================================================================
// Edge Function: document-chat
// Fase D — Chat IA contextual sobre uma petição
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/usage-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  documentId: string;
  message: string;
}

interface SuggestedPatch {
  type: "insert" | "replace" | "delete" | "none";
  target_section?: string;
  content?: string;
  explanation?: string;
}

interface ChatReply {
  message: string;
  suggested_patch: SuggestedPatch;
}

const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro que ajuda advogados a revisar e melhorar uma petição já gerada. Sua tarefa é responder dúvidas, sugerir melhorias, propor inclusões/exclusões e ajustar trechos da peça.

REGRAS OBRIGATÓRIAS:
1. NÃO invente fatos, datas, nomes, valores ou números de processo.
2. NÃO invente jurisprudência. Só cite precedentes se eles tiverem sido fornecidos no contexto (seção "JURISPRUDÊNCIA REAL"). Se não houver, não cite — fundamente apenas com lei e doutrina.
3. NÃO crie documentos ou provas que não estejam no contexto.
4. RESPEITE A PARTE REPRESENTADA pelo escritório — argumente sempre a favor dela.
5. Diferencie claramente FATOS ALEGADOS, FATOS PROVADOS (com base nas análises de PDFs fornecidas) e DECISÕES.
6. Se o pedido do advogado contrariar os documentos analisados, ALERTE antes de sugerir.
7. Se o pedido for ambíguo, peça esclarecimento em vez de chutar.
8. NUNCA altere a petição automaticamente — apenas sugira; o advogado decide se aplica.

FORMATO DA RESPOSTA — você DEVE responder SEMPRE em JSON válido, exatamente neste formato:
{
  "message": "explicação em português (markdown permitido) do que você está sugerindo ou respondendo",
  "suggested_patch": {
    "type": "insert" | "replace" | "delete" | "none",
    "target_section": "nome do título/tópico alvo (opcional, use exatamente como aparece na petição)",
    "content": "texto HTML do trecho sugerido (use <p>, <h2>, <strong>, <ul>; opcional para delete)",
    "explanation": "frase curta para o histórico de versões"
  }
}

Quando NÃO houver alteração concreta sugerida (ex.: o advogado só perguntou algo), use "type": "none" e omita os campos opcionais.

Use "insert" para acrescentar um trecho novo (será adicionado ao final da petição se não houver target_section).
Use "replace" para substituir um tópico inteiro (target_section deve coincidir com um título existente).
Use "delete" para remover um tópico inteiro (target_section obrigatório).
NUNCA devolva texto fora do JSON.`;

async function callLovableAI(messages: Array<{ role: string; content: string }>): Promise<{
  raw: string;
  usage: { input: number; output: number };
}> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("429: limite de requisições — tente em alguns instantes.");
  if (res.status === 402) throw new Error("402: créditos esgotados na Lovable AI — adicione créditos em Settings → Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lovable AI error (${res.status}): ${t}`);
  }
  const data = await res.json();
  return {
    raw: data.choices?.[0]?.message?.content ?? "",
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  };
}

function parseReply(raw: string): ChatReply {
  // Tenta JSON puro; se vier com cercas ```json, limpa.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  try {
    const parsed = JSON.parse(s);
    return {
      message: String(parsed.message ?? "").trim(),
      suggested_patch: {
        type: (parsed.suggested_patch?.type ?? "none") as SuggestedPatch["type"],
        target_section: parsed.suggested_patch?.target_section,
        content: parsed.suggested_patch?.content,
        explanation: parsed.suggested_patch?.explanation,
      },
    };
  } catch {
    return { message: raw, suggested_patch: { type: "none" } };
  }
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as ReqBody;
    if (!body.documentId || !body.message?.trim()) {
      return new Response(JSON.stringify({ error: "documentId e message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Carrega documento (RLS garante org)
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, organization_id, type, title, content, client_id, case_id, represented_party, source_file_ids")
      .eq("id", body.documentId)
      .maybeSingle();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Cliente, processo, arquivos vinculados
    const [clientRes, caseRes, filesRes, histRes] = await Promise.all([
      doc.client_id
        ? supabase.from("clients").select("full_name, document_type, document_number").eq("id", doc.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      doc.case_id
        ? supabase.from("cases").select("case_number, court, branch, subject, opposing_party").eq("id", doc.case_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (doc.source_file_ids && doc.source_file_ids.length > 0)
        ? supabase
            .from("client_files")
            .select("file_name, document_kind, analysis_summary")
            .in("id", doc.source_file_ids)
        : Promise.resolve({ data: [] }),
      supabase
        .from("document_chat_messages")
        .select("role, content")
        .eq("document_id", doc.id)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    const client = clientRes.data as { full_name?: string; document_number?: string } | null;
    const caseInfo = caseRes.data as { case_number?: string; court?: string; branch?: string; subject?: string; opposing_party?: string } | null;
    const files = (filesRes.data ?? []) as Array<{ file_name: string; document_kind: string | null; analysis_summary: string | null }>;
    const history = (histRes.data ?? []) as Array<{ role: string; content: string }>;

    // 3. Contexto seguro
    const contextLines: string[] = [];
    contextLines.push(`--- PETIÇÃO ATUAL (HTML) ---\n${truncate(doc.content, 15000)}\n--- FIM ---`);
    contextLines.push(`Tipo da peça: ${doc.type}`);
    if (doc.represented_party) contextLines.push(`Parte representada pelo escritório: ${doc.represented_party}`);
    if (client) contextLines.push(`Cliente: ${client.full_name ?? ""} (${client.document_number ?? "—"})`);
    if (caseInfo) {
      contextLines.push(`Processo: ${caseInfo.case_number ?? "—"} — ${caseInfo.court ?? ""} ${caseInfo.branch ?? ""}`);
      if (caseInfo.opposing_party) contextLines.push(`Parte contrária: ${caseInfo.opposing_party}`);
      if (caseInfo.subject) contextLines.push(`Assunto: ${caseInfo.subject}`);
    }
    if (files.length > 0) {
      contextLines.push(`\n--- ANÁLISES DE PDFs SELECIONADOS (use como FATOS PROVADOS) ---`);
      for (const f of files) {
        contextLines.push(`\n• ${f.file_name}${f.document_kind ? ` [${f.document_kind}]` : ""}\n${truncate(f.analysis_summary, 2000)}`);
      }
      contextLines.push(`--- FIM DAS ANÁLISES ---`);
    } else {
      contextLines.push(`\n(Sem PDFs analisados vinculados — não invente provas documentais.)`);
    }

    const systemContext = `${SYSTEM_PROMPT}\n\n--- CONTEXTO ---\n${contextLines.join("\n")}`;

    // 4. Mensagens do chat
    const messages = [
      { role: "system", content: systemContext },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: body.message },
    ];

    // 5. Persistir mensagem do user PRIMEIRO (mesmo que IA falhe)
    await supabase.from("document_chat_messages").insert({
      organization_id: doc.organization_id,
      document_id: doc.id,
      role: "user",
      content: body.message,
      created_by: userId,
    });

    // 6. Chamar IA
    let reply: ChatReply;
    let usage = { input: 0, output: 0 };
    try {
      const { raw, usage: u } = await callLovableAI(messages);
      usage = u;
      reply = parseReply(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: msg.startsWith("429") ? 429 : msg.startsWith("402") ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Persistir resposta
    const { data: insertedAsst } = await supabase
      .from("document_chat_messages")
      .insert({
        organization_id: doc.organization_id,
        document_id: doc.id,
        role: "assistant",
        content: reply.message,
        metadata: { suggested_patch: reply.suggested_patch, tokens: usage, model: MODEL },
        created_by: userId,
      })
      .select("id")
      .single();

    // 7.1 Telemetria best-effort — usa service role para bypass de RLS.
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const cost = (usage.input / 1_000_000) * 0.075 + (usage.output / 1_000_000) * 0.30;
      await logAiUsage(admin, {
        organization_id: doc.organization_id,
        profile_id: userId,
        operation: "chat",
        provider: "lovable",
        model: MODEL,
        tokens_input: usage.input,
        tokens_output: usage.output,
        cost_estimated: cost,
        case_id: doc.case_id ?? null,
        client_id: doc.client_id ?? null,
        document_id: doc.id,
        prompt_summary: `doc_chat:${doc.id.slice(0, 8)}`,
        metadata: {
          edge_function: "document-chat",
          status: "success",
          patch_type: reply.suggested_patch?.type ?? "none",
        },
      });
    } catch (e) { console.error("document-chat:log_err", (e as Error).message); }

    return new Response(
      JSON.stringify({
        message: reply.message,
        suggested_patch: reply.suggested_patch,
        assistantMessageId: insertedAsst?.id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
