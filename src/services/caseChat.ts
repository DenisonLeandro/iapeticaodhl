// =============================================================================
// caseChat service — PR-3
// Chat de análise e estratégia por processo (RAG).
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
}

export async function listCaseChatMessages(caseId: string): Promise<CaseChatMessage[]> {
  const { data, error } = await supabase
    .from("case_chat_messages")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CaseChatMessage[];
}

export async function sendCaseChatMessage(
  caseId: string,
  message: string,
): Promise<SendCaseChatResponse> {
  const { data, error } = await supabase.functions.invoke("case-chat", {
    body: { caseId, message },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia do chat");
  if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as SendCaseChatResponse;
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
