// =============================================================================
// ApplyPatchDialog — confirmação antes de aplicar sugestão da IA
// Fase D
// =============================================================================

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
import { Badge } from "@/components/ui/badge";
import type { SuggestedPatch } from "@/lib/ai/patch-applier";

const PATCH_LABEL: Record<string, string> = {
  insert: "Inserir trecho",
  replace: "Substituir tópico",
  delete: "Excluir tópico",
};

interface Props {
  open: boolean;
  patch: SuggestedPatch | null;
  isApplying?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ApplyPatchDialog({
  open,
  patch,
  isApplying,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aplicar sugestão à petição?</AlertDialogTitle>
          <AlertDialogDescription>
            Uma nova versão da petição será salva no histórico. Esta ação pode
            ser revertida em "Versões".
          </AlertDialogDescription>
        </AlertDialogHeader>
        {patch && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{PATCH_LABEL[patch.type] ?? patch.type}</Badge>
              {patch.target_section && (
                <span className="text-muted-foreground">→ {patch.target_section}</span>
              )}
            </div>
            {patch.content && (
              <div
                className="max-h-60 overflow-auto rounded border border-border bg-muted/40 p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: patch.content }}
              />
            )}
            {patch.explanation && (
              <p className="text-xs text-muted-foreground italic">{patch.explanation}</p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApplying}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isApplying}>
            {isApplying ? "Aplicando..." : "Aplicar e salvar versão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
