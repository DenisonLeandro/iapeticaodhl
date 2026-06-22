// =============================================================================
// Edge Function: case-chat (PR-3)
// Chat de análise e estratégia por processo, RAG sobre document_embeddings.
// NÃO gera peças. Apenas analisa, sugere estratégia e cita arquivo/página.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHAT_MODEL = "google/gemini-2.5-flash";
const EMBEDDING_MODEL = "google/gemini-embedding-001";
const EMBEDDING_VERSION = "gemini-embedding-001@v1";
const EMBEDDING_DIMS = 1536;
const TOP_K_DEFAULT = 6;
const HISTORY_RECENT_LIMIT = 6;
const HISTORY_PINNED_LIMIT = 6;
const CHUNK_MAX_CHARS = 1500;

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro que apoia advogados na ANÁLISE e ESTRATÉGIA de um processo (auto processual). Você NÃO redige peças — apenas analisa, identifica riscos, aponta lacunas e sugere caminhos.

REGRAS OBRIGATÓRIAS DE CAUTELA JURÍDICA:
1. NUNCA invente fatos, datas, nomes, valores, números de processo, decisões ou jurisprudência.
2. SEPARE EXPLICITAMENTE em sua resposta:
   • "Fato dos autos" → algo extraído literalmente dos trechos recuperados (sempre com citação no formato [Arquivo: <nome> · pp. X–Y]).
   • "Inferência" → leitura/raciocínio jurídico seu sobre os fatos.
   • "Hipótese a confirmar" → algo que parece provável mas precisa ser conferido pelo advogado.
3. Toda afirmação factual deve vir acompanhada de citação [Arquivo: <nome> · pp. X–Y]. Sem citação, marque como "Inferência" ou "Hipótese".
4. Se a pergunta não puder ser respondida com os trechos recuperados, diga claramente: "Não encontrei trechos nos autos que respondam isso" e sugira o que o advogado pode verificar.
5. NÃO ofereça redigir petições, recursos, contratos ou qualquer peça. Se o advogado pedir, oriente que essa função é feita em outro módulo do sistema.
6. Use português jurídico formal, objetivo, sem floreios.
7. Quando faltar documento relevante, marque como "Documento ausente sugerido" para o advogado.

FORMATO DA RESPOSTA: texto em markdown, com seções curtas quando útil. Não retorne JSON. Não invente links.`;

interface UIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ReqBody {
  caseId: string;
  message: string;
  topK?: number;
}

async function callEmbedding(input: string, key: string): Promise<number[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      dimensions: EMBEDDING_DIMS,
    }),
  });
  if (res.status === 429) throw new Error("429: limite de requisições — tente novamente em instantes.");
  if (res.status === 402) throw new Error("402: créditos esgotados na Lovable AI.");
  if (!res.ok) throw new Error(`embedding ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("embedding malformado");
  return vec;
}

