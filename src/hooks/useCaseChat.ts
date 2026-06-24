// =============================================================================
// useCaseChat — PR-3 + PR-3.5 (streaming + feedback)
// PR-4.0A Hotfix v2: fonte de verdade visual estável (state local merge),
// optimistic user message, dedup robusto, sem dependência de refetch para render.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Merge resultado do servidor com lista local:
 * - mantém mensagens locais (otimistas/assistente já promovido) que ainda não
 *   apareceram no servidor;
 * - substitui temp-user-* pela versão persistida com mesmo conteúdo na janela;
 * - preserva todas as mensagens do servidor.
 */
function mergeServerWithLocal(
  local: CaseChatMessage[],
  server: CaseChatMessage[],
): CaseChatMessage[] {
  const byId = new Map<string, CaseChatMessage>();
  // Começa pelas do servidor (fonte de verdade canônica)
  for (const m of server) byId.set(m.id, m);

  for (const m of local) {
    if (m.id.startsWith(TEMP_USER_PREFIX)) {
      // tenta achar correspondente persistido (mesmo conteúdo, role=user, próximo no tempo)
      const localTs = new Date(m.created_at).getTime();
      const match = server.find(
        (s) =>
          s.role === "user" &&
          normalizeText(s.content) === normalizeText(m.content) &&
          Math.abs(new Date(s.created_at).getTime() - localTs) <
            TEMP_USER_DEDUP_WINDOW_MS,
      );
      if (match) continue; // já presente via server
      byId.set(m.id, m);
    } else {
      // mensagem com id real (ex.: assistant promovido) — preserva se servidor ainda não trouxe
      if (!byId.has(m.id)) byId.set(m.id, m);
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

  // ===== Fonte de verdade visual ESTÁVEL =====
  // Inicializada com o que o servidor já tiver e mesclada a cada refetch.
  const [visible, setVisible] = useState<CaseChatMessage[]>([]);
  const initializedForCase = useRef<string | null>(null);

  // Reset ao trocar de caso
  useEffect(() => {
    if (initializedForCase.current !== caseId) {
      initializedForCase.current = caseId ?? null;
      setVisible([]);
    }
  }, [caseId]);

  // Merge servidor → local, sem nunca apagar mensagens locais ainda não persistidas
  useEffect(() => {
    const server = messagesQuery.data;
    if (!server) return;
    setVisible((prev) => {
      const merged = mergeServerWithLocal(prev, server);
      ccdLog("hook", "merge_server", {
        prev: prev.length,
        server: server.length,
        merged: merged.length,
      });
      return merged;
    });
  }, [messagesQuery.data]);

  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<CaseChatCitation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [assistantFallback, setAssistantFallback] = useState<AssistantFallback | null>(null);

  // Limpa fallback quando a mensagem persistida aparece no estado visível
  useEffect(() => {
    if (!assistantFallback) return;
    const found = visible.some((m) => m.id === assistantFallback.assistantMessageId);
    if (found) {
      ccdLog("hook", "fallback_clear_persisted", {
        id: assistantFallback.assistantMessageId,
      });
      setAssistantFallback(null);
    }
  }, [visible, assistantFallback]);

  const sendMessage = useCallback(
    async (message: string): Promise<SendCaseChatResponse | null> => {
      if (!caseId) throw new Error("caseId ausente");
      ccdLog("hook", "sendMessage_start", { caseId, message_len: message.length });
      setChatError(null);
      setStreamingText("");
      setStreamingCitations([]);
      setIsStreaming(true);

      // 1) Optimistic user message — pergunta visível IMEDIATAMENTE
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
      setVisible((prev) => sortByCreatedAt([...prev, tempUser]));
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

        // 2) Promove resposta para o estado visual estável
        setVisible((prev) => upsertAssistantFromFinal(prev, caseId, finalResp!));
        ccdLog("hook", "local_visible_upsert_done", {
          id: finalResp.assistantMessageId,
        });

        // 3) Atualiza cache do React Query (não derruba a UI; só sincroniza)
        queryClient.setQueryData<CaseChatMessage[]>([KEY, caseId], (prev) =>
          upsertAssistantFromFinal(prev ?? [], caseId, finalResp!),
        );
        ccdLog("hook", "cache_setQueryData_done", {
          id: finalResp.assistantMessageId,
        });

        // 4) Fallback — só visível se o visible ainda não tem a mensagem (ex.: race)
        setAssistantFallback({
          assistantMessageId: finalResp.assistantMessageId,
          content: finalResp.content,
          citations: finalResp.citations ?? [],
          created_at: finalResp.created_at,
        });

        // 5) Sincroniza com o banco — refetch agora é seguro (merge preserva visible)
        queryClient
          .invalidateQueries({ queryKey: [KEY, caseId] })
          .then(() => ccdLog("hook", "invalidate_done", { key: KEY, caseId }))
          .catch(() => {});

        return finalResp;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ccdLog("hook", "service_error", { msg });
        setChatError(msg);
        // Mantém a pergunta otimista visível com o erro abaixo.
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
      // Atualiza visible imediatamente para refletir pin
      setVisible((prev) =>
        prev.map((m) => (m.id === vars.id ? { ...m, is_pinned: vars.isPinned } : m)),
      );
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
    messages: visible,
    isLoading: messagesQuery.isLoading && visible.length === 0,
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
