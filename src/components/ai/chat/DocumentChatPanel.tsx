// =============================================================================
// DocumentChatPanel — painel de conversa com a IA sobre a petição
// Fase D
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import ChatMessage from "./ChatMessage";
import ApplyPatchDialog from "./ApplyPatchDialog";
import { useDocumentChat } from "@/hooks/useDocumentChat";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { applyPatch, type SuggestedPatch } from "@/lib/ai/patch-applier";
import { markMessageApplied } from "@/services/documentChat";

interface Props {
  documentId: string;
  currentContent: string;
  /** Chamado depois de aplicar patch — para o pai sincronizar editor */
  onContentUpdated?: (newContent: string) => void;
}

const QUICK_PROMPTS = [
  "Melhorar a fundamentação",
  "Verificar riscos da peça",
  "Revisar coerência",
  "Sugerir tópico faltante",
  "Impugnar tese da parte contrária",
  "Melhorar os pedidos",
];

export default function DocumentChatPanel({
  documentId,
  currentContent,
  onContentUpdated,
}: Props) {
  const { messages, isLoading, sendMessage, isSending } = useDocumentChat(documentId);
  const { applyNewContent, isApplying } = useDocumentVersions(documentId);
  const [input, setInput] = useState("");
  const [pendingPatch, setPendingPatch] = useState<{
    patch: SuggestedPatch;
    messageId: string;
  } | null>(null);
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    try {
      await sendMessage(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar mensagem";
      toast.error(msg);
      setInput(text);
    }
  };

  const handleApply = (patch: SuggestedPatch, messageId: string) => {
    setPendingPatch({ patch, messageId });
  };

  const handleConfirmApply = async () => {
    if (!pendingPatch) return;
    const { patch, messageId } = pendingPatch;
    const result = applyPatch(currentContent, patch);
    if (!result.ok) {
      toast.error(result.warning ?? "Não foi possível aplicar a sugestão.");
      setPendingPatch(null);
      return;
    }
    try {
      await applyNewContent({
        newContent: result.content,
        changeSummary: patch.explanation ?? "Sugestão aplicada via chat IA",
        source: "chat_ai",
      });
      await markMessageApplied(messageId);
      onContentUpdated?.(result.content);
      toast.success(result.warning ?? "Alteração aplicada e nova versão salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar nova versão");
    } finally {
      setPendingPatch(null);
    }
  };

  const renderedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-[600px] flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Converse com a IA sobre esta petição</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
        <div className="space-y-4">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && renderedMessages.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Faça uma pergunta ou peça uma melhoria. A IA conhece o conteúdo
              da petição, os PDFs selecionados e os dados do processo.
            </div>
          )}
          {renderedMessages.map((m) => {
            const meta = (m.metadata ?? {}) as {
              suggested_patch?: SuggestedPatch;
              applied?: boolean;
            };
            const patch = meta.suggested_patch;
            const isDiscarded = discarded.has(m.id);
            return (
              <ChatMessage
                key={m.id}
                id={m.id}
                role={m.role}
                content={m.content}
                suggestedPatch={isDiscarded ? undefined : patch}
                applied={meta.applied}
                onApply={patch ? (p) => handleApply(p, m.id) : undefined}
                onDiscard={(id) => setDiscarded((s) => new Set(s).add(id))}
              />
            );
          })}
          {isSending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> IA está pensando…
            </div>
          )}
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap gap-1 border-t border-border px-4 py-2">
        {QUICK_PROMPTS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setInput((v) => (v ? v + " " : "") + p)}
            disabled={isSending}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex.: inclua um tópico sobre nulidade do banco de horas"
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isSending}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isSending}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <ApplyPatchDialog
        open={!!pendingPatch}
        patch={pendingPatch?.patch ?? null}
        isApplying={isApplying}
        onCancel={() => setPendingPatch(null)}
        onConfirm={handleConfirmApply}
      />
    </div>
  );
}
