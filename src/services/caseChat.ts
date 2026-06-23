// =============================================================================
// caseChat service — PR-3 + PR-3.5
// Chat de análise e estratégia por processo (RAG, streaming, feedback).
// =============================================================================

import { supabase } from "@/lib/backend/client";
import { ccdLog } from "@/lib/debug/caseChatDebug";

export type CaseChatRole = "user" | "assistant" | "system";

export type CaseChatMessageKind =
  | "general"
  | "thesis"
  | "strategy"
  | "risk"
  | "missing_document"
  | "lawyer_note"
  | "citation";

export interface CaseChatCitation {
  idx: number;
  chunk_id: string;
  file_id: string;
  file_name: string;
  classification: string | null;
  page_from: number | null;
  page_to: number | null;
  similarity: number;
}

export interface CaseChatMessage {
  id: string;
  case_id: string;
  organization_id: string;
  role: CaseChatRole;
  content: string;
  message_kind: CaseChatMessageKind;
  is_pinned: boolean;
  metadata: {
    citations?: CaseChatCitation[];
    tokens?: { input: number; output: number };
    model?: string;
    embedding_model?: string;
    embedding_version?: string;
    chunks_retrieved?: number;
    chunks_retrieved_raw?: number;
    response_time_ms?: number;
    estimated_cost_usd?: number;
    [k: string]: unknown;
  } | null;
  created_by: string | null;
  created_at: string;
}

export interface SendCaseChatResponse {
  assistantMessageId: string;
  created_at: string;
  content: string;
  citations: CaseChatCitation[];
  tokens: { input: number; output: number };
  response_time_ms?: number;
  estimated_cost_usd?: number;
}

export type CaseChatStreamEvent =
  | { type: "meta"; citations: CaseChatCitation[] }
  | { type: "delta"; text: string }
  | { type: "done" } & Partial<SendCaseChatResponse>
  | { type: "error"; error: string };

export async function listCaseChatMessages(caseId: string): Promise<CaseChatMessage[]> {
  const { data, error } = await supabase
    .from("case_chat_messages")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CaseChatMessage[];
}

/** Streaming via fetch direto à edge function (supabase.functions.invoke não suporta SSE). */
export async function streamCaseChatMessage(
  caseId: string,
  message: string,
  handlers: {
    onMeta?: (citations: CaseChatCitation[]) => void;
    onDelta?: (text: string) => void;
    onDone?: (resp: SendCaseChatResponse) => void;
    onError?: (err: string) => void;
  },
): Promise<SendCaseChatResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/case-chat`;
  ccdLog("service", "POST_start", { caseId, message_len: message.length });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ caseId, message }),
  });

  ccdLog("service", "POST_response", { status: res.status, ok: res.ok, hasBody: !!res.body });

  if (!res.ok || !res.body) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      errMsg = j?.error ?? errMsg;
    } catch { /* ignore */ }
    ccdLog("service", "POST_error_body", { errMsg });
    throw new Error(errMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResp: SendCaseChatResponse | null = null;
  let streamError: string | null = null;
  let chunkCount = 0;
  let deltaCount = 0;
  let metaCount = 0;
  let firstChunkLogged = false;

  const processLine = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    let evt: CaseChatStreamEvent;
    try {
      evt = JSON.parse(line) as CaseChatStreamEvent;
    } catch (err) {
      // Linha malformada / ruído de keep-alive: ignora sem matar o stream
      ccdLog("service", "ndjson_parse_skip", { len: line.length });
      console.debug("[caseChat] linha NDJSON ignorada:", line.slice(0, 120), err);
      return;
    }
    if (evt.type === "meta") {
      metaCount++;
      ccdLog("service", "evt_meta", { citations_count: evt.citations?.length ?? 0 });
      handlers.onMeta?.(evt.citations);
    } else if (evt.type === "delta") {
      deltaCount++;
      if (deltaCount === 1) ccdLog("service", "evt_delta_first", { len: evt.text.length });
      handlers.onDelta?.(evt.text);
    } else if (evt.type === "done") {
      finalResp = {
        assistantMessageId: (evt as { assistantMessageId: string }).assistantMessageId,
        created_at: (evt as { created_at: string }).created_at,
        content: (evt as { content: string }).content ?? "",
        citations: (evt as { citations: CaseChatCitation[] }).citations ?? [],
        tokens: (evt as { tokens: { input: number; output: number } }).tokens ?? { input: 0, output: 0 },
        response_time_ms: (evt as { response_time_ms?: number }).response_time_ms,
        estimated_cost_usd: (evt as { estimated_cost_usd?: number }).estimated_cost_usd,
      };
      ccdLog("service", "evt_done", {
        assistantMessageId: finalResp.assistantMessageId,
        content_len: finalResp.content.length,
        citations_count: finalResp.citations.length,
      });
      handlers.onDone?.(finalResp);
    } else if (evt.type === "error") {
      streamError = evt.error || "Erro no streaming";
      ccdLog("service", "evt_error", { streamError });
      handlers.onError?.(streamError);
      // não lança: deixa o loop terminar e decide no final
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunkCount++;
    if (!firstChunkLogged) {
      ccdLog("service", "first_chunk", { bytes: value?.byteLength ?? 0 });
      firstChunkLogged = true;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) processLine(raw);
  }

  ccdLog("service", "stream_end", {
    chunkCount, deltaCount, metaCount,
    residual_buffer_len: buffer.trim().length,
    finalResp_set: !!finalResp,
    streamError,
  });

  // Drena buffer residual (último evento pode não ter terminado com \n)
  if (buffer.trim()) {
    processLine(buffer);
    buffer = "";
  }

  if (finalResp) return finalResp;
  if (streamError) throw new Error(streamError);
  throw new Error("Stream finalizou sem evento 'done'.");
}


export async function setCaseChatMessagePin(
  messageId: string,
  isPinned: boolean,
  kind?: CaseChatMessageKind,
): Promise<void> {
  const update = kind
    ? { is_pinned: isPinned, message_kind: kind }
    : { is_pinned: isPinned };
  const { error } = await supabase
    .from("case_chat_messages")
    .update(update)
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

export async function fetchChunkContent(chunkId: string): Promise<{
  content: string;
  page_from: number | null;
  page_to: number | null;
} | null> {
  const { data, error } = await supabase
    .from("document_chunks")
    .select("content, page_from, page_to")
    .eq("id", chunkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { content: string; page_from: number | null; page_to: number | null } | null) ?? null;
}

// ----- Feedback -----

export type CaseChatFeedbackValue = "useful" | "not_useful";

export interface CaseChatFeedback {
  id: string;
  message_id: string;
  case_id: string;
  organization_id: string;
  feedback: CaseChatFeedbackValue;
  comment: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCaseChatFeedback(caseId: string): Promise<CaseChatFeedback[]> {
  const { data, error } = await supabase
    .from("case_chat_feedback")
    .select("*")
    .eq("case_id", caseId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CaseChatFeedback[];
}

export async function upsertCaseChatFeedback(params: {
  messageId: string;
  caseId: string;
  organizationId: string;
  feedback: CaseChatFeedbackValue;
  comment?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sessão expirada.");
  const { error } = await supabase
    .from("case_chat_feedback")
    .upsert(
      {
        message_id: params.messageId,
        case_id: params.caseId,
        organization_id: params.organizationId,
        feedback: params.feedback,
        comment: params.comment ?? null,
        created_by: userId,
      },
      { onConflict: "message_id,created_by" },
    );
  if (error) throw new Error(error.message);
}
