// =============================================================================
// CaseFilesSection — PR-3A
// Arquivos (PDF/imagens) vinculados ao processo, com upload travado em case_id.
// =============================================================================

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { deleteFile as deleteFileService } from "@/services/client-file.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FileUploadDialog from "@/components/clients/FileUploadDialog";
import { PipelineStageBadge } from "@/components/files/PipelineStageBadge";
import { useCaseFiles } from "@/hooks/useCaseFiles";

interface CaseFilesSectionProps {
  caseId: string;
  clientId: string | null | undefined;
  /**
   * "technical" (default): comportamento original com tamanho, pipeline,
   * classificação e contagem de chunks. Mantido como default para não
   * impactar telas que já consomem este componente.
   * "simple": modo amigável ao advogado — esconde jargão técnico
   * (pipeline/chunks/bytes) e mostra apenas status humano.
   */
  variant?: "technical" | "simple";
}

const SIMPLE_STATUS_LABEL: Record<string, string> = {
  done: "Pronto",
  failed: "Erro",
  queued: "Processando",
  extracting: "Processando",
  chunking: "Processando",
  classifying: "Processando",
  embedding: "Processando",
  pending: "Aguardando",
};

function simpleStatusBadgeClass(stage: string | null | undefined): string {
  if (stage === "done") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (stage === "failed") return "bg-destructive/15 text-destructive";
  if (stage && ["queued", "extracting", "chunking", "classifying", "embedding"].includes(stage)) {
    return "bg-primary/15 text-primary";
  }
  return "bg-muted text-muted-foreground";
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("pt-BR");
}

export default function CaseFilesSection({ caseId, clientId, variant = "technical" }: CaseFilesSectionProps) {
  const isSimple = variant === "simple";
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    totalParts: number | null;
  } | null>(null);
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useCaseFiles(caseId);

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteFileService(fileId),
    onSuccess: () => {
      toast.success("Documento excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["case-files", caseId] });
      setPendingDelete(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha ao excluir documento: ${msg}`);
    },
  });

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Após fechar o dialog, recarrega a lista para refletir novos uploads.
      queryClient.invalidateQueries({ queryKey: ["case-files", caseId] });
    }
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {isSimple ? "Documentos do caso" : "Arquivos do processo"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSimple
              ? "Envie PDFs e imagens relacionados ao caso. O sistema prepara os documentos automaticamente."
              : "PDFs e imagens vinculados a este processo. O pipeline de IA roda automaticamente."}
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          disabled={!clientId}
          title={!clientId ? "Vincule um cliente ao processo antes de adicionar arquivos" : undefined}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Adicionar Documento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
          <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
          Nenhum arquivo vinculado a este processo.
          {clientId && (
            <p className="text-xs mt-1">
              Clique em "Adicionar Documento" para enviar o primeiro PDF.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                {!isSimple && <TableHead>Tamanho</TableHead>}
                <TableHead>{isSimple ? "Status" : "Pipeline"}</TableHead>
                {!isSimple && <TableHead>Classificação</TableHead>}
                {!isSimple && <TableHead className="text-right">Chunks</TableHead>}
                <TableHead>Enviado em</TableHead>
                <TableHead className="w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => {
                const hasParts = f.total_parts != null && f.total_parts > 1;
                const progressPct = hasParts
                  ? Math.round(((f.processed_parts ?? 0) / (f.total_parts ?? 1)) * 100)
                  : null;

                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {f.file_type === "application/pdf" ? (
                          <FileText className="h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate max-w-[280px]" title={f.file_name}>
                            {f.file_name}
                          </span>
                          {hasParts && !isSimple && (
                            <span className="block text-xs text-muted-foreground">
                              {f.processed_parts}/{f.total_parts} partes processadas
                              {f.failed_parts > 0 ? ` · ${f.failed_parts} com falha` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {!isSimple && (
                      <TableCell className="text-muted-foreground">
                        {formatSize(f.file_size)}
                        {f.page_count ? ` · ${f.page_count} pp.` : ""}
                      </TableCell>
                    )}
                    <TableCell>
                      {isSimple ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${simpleStatusBadgeClass(
                            f.pipeline_stage,
                          )}`}
                        >
                          {SIMPLE_STATUS_LABEL[f.pipeline_stage ?? "pending"] ?? "Aguardando"}
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <PipelineStageBadge
                            stage={f.pipeline_stage}
                            error={f.pipeline_last_error}
                          />
                          {hasParts && f.pipeline_stage !== "done" && f.pipeline_stage !== "failed" && (
                            <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${progressPct ?? 0}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {!isSimple && (
                      <TableCell className="text-muted-foreground">
                        {f.classification ? (
                          <span>
                            {f.classification}
                            {f.classification_confidence != null && (
                              <span className="ml-1 text-xs">
                                ({Number(f.classification_confidence).toFixed(2)})
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {!isSimple && (
                      <TableCell className="text-right tabular-nums">
                        {f.chunk_count > 0 ? f.chunk_count : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {formatDate(f.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          hasParts
                            ? "Excluir documento lógico e todas as partes"
                            : "Excluir arquivo"
                        }
                        onClick={() =>
                          setPendingDelete({
                            id: f.id,
                            name: f.file_name,
                            totalParts: f.total_parts,
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {clientId && (
        <FileUploadDialog
          open={open}
          onOpenChange={handleOpenChange}
          clientId={clientId}
          initialCaseId={caseId}
          lockCase
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(v) => {
          if (!v && !deleteMutation.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.totalParts != null && pendingDelete.totalParts > 1 ? (
                <>
                  Tem certeza que deseja excluir o documento{" "}
                  <strong>&quot;{pendingDelete.name}&quot;</strong> e suas{" "}
                  {pendingDelete.totalParts} partes? Todos os chunks, embeddings, jobs
                  de processamento e arquivos no storage serão removidos. Esta ação
                  não pode ser desfeita.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir o arquivo{" "}
                  <strong>&quot;{pendingDelete?.name}&quot;</strong>? Todos os chunks,
                  embeddings e jobs de processamento serão removidos. Esta ação não
                  pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

