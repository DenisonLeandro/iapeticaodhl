import { Badge } from "@/components/ui/badge";
import type { CaseDraftSourcesUsed } from "@/types/caseDraft";

interface Props {
  sources: CaseDraftSourcesUsed | null | undefined;
  available: CaseDraftSourcesUsed;
}

const LABELS: Record<keyof CaseDraftSourcesUsed, string> = {
  intake: "Ficha Inteligente",
  analysis: "Análise Inicial",
  documents: "Documentos",
  template: "Modelo do Escritório",
  chat_history: "Histórico do Chat",
};

export default function DraftSourcesBadges({ sources, available }: Props) {
  const keys = Object.keys(LABELS) as (keyof CaseDraftSourcesUsed)[];
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((k) => {
        const isAvailable = available[k];
        const wasUsed = sources?.[k];
        const variant: "default" | "secondary" | "outline" = wasUsed
          ? "default"
          : isAvailable
            ? "secondary"
            : "outline";
        const suffix = wasUsed
          ? ""
          : isAvailable
            ? " (não usado)"
            : " (indisponível)";
        return (
          <Badge key={k} variant={variant} className="text-xs">
            {LABELS[k]}
            {suffix}
          </Badge>
        );
      })}
    </div>
  );
}
