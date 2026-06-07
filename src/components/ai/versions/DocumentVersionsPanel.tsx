// =============================================================================
// DocumentVersionsPanel — histórico de versões da petição
// Fase D
// =============================================================================

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, History, Eye, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import { toSafeHtml } from "@/lib/ai/normalize-html";
import type { DocumentVersion } from "@/services/documentVersions";

const SOURCE_LABEL: Record<string, { label: string; className: string }> = {
  initial: { label: "Inicial", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  manual: { label: "Manual", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  editor: { label: "Editor", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  chat_ai: { label: "Chat IA", className: "bg-primary/20 text-primary border-primary/30" },
  restored: { label: "Restaurada", className: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

interface Props {
  documentId: string;
  onRestored?: () => void;
}

export default function DocumentVersionsPanel({ documentId, onRestored }: Props) {
  const { versions, isLoading, restore, isRestoring } = useDocumentVersions(documentId);
  const [previewing, setPreviewing] = useState<DocumentVersion | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersion | null>(null);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restore(restoreTarget.id);
      toast.success(`Versão ${restoreTarget.version} restaurada. Uma nova versão foi criada.`);
      onRestored?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao restaurar");
    } finally {
      setRestoreTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Histórico de versões</h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Ainda não há versões salvas. A primeira versão será criada ao aplicar
          uma sugestão do chat ou ao salvar manualmente.
        </p>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => {
            const src = SOURCE_LABEL[v.source] ?? SOURCE_LABEL.manual;
            return (
              <div
                key={v.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      v{v.version}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${src.className}`}>
                      {src.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {v.change_summary && (
                    <p className="truncate text-sm text-foreground/90">{v.change_summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewing(v)}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRestoreTarget(v)}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restaurar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              Versão {previewing?.version} —{" "}
              {previewing &&
                format(new Date(previewing.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {previewing && (
              <div
                className="legal-doc-preview"
                dangerouslySetInnerHTML={{ __html: toSafeHtml(previewing.content) }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar versão {restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo desta versão se tornará a versão atual da petição. Uma
              nova versão será criada no histórico indicando a restauração — nada
              é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restaurando..." : "Restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
