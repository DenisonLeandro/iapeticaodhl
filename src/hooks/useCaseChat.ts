// =============================================================================
// useCaseChat — PR-3 + PR-3.5 + PR-4.0A hotfix v3
// Fonte visual estável por caseId via store de módulo (useSyncExternalStore),
// sobrevivendo a remount/HMR do CaseChatPanel. Sem effect que faz set em
// resposta a outro state — evita o "Cannot read properties of null (destroy)".
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import { ccdLog } from "@/lib/debug/caseChatDebug";
import {
  getCaseChatSnapshot,
  setCaseChatMessages,
  subscribeCaseChat,
} from "@/hooks/caseChatStore";
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

const TEMP_USER_PREFIX = "temp-user-";
const TEMP_USER_DEDUP_WINDOW_MS = 60_000;

function normalizeText(s: string): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function sortByCreatedAt(list: CaseChatMessage[]): CaseChatMessage[] {
  return [...list].sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

/** Merge servidor → local, sem nunca apagar mensagens locais ainda não persistidas. */
function mergeServerWithLocal(
  local: CaseChatMessage[],
  server: CaseChatMessage[],
): CaseChatMessage[] {
  const byId = new Map<string, CaseChatMessage>();
  for (const m of server) byId.set(m.id, m);

  for (const m of local) {
    if (m.id.startsWith(TEMP_USER_PREFIX)) {
      const localTs = new Date(m.created_at).getTime();
      const match = server.find(
        (s) =>
          s.role === "user" &&
          normalizeText(s.content) === normalizeText(m.content) &&
          Math.abs(new Date(s.created_at).getTime() - localTs) <
            TEMP_USER_DEDUP_WINDOW_MS,
      );
      if (match) continue;
      byId.set(m.id, m);
    } else if (!byId.has(m.id)) {
      byId.set(m.id, m);
    }
  }
  return sortByCreatedAt(Array.from(byId.values()));
}

function upsertAssistantFromFinal(
  prev: CaseChatMessage[],
  caseId: string,
  resp: SendCaseChatResponse,
): CaseChatMessage[] {
  const list = [...prev];
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
      estimated_cost_usd:
        resp.estimated_cost_usd ?? base.metadata?.estimated_cost_usd,
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
  });

  const feedbackQuery = useQuery({
    queryKey: [FB_KEY, caseId],
    queryFn: () => listCaseChatFeedback(caseId!),
    enabled: !!caseId,
  });

  // ===== Fonte visual ESTÁVEL via store de módulo =====
  // Sobrevive a remount/HMR do CaseChatPanel.
  const subscribe = useCallback(
    (l: () => void) => (caseId ? subscribeCaseChat(caseId, l) : () => {}),
    [caseId],
  );
  const getSnapshot = useCallback(
    () => getCaseChatSnapshot(caseId),
    [caseId],
  );
  const visible = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Merge do servidor no store, sem nunca apagar locais ainda não persistidos.
  const serverData = messagesQuery.data;
  useEffect(() => {
    if (!caseId || !serverData) return;
    setCaseChatMessages(caseId, (prev) => {
      const merged = mergeServerWithLocal(prev, serverData);
      ccdLog("hook", "merge_server", {
        prev: prev.length,
        server: serverData.length,
        merged: merged.length,
      });
      return merged;
    });
  }, [caseId, serverData]);

  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<CaseChatCitation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [assistantFallback, setAssistantFallback] = useState<AssistantFallback | null>(null);

  // Limpa fallback quando a mensagem persistida aparece no estado visível.
  // Lê via ref para não criar dependência que reagenda effects e dispara o
  // bug de cleanup já visto no stack trace (destroy em null).
  const fallbackIdRef = useRef<string | null>(null);
  fallbackIdRef.current = assistantFallback?.assistantMessageId ?? null;
  useEffect(() => {
    const id = fallbackIdRef.current;
    if (!id) return;
    if (visible.some((m) => m.id === id)) {
      ccdLog("hook", "fallback_clear_persisted", { id });
      setAssistantFallback(null);
    }
  }, [visible]);

  const sendMessage = useCallback(
    async (message: string): Promise<SendCaseChatResponse | null> => {
      if (!caseId) throw new Error("caseId ausente");
      ccdLog("hook", "sendMessage_start", { caseId, message_len: message.length });
      setChatError(null);
      setStreamingText("");
      setStreamingCitations([]);
      setIsStreaming(true);

      // 1) Optimistic user — pergunta visível IMEDIATAMENTE no store estável.
      const tempUser: CaseChatMessage = {
        id: `${TEMP_USER_PREFIX}${Date.now()}`,
        case_id: caseId,
        organization_id: "",
        role: "user",
        content: message,
        message_kind: "general",
        is_pinned: false,
        metadata: null,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      setCaseChatMessages(caseId, (prev) => sortByCreatedAt([...prev, tempUser]));
      ccdLog("hook", "optimistic_user_added", { temp_id: tempUser.id });

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

        // 2) Promove resposta para o store visual estável.
        setCaseChatMessages(caseId, (prev) =>
          upsertAssistantFromFinal(prev, caseId, finalResp!),
        );

        // 3) Atualiza cache do React Query (sincronização).
        queryClient.setQueryData<CaseChatMessage[]>([KEY, caseId], (prev) =>
          upsertAssistantFromFinal(prev ?? [], caseId, finalResp!),
        );

        // 4) Fallback de segurança.
        setAssistantFallback({
          assistantMessageId: finalResp.assistantMessageId,
          content: finalResp.content,
          citations: finalResp.citations ?? [],
          created_at: finalResp.created_at,
        });

        // 5) Refetch só para sincronizar; merge preserva o que já está visível.
        queryClient
          .invalidateQueries({ queryKey: [KEY, caseId] })
          .then(() => ccdLog("hook", "invalidate_done", { key: KEY, caseId }))
          .catch(() => {});

        return finalResp;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ccdLog("hook", "service_error", { msg });
        setChatError(msg);
        return null;
      } finally {
        ccdLog("hook", "sendMessage_finally", { hadFinal: !!finalResp });
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
    onSuccess: (_data, vars) => {
      if (caseId) {
        setCaseChatMessages(caseId, (prev) =>
          prev.map((m) => (m.id === vars.id ? { ...m, is_pinned: vars.isPinned } : m)),
        );
      }
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

  // Realtime — apenas invalida o query; o merge preserva o visível.
  // Cleanup defensivo para não chamar destroy em handle nulo após HMR.
  useEffect(() => {
    if (!caseId) return;
    let channel: ReturnType<typeof supabase.channel> | null = supabase
      .channel(`case_chat_${caseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_chat_messages", filter: `case_id=eq.${caseId}` },
        () => queryClient.invalidateQueries({ queryKey: [KEY, caseId] }),
      )
      .subscribe();
    return () => {
      try {
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch { /* ignora cleanup duplo */ }
      channel = null;
    };
  }, [caseId, queryClient]);

  const sortedVisible = useMemo(() => sortByCreatedAt(visible), [visible]);

  return {
    messages: sortedVisible,
    isLoading: messagesQuery.isLoading && sortedVisible.length === 0,
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