async function callChat(messages: UIMessage[], key: string): Promise<{ content: string; usage: { input: number; output: number } }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages }),
  });
  if (res.status === 429) throw new Error("429: limite de requisições — tente novamente em instantes.");
  if (res.status === 402) throw new Error("402: créditos esgotados na Lovable AI.");
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    usage: {
      input: data?.usage?.prompt_tokens ?? 0,
      output: data?.usage?.completion_tokens ?? 0,
    },
  };
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
    if (!body?.caseId || !body?.message?.trim()) {
      return json({ error: "caseId e message são obrigatórios" }, 400);
    }

    const topK = Math.min(Math.max(Number(body.topK) || TOP_K_DEFAULT, 3), 10);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    console.log("case-chat:start", { caseId: body.caseId, userId, topK });

    // 1. Caso (RLS por organização)
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id, organization_id, case_number, court, branch, subject, opposing_party, status")
      .eq("id", body.caseId)
      .maybeSingle();
    if (caseErr || !caseRow) return json({ error: "Processo não encontrado" }, 404);

    // 2. Arquivos do caso (para situar a IA sobre o que existe nos autos)
    const { data: files } = await supabase
      .from("client_files")
      .select("id, file_name, classification, pipeline_stage")
      .eq("case_id", caseRow.id);
    const filesDone = (files ?? []).filter((f) => f.pipeline_stage === "done");
    if (filesDone.length === 0) {
      return json({ error: "Nenhum arquivo processado neste processo. Faça upload e aguarde o processamento antes de conversar." }, 409);
    }

    // 3. Histórico: últimas N + fixadas
    const [{ data: recentHist }, { data: pinnedHist }] = await Promise.all([
      supabase
        .from("case_chat_messages")
        .select("id, role, content, is_pinned, message_kind, created_at")
        .eq("case_id", caseRow.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_RECENT_LIMIT),
      supabase
        .from("case_chat_messages")
        .select("id, role, content, is_pinned, message_kind, created_at")
        .eq("case_id", caseRow.id)
        .eq("is_pinned", true)
        .order("created_at", { ascending: false })
        .limit(HISTORY_PINNED_LIMIT),
    ]);

    const seen = new Set<string>();
    const historyMerged = [...(pinnedHist ?? []), ...(recentHist ?? [])]
      .filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 4. Embed da pergunta e busca semântica
    const queryVec = await callEmbedding(body.message, key);
    const { data: chunks, error: rpcErr } = await supabase.rpc("match_case_chunks", {
      p_case_id: caseRow.id,
      p_query_embedding: queryVec,
      p_match_count: topK,
      p_embedding_version: EMBEDDING_VERSION,
    });
    if (rpcErr) throw new Error(`match_case_chunks: ${rpcErr.message}`);

    const chunksArr = (chunks ?? []) as Array<{
      id: string;
      file_id: string;
      page_from: number | null;
      page_to: number | null;
      content: string;
      similarity: number;
    }>;

    console.log("case-chat:retrieved", { count: chunksArr.length });

    // 5. Mapeia nome do arquivo
    const fileNameById = new Map(filesDone.map((f) => [f.id, f.file_name]));
    const citations = chunksArr.map((c, i) => ({
      idx: i + 1,
      chunk_id: c.id,
      file_id: c.file_id,
      file_name: fileNameById.get(c.file_id) ?? "Arquivo",
      page_from: c.page_from,
      page_to: c.page_to,
      similarity: Number(c.similarity?.toFixed(4) ?? 0),
    }));

    // 6. Monta system com perfil do caso + arquivos disponíveis + trechos recuperados
    const fileSummary = filesDone
      .map((f) => `- ${f.file_name}${f.classification ? ` (${f.classification})` : ""}`)
      .join("\n");

    const contextBlock = chunksArr.length
      ? chunksArr
          .map((c, i) => {
            const name = fileNameById.get(c.file_id) ?? "Arquivo";
            const pages = c.page_from === c.page_to
              ? `p. ${c.page_from ?? "?"}`
              : `pp. ${c.page_from ?? "?"}–${c.page_to ?? "?"}`;
            return `[#${i + 1}] [Arquivo: ${name} · ${pages}] (sim=${c.similarity?.toFixed(3) ?? "?"})\n${truncate(c.content, CHUNK_MAX_CHARS)}`;
          })
          .join("\n\n")
      : "(Nenhum trecho recuperado para esta pergunta.)";

    const caseLine = [
      `Processo: ${caseRow.case_number ?? "—"}`,
      caseRow.court ? `Tribunal: ${caseRow.court}` : "",
      caseRow.branch ? `Vara: ${caseRow.branch}` : "",
      caseRow.subject ? `Assunto: ${caseRow.subject}` : "",
      caseRow.opposing_party ? `Parte contrária: ${caseRow.opposing_party}` : "",
      caseRow.status ? `Status: ${caseRow.status}` : "",
    ].filter(Boolean).join(" | ");

    const systemContext = `${SYSTEM_PROMPT}

--- PROCESSO ---
${caseLine}

--- ARQUIVOS PROCESSADOS NESTE PROCESSO ---
${fileSummary}

--- TRECHOS RECUPERADOS PARA ESTA PERGUNTA ---
${contextBlock}

Use APENAS os trechos acima como fonte de fatos dos autos. Cite no formato [Arquivo: <nome> · pp. X–Y] sempre que afirmar algo factual.`;

    const messages: UIMessage[] = [
      { role: "system", content: systemContext },
      ...historyMerged.map((m) => ({ role: m.role as UIMessage["role"], content: m.content })),
      { role: "user", content: body.message },
    ];

    // 7. Persiste mensagem do usuário primeiro
    const { error: userInsertErr } = await supabase.from("case_chat_messages").insert({
      organization_id: caseRow.organization_id,
      case_id: caseRow.id,
      role: "user",
      content: body.message,
      created_by: userId,
    });
    if (userInsertErr) throw new Error(`persist user: ${userInsertErr.message}`);

    // 8. Chama IA
    let assistantText = "";
    let usage = { input: 0, output: 0 };
    try {
      const r = await callChat(messages, key);
      assistantText = r.content?.trim() || "(resposta vazia)";
      usage = r.usage;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("case-chat:error", msg);
      const status = msg.startsWith("429") ? 429 : msg.startsWith("402") ? 402 : 500;
      return json({ error: msg }, status);
    }

    // 9. Persiste resposta com citações no metadata
    const { data: insertedAsst, error: asstErr } = await supabase
      .from("case_chat_messages")
      .insert({
        organization_id: caseRow.organization_id,
        case_id: caseRow.id,
        role: "assistant",
        content: assistantText,
        metadata: { citations, tokens: usage, model: CHAT_MODEL, embedding_model: EMBEDDING_MODEL, top_k: topK },
        created_by: userId,
      })
      .select("id, created_at")
      .single();
    if (asstErr) throw new Error(`persist assistant: ${asstErr.message}`);

    console.log("case-chat:persisted", { assistantMessageId: insertedAsst.id, tokens: usage });

    return json({
      assistantMessageId: insertedAsst.id,
      created_at: insertedAsst.created_at,
      content: assistantText,
      citations,
      tokens: usage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("case-chat:error", msg);
    return json({ error: msg }, 500);
  }
});
