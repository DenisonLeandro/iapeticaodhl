// =============================================================================
// documentChat service — Fase D
// =============================================================================

import { supabase } from "@/lib/backend/client";
import type { SuggestedPatch } from "@/lib/ai/patch-applier";

export interface ChatMessage {
  id: string;
  document_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface ChatReply {
  message: string;
  suggested_patch: SuggestedPatch;
  assistantMessageId: string | null;
}

export async function listChatMessages(documentId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("document_chat_messages")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(documentId: string, message: string): Promise<ChatReply> {
  const { data, error } = await supabase.functions.invoke("document-chat", {
    body: { documentId, message },
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia da IA");
  if ((data as { error?: string }).error) throw new Error((data as { error: string }).error);
  return data as ChatReply;
}

export async function markMessageApplied(messageId: string): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("document_chat_messages")
    .select("metadata")
    .eq("id", messageId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
  const next = { ...meta, applied: true, applied_at: new Date().toISOString() };
  const { error } = await supabase
    .from("document_chat_messages")
    .update({ metadata: next })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}
