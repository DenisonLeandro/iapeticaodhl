// =============================================================================
// useCaseChat — PR-3 + PR-3.5 (streaming + feedback)
// PR-4.0A Hotfix: finalResp recebido = resposta visível imediatamente.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import { ccdLog } from "@/lib/debug/caseChatDebug";
import {
  listCaseChatFeedback,
  listCaseChatMessages,
  setCaseChatMessagePin,
  streamCaseChatMessage,
  upsertCaseChatFeedback,
  type CaseChatCitation,
  type CaseChatFeedbackValue,
  type CaseChatMessage,
  type CaseChatMessageKind,
  type SendCaseChatResponse,
} from "@/services/caseChat";

const KEY = "case-chat";
const FB_KEY = "case-chat-feedback";

export interface AssistantFallback {
  assistantMessageId: string;
  content: string;
  citations: CaseChatCitation[];
  created_at: string;
}

function sortByCreatedAt(list: CaseChatMessage[]): CaseChatMessage[] {
  return [...list].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

function upsertAssistantFromFinal(
  prev: CaseChatMessage[] | undefined,
  caseId: string,
  resp: SendCaseChatResponse,
): CaseChatMessage[] {
  const list = Array.isArray(prev) ? [...prev] : [];
  const idx = list.findIndex((m) => m.id === resp.assistantMessageId);
  const base: CaseChatMessage =
    idx >= 0
      ? list[idx]
      : {
          id: resp.assistantMessageId,
          case_id: caseId,
          organization_id: "",
          role: "assistant",
          content: "",
          message_kind: "general",
          is_pinned: false,
          metadata: null,
          created_by: null,
          created_at: resp.created_at,
        };
  const merged: CaseChatMessage = {
    ...base,
    role: "assistant",
    content: resp.content || base.content,
    created_at: resp.created_at || base.created_at,
    metadata: {
      ...(base.metadata ?? {}),
      citations: resp.citations ?? base.metadata?.citations ?? [],
      tokens: resp.tokens ?? base.metadata?.tokens,
      response_time_ms: resp.response_time_ms ?? base.metadata?.response_time_ms,
      estimated_cost_usd: resp.estimated_cost_usd ?? base.metadata?.estimated_cost_usd,
    },
  };
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  return sortByCreatedAt(list);
}

export function useCaseChat(caseId: string | undefined) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: [KEY, caseId],
    queryFn: () => listCaseChatMessages(caseId!),
    enabled: !!caseId,
    select: (data) => sortByCreatedAt(data ?? []),
  });

  const feedbackQuery = useQuery({
    queryKey: [FB_KEY, caseId],
    queryFn: () => listCaseChatFeedback(caseId!),
    enabled: !!caseId,
  });

  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<CaseChatCitation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [assistantFallback, setAssistantFallback] = useState<AssistantFallback | null>(null);

  // Quando a mensagem persistida (mesmo id) aparece em messages, descarta o fallback.
  useEffect(() => {
    if (!assistantFallback) return;
    const found = (messagesQuery.data ?? []).some(
      (m) => m.id === assistantFallback.assistantMessageId,
    );
    if (found) {
      ccdLog("hook", "fallback_clear_persisted", { id: assistantFallback.assistantMessageId });
      setAssistantFallback(null);
    }
  }, [messagesQuery.data, assistantFallback]);

  const sendMessage = useCallback(
    async (message: string): Promise<SendCaseChatResponse | null> => {
      if (!caseId) throw new Error("caseId ausente");
      ccdLog("hook", "sendMessage_start", { caseId, message_len: message.length });
      setChatError(null);
      setStreamingText("");
      setStreamingCitations([]);
      setIsStreaming(true);
      let finalResp: SendCaseChatResponse | null = null;
      try {
        finalResp = await streamCaseChatMessage(caseId, message, {
          onMeta: (cit) => setStreamingCitations(cit),
          onDelta: (t) => setStreamingText((prev) => prev + t),
        });
        ccdLog("hook", "service_resolved", {
          assistantMessageId: finalResp.assistantMessageId,
          content_len: finalResp.content.length,
        });

        // === HOTFIX PR-4.0A: atualização DIRETA do cache antes do refetch ===
        queryClient.setQueryData<CaseChatMessage[]>([KEY, caseId], (prev) =>
          upsertAssistantFromFinal(prev, caseId, finalResp!),
        );
        ccdLog("hook", "cache_setQueryData_done", {
          id: finalResp.assistantMessageId,
        });

        // Fallback de rede de segurança — sumirá no useEffect quando o id aparecer
        // tanto no cache otimista quanto na lista persistida.
        setAssistantFallback({
          assistantMessageId: finalResp.assistantMessageId,
          content: finalResp.content,
          citations: finalResp.citations ?? [],
          created_at: finalResp.created_at,
        });

        // Sincronização com o banco (não é o caminho principal de renderização).
        queryClient
          .invalidateQueries({ queryKey: [KEY, caseId] })
          .then(() => ccdLog("hook", "invalidate_done", { key: KEY, caseId }))
          .catch(() => { /* ignore */ });

        return finalResp;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ccdLog("hook", "service_error", { msg });
        setChatError(msg);
        await queryClient.invalidateQueries({ queryKey: [KEY, caseId] }).catch(() => {});
        return null;
      } finally {
        ccdLog("hook", "sendMessage_finally", { hadFinal: !!finalResp });
        setIsStreaming(false);
        // streamingText/citations só zeram após o cache já ter a resposta OU
        // o fallback ter sido armado. Em ambos os casos a UI já tem o que mostrar.
        setStreamingText("");
        setStreamingCitations([]);
      }
    },
    [caseId, queryClient],
  );

  const clearChatError = useCallback(() => setChatError(null), []);

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned, kind }: { id: string; isPinned: boolean; kind?: CaseChatMessageKind }) =>
      setCaseChatMessagePin(id, isPinned, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, caseId] });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (params: {
      messageId: string;
      organizationId: string;
      feedback: CaseChatFeedbackValue;
      comment?: string | null;
    }) =>
      upsertCaseChatFeedback({
        messageId: params.messageId,
        caseId: caseId!,
        organizationId: params.organizationId,
        feedback: params.feedback,
        comment: params.comment ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FB_KEY, caseId] });
    },
  });

  // Realtime
  useEffect(() => {
    if (!caseId) return;
    const channel = supabase
      .channel(`case_chat_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_chat_messages", filter: `case_id=eq.${caseId}` },
        () => queryClient.invalidateQueries({ queryKey: [KEY, caseId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, queryClient]);

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    refetch: messagesQuery.refetch,
    sendMessage,
    isSending: isStreaming,
    isStreaming,
    streamingText,
    streamingCitations,
    pinMessage: pinMutation.mutateAsync,
    isPinning: pinMutation.isPending,
    feedback: feedbackQuery.data ?? [],
    submitFeedback: feedbackMutation.mutateAsync,
    isSubmittingFeedback: feedbackMutation.isPending,
    chatError,
    clearChatError,
    assistantFallback,
  };
}
