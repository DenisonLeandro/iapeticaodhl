// =============================================================================
// useCaseChat — PR-3
// =============================================================================

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import {
  listCaseChatMessages,
  sendCaseChatMessage,
  setCaseChatMessagePin,
  type CaseChatMessageKind,
} from "@/services/caseChat";

const KEY = "case-chat";

export function useCaseChat(caseId: string | undefined) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: [KEY, caseId],
    queryFn: () => listCaseChatMessages(caseId!),
    enabled: !!caseId,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendCaseChatMessage(caseId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, caseId] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned, kind }: { id: string; isPinned: boolean; kind?: CaseChatMessageKind }) =>
      setCaseChatMessagePin(id, isPinned, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, caseId] });
    },
  });

  // Realtime — quando alguém da equipe escreve no mesmo caso, refresca.
  useEffect(() => {
    if (!caseId) return;
    const channel = supabase
      .channel(`case_chat_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_chat_messages", filter: `case_id=eq.${caseId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: [KEY, caseId] });
        },
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
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error as Error | null,
    pinMessage: pinMutation.mutateAsync,
    isPinning: pinMutation.isPending,
  };
}
