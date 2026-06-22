// =============================================================================
// CaseChatPanel — PR-3
// Chat de análise e estratégia por processo. Não gera peças.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
// remark-gfm not installed; using plain markdown is enough for chat answers.
import { AlertCircle, FileText, Loader2, Pin, PinOff, Send, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCaseChat } from "@/hooks/useCaseChat";
import type { CaseChatCitation, CaseChatMessage } from "@/services/caseChat";

interface Props {
  caseId: string;
  hasProcessedFiles: boolean;
}

function Citations({ citations }: { citations: CaseChatCitation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {citations.map((c) => {
        const pages =
          c.page_from === c.page_to
            ? `p. ${c.page_from ?? "?"}`
            : `pp. ${c.page_from ?? "?"}–${c.page_to ?? "?"}`;
        return (
          <Badge
            key={c.chunk_id}
            variant="secondary"
            className="gap-1 font-normal"
            title={`Similaridade: ${(c.similarity * 100).toFixed(1)}%`}
          >
            <FileText className="h-3 w-3" />
            <span className="max-w-[180px] truncate">{c.file_name}</span>
            <span className="text-muted-foreground">· {pages}</span>
          </Badge>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  onTogglePin,
  isPinning,
}: {
  message: CaseChatMessage;
  onTogglePin: (m: CaseChatMessage) => void;
  isPinning: boolean;
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

        {!isUser && <Citations citations={citations} />}

        {!isUser && (
          <div className="mt-2 flex items-center justify-end gap-2">
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

export default function CaseChatPanel({ caseId, hasProcessedFiles }: Props) {
  const { toast } = useToast();
  const {
    messages,
    isLoading,
    sendMessage,
    isSending,
    pinMessage,
    isPinning,
  } = useCaseChat(caseId);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.is_pinned && m.role === "assistant"),
    [messages],
  );

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) textareaRef.current?.focus();
  }, [isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    try {
      await sendMessage(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Falha no chat",
        description: msg,
        variant: "destructive",
      });
      setInput(text);
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
            ) : messages.length === 0 ? (
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
                  />
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando os autos...
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
