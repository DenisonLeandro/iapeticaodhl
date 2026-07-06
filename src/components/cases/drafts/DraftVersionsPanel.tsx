// =============================================================================
// PR-4.5B — Painel simples de versões da minuta
// =============================================================================
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useDraftVersions } from "@/hooks/useSeniorReviewApply";

const SOURCE_LABEL: Record<string, string> = {
  initial_generation: "Geração inicial",
  before_senior_review_apply: "Antes da aplicação da revisão sênior",
  senior_review_applied: "Revisão sênior aplicada",
  manual_edit: "Edição manual",
  regeneration: "Regeneração",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

export default function DraftVersionsPanel({ draftId }: { draftId: string }) {
  const { data: versions, isLoading } = useDraftVersions(draftId);

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">Histórico de versões</h3>
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
        </div>
      )}
      {!isLoading && (!versions || versions.length === 0) && (
        <p className="text-xs text-muted-foreground">Nenhuma versão registrada ainda.</p>
      )}
      {!isLoading && versions && versions.length > 0 && (
        <ul className="space-y-2">
          {versions.map((v, i) => (
            <li
              key={v.id}
              className="rounded-md border border-border/50 p-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {i === 0 ? (
                    <Badge>Versão atual</Badge>
                  ) : (
                    <Badge variant="outline">Versão anterior</Badge>
                  )}
                  <span className="text-muted-foreground">
                    {SOURCE_LABEL[v.source] ?? v.source}
                  </span>
                </div>
                <span className="text-muted-foreground">{formatDate(v.created_at)}</span>
              </div>
              {Array.isArray(v.applied_suggestion_ids) && v.applied_suggestion_ids.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {v.applied_suggestion_ids.length} sugestão(ões) incorporada(s)
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
