// =============================================================================
// PR-4.5B — Painel de sugestões acionáveis do revisor sênior
// Modo Advogado Simples por padrão. Detalhes técnicos escondidos em "Ver detalhes".
// =============================================================================
import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, X, Pencil, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useApplySeniorReview,
  useBulkSetSuggestionStatus,
  useSetSuggestionStatus,
} from "@/hooks/useSeniorReviewApply";
import type { CaseDraft, SeniorReviewSuggestion } from "@/types/caseDraft";

interface Props {
  draft: CaseDraft;
}

const SEVERITY_BADGE: Record<string, string> = {
  risco_alto: "bg-red-500/10 text-red-700 border-red-500/40 dark:text-red-300",
  atencao: "bg-amber-500/10 text-amber-800 border-amber-500/40 dark:text-amber-200",
  sugestao: "bg-primary/10 text-primary border-primary/40",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Ignorada",
  edited: "Editada",
  applied: "Aplicada",
};

export default function SeniorReviewSuggestionsPanel({ draft }: Props) {
  const suggestions: SeniorReviewSuggestion[] = Array.isArray(draft.senior_review_suggestions)
    ? draft.senior_review_suggestions
    : [];

  const setStatus = useSetSuggestionStatus(draft);
  const bulkStatus = useBulkSetSuggestionStatus(draft);
  const applyReview = useApplySeniorReview(draft.id);

  const [confirmApply, setConfirmApply] = useState(false);

  const applyStatus = draft.senior_review_apply_status ?? null;
  const isApplying = applyStatus === "applying" || applyReview.isPending;

  const acceptedIds = useMemo(
    () => suggestions.filter((s) => s.status === "accepted" || s.status === "edited").map((s) => s.id),
    [suggestions],
  );

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const appliedCount = suggestions.filter((s) => s.status === "applied").length;

  if (draft.senior_review_status !== "done" && suggestions.length === 0) {
    return null; // painel aparece só após revisão sênior concluída
  }

  if (suggestions.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Sugestões do revisor sênior</h3>
        <p className="text-xs text-muted-foreground">
          A revisão sênior não gerou sugestões acionáveis automaticamente. Confira a análise em texto no painel acima.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Sugestões do revisor sênior</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} sugestão(ões) pendente(s) — aceite ou ignore antes de aplicar.`
              : `Todas as sugestões foram avaliadas.${appliedCount > 0 ? ` ${appliedCount} já aplicada(s) na minuta.` : ""}`}
          </p>
        </div>
      </div>

      {applyStatus === "applying" && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          A IA está aplicando a revisão sênior na minuta.
        </div>
      )}
      {applyStatus === "error" && (
        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-800 dark:text-red-200">
          Não foi possível aplicar automaticamente a revisão. A minuta original foi preservada.
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pendingCount === 0 || bulkStatus.isPending}
          onClick={() =>
            bulkStatus
              .mutateAsync({ status: "accepted", filter: (s) => s.status === "pending" })
              .then(() => toast.success("Sugestões pendentes marcadas como aceitas."))
              .catch((e) => toast.error((e as Error).message))
          }
        >
          <CheckCircle2 className="mr-1 h-3 w-3" /> Aceitar todas
        </Button>
        <Button
          size="sm"
          disabled={acceptedIds.length === 0 || isApplying}
          onClick={() => setConfirmApply(true)}
        >
          {isApplying ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Aplicando…</>
          ) : (
            <><Sparkles className="mr-1 h-3 w-3" /> Aplicar sugestões aceitas na minuta ({acceptedIds.length})</>
          )}
        </Button>
      </div>

      <ul className="space-y-2">
        {suggestions.map((s) => (
          <SuggestionItem
            key={s.id}
            suggestion={s}
            disabled={isApplying}
            onAccept={() =>
              setStatus
                .mutateAsync({ suggestionId: s.id, status: "accepted" })
                .catch((e) => toast.error((e as Error).message))
            }
            onReject={() =>
              setStatus
                .mutateAsync({ suggestionId: s.id, status: "rejected" })
                .catch((e) => toast.error((e as Error).message))
            }
            onEdit={(newText) =>
              setStatus
                .mutateAsync({
                  suggestionId: s.id,
                  status: "edited",
                  patch: { trecho_sugerido: newText },
                })
                .catch((e) => toast.error((e as Error).message))
            }
          />
        ))}
      </ul>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar sugestões na minuta?</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova versão será criada. A minuta atual será preservada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmApply(false);
                try {
                  const res = await applyReview.mutateAsync(acceptedIds);
                  if (res?.status === "done") {
                    toast.success("Revisão sênior aplicada. Nova versão criada.");
                  } else {
                    toast.error("Não foi possível aplicar a revisão automaticamente.");
                  }
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Aplicar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SuggestionItem({
  suggestion,
  disabled,
  onAccept,
  onReject,
  onEdit,
}: {
  suggestion: SeniorReviewSuggestion;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (newText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(suggestion.trecho_sugerido ?? "");
  const [showTech, setShowTech] = useState(false);

  const isDone = suggestion.status === "applied";
  const isRejected = suggestion.status === "rejected";
  const sevKey = String(suggestion.severidade ?? "sugestao");

  return (
    <li className="rounded-md border border-border/60 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{suggestion.titulo}</span>
            <Badge className={SEVERITY_BADGE[sevKey] ?? SEVERITY_BADGE.sugestao} variant="outline">
              {sevKey === "risco_alto" ? "Risco alto" : sevKey === "atencao" ? "Atenção" : "Sugestão"}
            </Badge>
            <Badge variant="secondary">{STATUS_LABEL[String(suggestion.status)] ?? suggestion.status}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{suggestion.descricao}</p>
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-[100px] text-xs"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onEdit(draftText);
                setEditing(false);
              }}
              disabled={disabled}
            >
              Salvar edição
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        suggestion.trecho_sugerido && (
          <div className="mt-2 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-[11px]">
            {suggestion.trecho_sugerido}
          </div>
        )
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || isDone || isRejected}
          onClick={onAccept}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" /> Aceitar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || isDone || isRejected}
          onClick={onReject}
        >
          <X className="mr-1 h-3 w-3" /> Ignorar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || isDone}
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="mr-1 h-3 w-3" /> Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setShowTech((v) => !v)}
        >
          <Info className="mr-1 h-3 w-3" /> {showTech ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
        </Button>
      </div>

      {showTech && (
        <div className="mt-2 space-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          {suggestion.fundamento_juridico && (
            <div><span className="font-semibold">Fundamento:</span> {suggestion.fundamento_juridico}</div>
          )}
          {suggestion.local_recomendado_na_peca && (
            <div><span className="font-semibold">Local recomendado:</span> {suggestion.local_recomendado_na_peca}</div>
          )}
          {suggestion.categoria && (
            <div><span className="font-semibold">Categoria:</span> {suggestion.categoria}</div>
          )}
        </div>
      )}
    </li>
  );
}
