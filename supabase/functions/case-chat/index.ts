// =============================================================================
// Edge Function: case-chat (PR-3.5)
// Streaming + dedup + citações enriquecidas + telemetria + custo estimado.
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
const TOP_K_FINAL = 6;
const TOP_K_FETCH = 12; // busca mais para sobrar para a deduplicação
const HISTORY_RECENT_LIMIT = 6;
const HISTORY_PINNED_LIMIT = 6;
const CHUNK_MAX_CHARS = 1500;

// Preço estimado (USD por 1M tokens) — Gemini 2.5 Flash + Gemini embedding
const PRICE_CHAT_INPUT_PER_M = 0.075;
const PRICE_CHAT_OUTPUT_PER_M = 0.30;
const PRICE_EMBEDDING_PER_M = 0.15;

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro que apoia advogados na ANÁLISE e ESTRATÉGIA de um processo (auto processual). Você NÃO redige peças — apenas analisa, identifica riscos, aponta lacunas e sugere caminhos.

REGRAS OBRIGATÓRIAS DE CAUTELA JURÍDICA:
1. NUNCA invente fatos, datas, nomes, valores, números de processo, decisões ou jurisprudência.
2. SEPARE EXPLICITAMENTE em sua resposta:
   • "Fato dos autos" → algo extraído literalmente dos trechos recuperados (sempre com citação no formato [<Tipo do documento> · <arquivo> · pp. X–Y]).
   • "Inferência" → leitura/raciocínio jurídico seu sobre os fatos.
   • "Hipótese a confirmar" → algo que parece provável mas precisa ser conferido pelo advogado.
3. Toda afirmação factual deve vir acompanhada de citação [<Tipo> · <arquivo> · pp. X–Y]. Sem citação, marque como "Inferência" ou "Hipótese".
4. Se a pergunta não puder ser respondida com os trechos recuperados, diga claramente: "Não encontrei trechos nos autos que respondam isso" e sugira o que o advogado pode verificar.
5. NÃO ofereça redigir petições, recursos, contratos ou qualquer peça. Se o advogado pedir, oriente que essa função é feita em outro módulo do sistema.
6. Use português jurídico formal, objetivo, sem floreios.
7. Quando faltar documento relevante, marque como "Documento ausente sugerido" para o advogado.
8. Considere o histórico recente da conversa para resolver referências (ex.: "ele", "essa tese", "esse documento").

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

