// =============================================================================
// useDocumentChat — Fase D
// =============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listChatMessages, sendChatMessage } from "@/services/documentChat";

const KEY = "document-chat";

export function useDocumentChat(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: [KEY, documentId],
    queryFn: () => listChatMessages(documentId!),
    enabled: !!documentId,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendChatMessage(documentId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, documentId] });
    },
  });

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    refetch: messagesQuery.refetch,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
  };
}
