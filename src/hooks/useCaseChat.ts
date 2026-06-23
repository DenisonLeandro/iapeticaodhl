// =============================================================================
// useCaseChat — PR-3 + PR-3.5 (streaming + feedback)
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import {
  listCaseChatFeedback,
  listCaseChatMessages,
  setCaseChatMessagePin,
  streamCaseChatMessage,
  upsertCaseChatFeedback,
  type CaseChatCitation,
  type CaseChatFeedbackValue,
  type CaseChatMessageKind,
  type SendCaseChatResponse,
} from "@/services/caseChat";

const KEY = "case-chat";
const FB_KEY = "case-chat-feedback";

export function useCaseChat(caseId: string | undefined) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: [KEY, caseId],
    queryFn: () => listCaseChatMessages(caseId!),
    enabled: !!caseId,
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

  const sendMessage = useCallback(
    async (message: string): Promise<SendCaseChatResponse | null> => {
      if (!caseId) throw new Error("caseId ausente");
      setChatError(null);
      setStreamingText("");
      setStreamingCitations([]);
      setIsStreaming(true);
      try {
        const resp = await streamCaseChatMessage(caseId, message, {
          onMeta: (cit) => setStreamingCitations(cit),
          onDelta: (t) => setStreamingText((prev) => prev + t),
        });
        await queryClient.invalidateQueries({ queryKey: [KEY, caseId] });
        return resp;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setChatError(msg);
        // Refetch mesmo assim — assistant pode ter sido persistido server-side
        await queryClient.invalidateQueries({ queryKey: [KEY, caseId] }).catch(() => {});
        return null;
      } finally {
        setIsStreaming(false);
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
  };
}

