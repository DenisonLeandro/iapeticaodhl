// =============================================================================
// CaseChatPanel — PR-3 + PR-3.5 (streaming + citações ricas + feedback)
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  FileText,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import { useCaseChat } from "@/hooks/useCaseChat";
import { ccdLog } from "@/lib/debug/caseChatDebug";
import type {
  CaseChatCitation,
  CaseChatFeedback,
  CaseChatFeedbackValue,
  CaseChatMessage,
} from "@/services/caseChat";

interface Props {
  caseId: string;
}

function pagesLabel(c: CaseChatCitation): string {
  if (c.page_from == null && c.page_to == null) return "página ?";
  if (c.page_from === c.page_to || c.page_to == null) return `página ${c.page_from}`;
  return `páginas ${c.page_from}–${c.page_to}`;
}

function CitationsBlock({ citations }: { citations: CaseChatCitation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Citações
      </p>
      <div className="grid gap-1.5">
        {citations.map((c) => (
          <div
            key={c.chunk_id}
            className="flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs"
            title={`Similaridade: ${(c.similarity * 100).toFixed(1)}%`}
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {c.classification ?? "Documento"}
              </p>
              <p className="truncate text-muted-foreground">{c.file_name}</p>
              <p className="text-[11px] text-muted-foreground">{pagesLabel(c)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeedbackBarProps {
  existing: CaseChatFeedback | undefined;
  onSubmit: (feedback: CaseChatFeedbackValue, comment?: string | null) => Promise<void>;
  disabled: boolean;
}

function FeedbackBar({ existing, onSubmit, disabled }: FeedbackBarProps) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<CaseChatFeedbackValue>("useful");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const openComment = (value: CaseChatFeedbackValue) => {
    setPendingValue(value);
    setComment(existing?.feedback === value ? existing?.comment ?? "" : "");
    setCommentOpen(true);
  };

  const quickVote = async (value: CaseChatFeedbackValue) => {
    if (disabled) return;
    try {
      await onSubmit(value, existing?.comment ?? null);
    } catch { /* toast tratado fora */ }
  };

  const saveComment = async () => {
    setSaving(true);
    try {
      await onSubmit(pendingValue, comment.trim() ? comment.trim() : null);
      setCommentOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const isUseful = existing?.feedback === "useful";
  const isNotUseful = existing?.feedback === "not_useful";

  return (
    <>
      <div className="mt-2 flex items-center gap-1 border-t pt-2">
        <Button
          type="button"
          variant={isUseful ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => quickVote("useful")}
        >
          <ThumbsUp className="mr-1 h-3 w-3" /> Útil
        </Button>
        <Button
          type="button"
          variant={isNotUseful ? "destructive" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => quickVote("not_useful")}
        >
          <ThumbsDown className="mr-1 h-3 w-3" /> Não ajudou
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => openComment(existing?.feedback ?? "useful")}
        >
          <MessageSquare className="mr-1 h-3 w-3" />
          {existing?.comment ? "Editar comentário" : "Comentar"}
        </Button>
        {existing?.comment && (
          <span className="ml-2 truncate text-[11px] italic text-muted-foreground">
            "{existing.comment}"
          </span>
        )}
      </div>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comentário sobre a resposta</DialogTitle>
            <DialogDescription>
              Opcional. Comentários ajudam a melhorar o sistema (ex.: "citou página errada",
              "resposta genérica", "excelente fundamentação").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={pendingValue === "useful" ? "default" : "outline"}
                size="sm"
                onClick={() => setPendingValue("useful")}
              >
                <ThumbsUp className="mr-1 h-3 w-3" /> Útil
              </Button>
              <Button
                type="button"
                variant={pendingValue === "not_useful" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setPendingValue("not_useful")}
              >
                <ThumbsDown className="mr-1 h-3 w-3" /> Não ajudou
              </Button>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentário livre (opcional)"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommentOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveComment} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MessageBubble({
  message,
  onTogglePin,
  isPinning,
  feedback,
  onSubmitFeedback,
  isSubmittingFeedback,
}: {
  message: CaseChatMessage;
  onTogglePin: (m: CaseChatMessage) => void;
  isPinning: boolean;
  feedback: CaseChatFeedback | undefined;
  onSubmitFeedback: (m: CaseChatMessage, value: CaseChatFeedbackValue, comment?: string | null) => Promise<void>;
  isSubmittingFeedback: boolean;
}) {
  const isUser = message.role === "user";
  const citations = (message.metadata?.citations ?? []) as CaseChatCitation[];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg border px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground border-primary/30"
            : "bg-card text-card-foreground"
        }`}
      >
        <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : "dark:prose-invert"}`}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {!isUser && <CitationsBlock citations={citations} />}

        {!isUser && (
          <FeedbackBar
            existing={feedback}
            disabled={isSubmittingFeedback}
            onSubmit={(value, comment) => onSubmitFeedback(message, value, comment)}
          />
        )}

        {!isUser && (
          <div className="mt-2 flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isPinning}
              onClick={() => onTogglePin(message)}
            >
              {message.is_pinned ? (
                <>
                  <PinOff className="mr-1 h-3 w-3" /> Desfixar
                </>
              ) : (
                <>
                  <Pin className="mr-1 h-3 w-3" /> Fixar
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CaseChatPanel({ caseId }: Props) {
  const { toast } = useToast();

  const filesQuery = useQuery({
    queryKey: ["case-chat-files", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_files")
        .select("id, pipeline_stage")
        .eq("case_id", caseId);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!caseId,
  });
  const hasProcessedFiles = (filesQuery.data ?? []).some((f) => f.pipeline_stage === "done");

  const {
    messages,
    isLoading,
    sendMessage,
    isSending,
    streamingText,
    streamingCitations,
    pinMessage,
    isPinning,
    feedback,
    submitFeedback,
    isSubmittingFeedback,
    chatError,
    clearChatError,
  } = useCaseChat(caseId);

  const feedbackByMsg = useMemo(() => {
    const m = new Map<string, CaseChatFeedback>();
    for (const f of feedback) m.set(f.message_id, f);
    return m;
  }, [feedback]);

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.is_pinned && m.role === "assistant"),
    [messages],
  );

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, streamingText, chatError]);

  useEffect(() => {
    if (!isSending) textareaRef.current?.focus();
  }, [isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || sendingRef.current) return;
    sendingRef.current = true;
    setInput("");
    try {
      await sendMessage(text);
      // Erro já é exposto via chatError inline; não duplicar toast.
    } finally {
      sendingRef.current = false;
    }
  };


  const handleTogglePin = async (m: CaseChatMessage) => {
    try {
      await pinMessage({ id: m.id, isPinned: !m.is_pinned });
    } catch (e) {
      toast({
        title: "Não foi possível fixar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  const handleSubmitFeedback = async (
    m: CaseChatMessage,
    value: CaseChatFeedbackValue,
    comment?: string | null,
  ) => {
    try {
      await submitFeedback({
        messageId: m.id,
        organizationId: m.organization_id,
        feedback: value,
        comment: comment ?? null,
      });
      toast({ title: "Feedback registrado" });
    } catch (e) {
      toast({
        title: "Falha ao registrar feedback",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
      throw e;
    }
  };

  if (!hasProcessedFiles) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sem documentos processados</AlertTitle>
        <AlertDescription>
          Faça upload de pelo menos um PDF e aguarde o processamento (status "done") antes
          de conversar sobre este processo. O chat usa apenas o conteúdo já indexado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="flex flex-col h-[640px]">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Chat de análise do processo</p>
              <p className="text-xs text-muted-foreground">
                Análise e estratégia, com citações dos autos. Não gera peças.
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 py-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="h-16 w-2/3 ml-auto" />
                <Skeleton className="h-16 w-3/4" />
              </div>
            ) : messages.length === 0 && !isSending ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                Faça uma pergunta sobre o processo. Exemplo: <br />
                <em>"Qual é o pedido principal?"</em> ou <em>"Quais são as principais teses da sentença?"</em>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    onTogglePin={handleTogglePin}
                    isPinning={isPinning}
                    feedback={feedbackByMsg.get(m.id)}
                    onSubmitFeedback={handleSubmitFeedback}
                    isSubmittingFeedback={isSubmittingFeedback}
                  />
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg border bg-card text-card-foreground px-4 py-3">
                      {streamingText ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{streamingText}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Pensando…
                        </div>
                      )}
                      {streamingCitations.length > 0 && (
                        <CitationsBlock citations={streamingCitations} />
                      )}
                    </div>
                  </div>
                )}

                {chatError && !isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg border border-destructive/40 bg-destructive/10 text-foreground px-4 py-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-destructive">
                            Não foi possível concluir a resposta. Tente novamente.
                          </p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {chatError}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 px-2 text-xs"
                            onClick={clearChatError}
                          >
                            Dispensar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={scrollEndRef} />

              </div>
            )}
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Pergunte sobre os autos. Enter envia, Shift+Enter quebra linha."
                rows={2}
                className="resize-none"
                disabled={isSending}
              />
              <Button
                type="button"
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                size="icon"
                className="h-10 w-10 flex-shrink-0"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="h-[640px] flex flex-col">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Mensagens fixadas</p>
          </div>
          <ScrollArea className="flex-1 px-3 py-3">
            {pinnedMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma mensagem fixada ainda. Use "Fixar" em uma análise para mantê-la
                priorizada no contexto futuro.
              </p>
            ) : (
              <div className="space-y-3">
                {pinnedMessages.map((m) => (
                  <div key={m.id} className="rounded border bg-muted/30 p-2 text-xs">
                    <div className="line-clamp-6 whitespace-pre-wrap">{m.content}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-6 px-1 text-[10px]"
                      onClick={() => handleTogglePin(m)}
                    >
                      <PinOff className="mr-1 h-3 w-3" /> Desfixar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
