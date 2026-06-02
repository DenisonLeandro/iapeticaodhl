// =============================================================================
// StepCaseDocuments — Wizard step listing analyzed PDFs of a case
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Loader2, FileText, CheckCircle2, AlertCircle, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFilesByCase } from "@/hooks/useClientDetail";
import { useAnalyzePdf } from "@/hooks/usePdfAnalysis";
import FileAnalysisDialog from "@/components/clients/FileAnalysisDialog";
import {
  REPRESENTED_PARTY_LABELS,
  isRepresentedParty,
} from "@/lib/represented-party";
import type { ClientFile } from "@/types/client";

interface StepCaseDocumentsProps {
  caseId: string;
  clientId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  analyzed: { label: "Analisado", variant: "default" },
  processing: { label: "Processando", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
  error: { label: "Erro", variant: "destructive" },
};

export default function StepCaseDocuments({
  caseId,
  clientId,
  selectedIds,
  onSelectionChange,
}: StepCaseDocumentsProps) {
  const { files, isLoading, refetch } = useFilesByCase(caseId);
  const analyzeMutation = useAnalyzePdf(clientId);
  const [viewFile, setViewFile] = useState<ClientFile | null>(null);

  // Auto-select all analyzed on first load
  useEffect(() => {
    if (!isLoading && selectedIds.length === 0 && files.length > 0) {
      const analyzedIds = files
        .filter((f) => f.processing_status === "analyzed")
        .map((f) => f.id);
      if (analyzedIds.length > 0) onSelectionChange(analyzedIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, files.length]);

  const analyzedCount = useMemo(
    () => files.filter((f) => f.processing_status === "analyzed").length,
    [files],
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleAnalyzeNow = async (file: ClientFile) => {
    try {
      await analyzeMutation.mutateAsync({
        fileId: file.id,
        representedParty: file.represented_party ?? undefined,
      });
      refetch();
    } catch {
      // toast handled elsewhere; mutation will surface via UI
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Documentos do processo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione os PDFs analisados que serão usados como base para a geração da petição.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nenhum documento vinculado a este processo. A petição será gerada apenas com base nas informações preenchidas manualmente.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {selectedIds.length === 0 && analyzedCount === 0 && (
            <Alert>
              <AlertDescription>
                Nenhum PDF analisado foi selecionado. A petição será gerada apenas com base nas informações preenchidas manualmente.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {files.map((f) => {
              const status = (f.processing_status ?? "pending") as string;
              const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
              const isAnalyzed = status === "analyzed";
              const isError = status === "error";
              const partyRaw = f.represented_party ?? null;
              const partyLabel =
                partyRaw && isRepresentedParty(partyRaw)
                  ? REPRESENTED_PARTY_LABELS[partyRaw]
                  : partyRaw;

              return (
                <div
                  key={f.id}
                  className="flex items-start gap-3 rounded-md border border-border p-3"
                >
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(f.id)}
                    onCheckedChange={() => toggle(f.id)}
                    disabled={!isAnalyzed}
                  />
                  <FileText className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{f.file_name}</span>
                      <Badge variant={badge.variant} className="text-[10px]">
                        {badge.label}
                      </Badge>
                      {f.document_kind && (
                        <Badge variant="outline" className="text-[10px]">
                          {f.document_kind}
                        </Badge>
                      )}
                      {partyLabel && (
                        <Badge variant="outline" className="text-[10px]">
                          {partyLabel}
                        </Badge>
                      )}
                    </div>
                    {f.processed_at && (
                      <p className="text-xs text-muted-foreground">
                        Analisado em {new Date(f.processed_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {isError && f.error_message && (
                      <p className="text-xs text-destructive">{f.error_message}</p>
                    )}
                    {status === "pending" && (
                      <p className="text-xs text-muted-foreground">
                        Este documento ainda não foi analisado.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {isAnalyzed && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewFile(f)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver análise
                      </Button>
                    )}
                    {(status === "pending" || isError) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={analyzeMutation.isPending}
                        onClick={() => handleAnalyzeNow(f)}
                      >
                        {analyzeMutation.isPending ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                        )}
                        Analisar agora
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selectedIds.length} selecionado(s) · {analyzedCount} analisado(s) · {files.length} total
            </span>
            {analyzedCount > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  onSelectionChange(
                    selectedIds.length === analyzedCount
                      ? []
                      : files
                          .filter((f) => f.processing_status === "analyzed")
                          .map((f) => f.id),
                  )
                }
              >
                {selectedIds.length === analyzedCount ? "Desmarcar todos" : "Selecionar todos analisados"}
              </Button>
            )}
          </div>
        </>
      )}

      <FileAnalysisDialog
        file={viewFile}
        open={!!viewFile}
        onOpenChange={(o) => !o && setViewFile(null)}
      />

      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Documentos analisados aparecem por padrão marcados. Pendentes não podem ser usados; clique em "Analisar agora" para processá-los.
        <AlertCircle className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
