// =============================================================================
// CaseFilesSection — PR-3A
// Arquivos (PDF/imagens) vinculados ao processo, com upload travado em case_id.
// =============================================================================

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function CaseFilesSection({ caseId, clientId }: CaseFilesSectionProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: files = [], isLoading } = useCaseFiles(caseId);

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
          <h3 className="font-display text-lg font-semibold">Arquivos do processo</h3>
          <p className="text-sm text-muted-foreground">
            PDFs e imagens vinculados a este processo. O pipeline de IA roda automaticamente.
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
                <TableHead>Tamanho</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">Chunks</TableHead>
                <TableHead>Enviado em</TableHead>
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
                          {hasParts && (
                            <span className="block text-xs text-muted-foreground">
                              {f.processed_parts}/{f.total_parts} partes processadas
                              {f.failed_parts > 0 ? ` · ${f.failed_parts} com falha` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatSize(f.file_size)}
                      {f.page_count ? ` · ${f.page_count} pp.` : ""}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
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
                    <TableCell className="text-right tabular-nums">
                      {f.chunk_count > 0 ? f.chunk_count : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(f.created_at)}
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
    </div>
  );
}
