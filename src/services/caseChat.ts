// =============================================================================
// caseChat service — PR-3 + PR-3.5
// Chat de análise e estratégia por processo (RAG, streaming, feedback).
// =============================================================================

import { supabase } from "@/lib/backend/client";

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
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ caseId, message }),
  });

  if (!res.ok || !res.body) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      errMsg = j?.error ?? errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResp: SendCaseChatResponse | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      try {
        const evt = JSON.parse(line) as CaseChatStreamEvent;
        if (evt.type === "meta") handlers.onMeta?.(evt.citations);
        else if (evt.type === "delta") handlers.onDelta?.(evt.text);
        else if (evt.type === "done") {
          finalResp = {
            assistantMessageId: (evt as { assistantMessageId: string }).assistantMessageId,
            created_at: (evt as { created_at: string }).created_at,
            content: (evt as { content: string }).content ?? "",
            citations: (evt as { citations: CaseChatCitation[] }).citations ?? [],
            tokens: (evt as { tokens: { input: number; output: number } }).tokens ?? { input: 0, output: 0 },
            response_time_ms: (evt as { response_time_ms?: number }).response_time_ms,
            estimated_cost_usd: (evt as { estimated_cost_usd?: number }).estimated_cost_usd,
          };
          handlers.onDone?.(finalResp);
        } else if (evt.type === "error") {
          handlers.onError?.(evt.error);
          throw new Error(evt.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
  }

  if (!finalResp) throw new Error("Stream finalizou sem evento 'done'.");
  return finalResp;
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