interface Chunk {
  id: string;
  file_id: string;
  page_from: number | null;
  page_to: number | null;
  content: string;
  similarity: number;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function normalizePrefix(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Dedup: remove prefixos repetidos (cabeçalhos/rodapés) e limita 2 por página/arquivo. */
function dedupChunks(chunks: Chunk[], limit: number): Chunk[] {
  const seenPrefix = new Set<string>();
  const perFilePage = new Map<string, number>();
  const out: Chunk[] = [];
  for (const c of chunks) {
    const p = normalizePrefix(c.content);
    if (p && seenPrefix.has(p)) continue;
    const key = `${c.file_id}:${c.page_from ?? "?"}`;
    const used = perFilePage.get(key) ?? 0;
    if (used >= 2) continue;
    seenPrefix.add(p);
    perFilePage.set(key, used + 1);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

async function callEmbedding(input: string, key: string): Promise<number[]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input, dimensions: EMBEDDING_DIMS }),
  });
  if (res.status === 429) throw new Error("429: limite de requisições — tente novamente em instantes.");
  if (res.status === 402) throw new Error("402: créditos esgotados na Lovable AI.");
  if (!res.ok) throw new Error(`embedding ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("embedding malformado");
  return vec;
}

function estimateCostUsd(inTok: number, outTok: number, embedTok: number): number {
  const c =
    (inTok / 1_000_000) * PRICE_CHAT_INPUT_PER_M +
    (outTok / 1_000_000) * PRICE_CHAT_OUTPUT_PER_M +
    (embedTok / 1_000_000) * PRICE_EMBEDDING_PER_M;
  return Math.round(c * 1_000_000) / 1_000_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const startedAt = Date.now();

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

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    // 1. Caso
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id, organization_id, case_number, court, branch, subject, opposing_party, status")
      .eq("id", body.caseId)
      .maybeSingle();
    if (caseErr || !caseRow) return json({ error: "Processo não encontrado" }, 404);

    // 2. Arquivos
    const { data: files } = await supabase
      .from("client_files")
      .select("id, file_name, classification, pipeline_stage")
      .eq("case_id", caseRow.id);
    const filesDone = (files ?? []).filter((f) => f.pipeline_stage === "done");
    if (filesDone.length === 0) {
      return json(
        { error: "Nenhum arquivo processado neste processo. Faça upload e aguarde o processamento antes de conversar." },
        409,
      );
    }

    // 3. Histórico
    const [{ data: recentHist }, { data: pinnedHist }] = await Promise.all([
      supabase
        .from("case_chat_messages")
        .select("id, role, content, is_pinned, created_at")
        .eq("case_id", caseRow.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_RECENT_LIMIT),
      supabase
        .from("case_chat_messages")
        .select("id, role, content, is_pinned, created_at")
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

    // 4. Embedding + busca semântica (com fetch extra para deduplicar)
    const embedStart = Date.now();
    const queryVec = await callEmbedding(body.message, key);
    const embedMs = Date.now() - embedStart;
    const embedTokensApprox = Math.ceil(body.message.length / 4);

    const { data: chunksRaw, error: rpcErr } = await supabase.rpc("match_case_chunks", {
      p_case_id: caseRow.id,
      p_query_embedding: queryVec,
      p_match_count: TOP_K_FETCH,
      p_embedding_version: EMBEDDING_VERSION,
    });
    if (rpcErr) throw new Error(`match_case_chunks: ${rpcErr.message}`);

    const chunksAll = (chunksRaw ?? []) as Chunk[];
    const chunksArr = dedupChunks(chunksAll, TOP_K_FINAL);

    // 5. Citações enriquecidas
    const fileMetaById = new Map<string, { file_name: string; classification: string | null }>(
      filesDone.map((f) => [
        f.id as string,
        { file_name: f.file_name as string, classification: (f.classification ?? null) as string | null },
      ]),
    );

    const citations = chunksArr.map((c, i) => {
      const meta = fileMetaById.get(c.file_id);
      return {
        idx: i + 1,
        chunk_id: c.id,
        file_id: c.file_id,
        file_name: meta?.file_name ?? "Arquivo",
        classification: meta?.classification ?? null,
        page_from: c.page_from,
        page_to: c.page_to,
        similarity: Number((c.similarity ?? 0).toFixed(4)),
      };
    });

    // 6. System prompt
    const fileSummary = filesDone
      .map((f) => `- ${f.file_name}${f.classification ? ` (${f.classification})` : ""}`)
      .join("\n");

    const contextBlock = chunksArr.length
      ? chunksArr
          .map((c, i) => {
            const meta = fileMetaById.get(c.file_id);
            const tipo = meta?.classification ? meta.classification : "Documento";
            const pages =
              c.page_from === c.page_to
                ? `p. ${c.page_from ?? "?"}`
                : `pp. ${c.page_from ?? "?"}–${c.page_to ?? "?"}`;
            return `[#${i + 1}] [${tipo} · ${meta?.file_name ?? "Arquivo"} · ${pages}] (sim=${(c.similarity ?? 0).toFixed(3)})\n${truncate(c.content, CHUNK_MAX_CHARS)}`;
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

Use APENAS os trechos acima como fonte de fatos dos autos. Cite no formato [<Tipo> · <arquivo> · pp. X–Y] sempre que afirmar algo factual.`;

    const messages: UIMessage[] = [
      { role: "system", content: systemContext },
      ...historyMerged.map((m) => ({ role: m.role as UIMessage["role"], content: m.content })),
      { role: "user", content: body.message },
    ];

    // 7. Persiste mensagem do usuário
    const { error: userInsertErr } = await supabase.from("case_chat_messages").insert({
      organization_id: caseRow.organization_id,
      case_id: caseRow.id,
      role: "user",
      content: body.message,
      created_by: userId,
    });
    if (userInsertErr) throw new Error(`persist user: ${userInsertErr.message}`);

    // 8. Stream da IA (SSE -> NDJSON ao cliente)
    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: CHAT_MODEL, messages, stream: true }),
    });

    if (upstream.status === 429) return json({ error: "429: limite de requisições — tente novamente em instantes." }, 429);
    if (upstream.status === 402) return json({ error: "402: créditos esgotados na Lovable AI." }, 402);
    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => "");
      return json({ error: `chat ${upstream.status}: ${txt}` }, 500);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

        // Manda meta inicial (citations) já — UI pode renderizar antes do texto.
        send({ type: "meta", citations });

        let assistantText = "";
        let usageIn = 0;
        let usageOut = 0;
        let buffer = "";

        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line || !line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const obj = JSON.parse(payload);
                const delta = obj?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta.length) {
                  assistantText += delta;
                  send({ type: "delta", text: delta });
                }
                if (obj?.usage) {
                  usageIn = obj.usage.prompt_tokens ?? usageIn;
                  usageOut = obj.usage.completion_tokens ?? usageOut;
                }
              } catch {
                // ignora linha não-JSON
              }
            }
          }
        } catch (err) {
          send({ type: "error", error: err instanceof Error ? err.message : String(err) });
          controller.close();
          return;
        }

        const responseTimeMs = Date.now() - startedAt;
        // Fallback de tokens se gateway não enviar
        if (!usageIn) usageIn = Math.ceil(JSON.stringify(messages).length / 4);
        if (!usageOut) usageOut = Math.ceil(assistantText.length / 4);
        const estimatedCostUsd = estimateCostUsd(usageIn, usageOut, embedTokensApprox);

        const metadata = {
          citations,
          tokens: { input: usageIn, output: usageOut },
          model: CHAT_MODEL,
          embedding_model: EMBEDDING_MODEL,
          embedding_version: EMBEDDING_VERSION,
          top_k: TOP_K_FINAL,
          chunks_retrieved: chunksArr.length,
          chunks_retrieved_raw: chunksAll.length,
          response_time_ms: responseTimeMs,
          embedding_time_ms: embedMs,
          estimated_cost_usd: estimatedCostUsd,
        };

        // Persiste resposta
        const { data: inserted, error: asstErr } = await supabase
          .from("case_chat_messages")
          .insert({
            organization_id: caseRow.organization_id,
            case_id: caseRow.id,
            role: "assistant",
            content: assistantText || "(resposta vazia)",
            metadata,
            created_by: userId,
          })
          .select("id, created_at")
          .single();

        if (asstErr) {
          send({ type: "error", error: `persist assistant: ${asstErr.message}` });
        } else {
          send({
            type: "done",
            assistantMessageId: inserted.id,
            created_at: inserted.created_at,
            content: assistantText,
            citations,
            tokens: { input: usageIn, output: usageOut },
            response_time_ms: responseTimeMs,
            estimated_cost_usd: estimatedCostUsd,
          });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("case-chat:error", msg);
    return json({ error: msg }, 500);
  }
});
