// =============================================================================
// ChatMessage — bolha de mensagem do chat de documento
// Fase D
// =============================================================================

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Copy, Sparkles, Trash2, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SuggestedPatch } from "@/lib/ai/patch-applier";

export interface ChatMessageProps {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  suggestedPatch?: SuggestedPatch;
  applied?: boolean;
  onApply?: (patch: SuggestedPatch) => void;
  onDiscard?: (messageId: string) => void;
}

const PATCH_LABEL: Record<string, string> = {
  insert: "Inserir trecho",
  replace: "Substituir tópico",
  delete: "Excluir tópico",
};

export default function ChatMessage({
  id,
  role,
  content,
  suggestedPatch,
  applied,
  onApply,
  onDiscard,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = suggestedPatch?.content
      ? suggestedPatch.content.replace(/<[^>]+>/g, "")
      : content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isAssistant = role === "assistant";
  const hasPatch =
    isAssistant && suggestedPatch && suggestedPatch.type !== "none";

  return (
    <div
      className={cn(
        "flex gap-3 text-sm",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {role !== "user" && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <div className="prose prose-sm prose-invert max-w-none break-words">
          <ReactMarkdown>{content || "*(sem resposta)*"}</ReactMarkdown>
        </div>

        {hasPatch && (
          <div className="mt-2 rounded-md border border-border bg-background/40 p-2">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <Badge variant="outline" className="text-[10px]">
                {PATCH_LABEL[suggestedPatch!.type] ?? suggestedPatch!.type}
              </Badge>
              {suggestedPatch!.target_section && (
                <span className="text-muted-foreground truncate">
                  → {suggestedPatch!.target_section}
                </span>
              )}
            </div>
            {suggestedPatch!.content && (
              <div
                className="mt-2 max-h-48 overflow-auto rounded border border-border/60 bg-background/60 p-2 text-xs"
                dangerouslySetInnerHTML={{ __html: suggestedPatch!.content }}
              />
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {!applied && onApply && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onApply(suggestedPatch!)}
                >
                  <Check className="mr-1 h-3 w-3" /> Aplicar
                </Button>
              )}
              {applied && (
                <Badge className="h-6 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <Check className="mr-1 h-3 w-3" /> Aplicado
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              {!applied && onDiscard && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onDiscard(id)}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Descartar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      {role === "user" && (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <UserIcon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
