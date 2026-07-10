import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientFiles, useDeleteFile, useFileUrl, useClientCases } from "@/hooks/useClientDetail";
import { useAnalyzePdf } from "@/hooks/usePdfAnalysis";
import { DOCUMENT_KINDS } from "@/schemas/client.schema";
import { REPRESENTED_PARTY_LABELS, isRepresentedParty } from "@/lib/represented-party";
import type { ClientFile } from "@/types/client";
import FileUploadDialog from "./FileUploadDialog";
import FileAnalysisDialog from "./FileAnalysisDialog";

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  DOCUMENT_KINDS.map((k) => [k.value, k.label]),
);

const HIGHLIGHTED_KINDS = new Set([
  "pdf_integral",
  "inicial",
  "contestacao",
  "replica",
  "sentenca",
  "acordao",
  "laudo",
  "manifestacao",
  "documentos",
  "audiencia",
  "recurso",
]);

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  processing: { label: "Processando", variant: "outline" },
  analyzed: { label: "Analisado", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
};

interface ClientFilesSectionProps {
  clientId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function FileIcon({ fileType }: { fileType: string | null }) {
  if (fileType?.startsWith("image/")) {
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  }
  if (fileType === "application/pdf") {
    return <FileText className="h-8 w-8 text-red-500" />;
  }
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

function FileRow({
  file,
  clientId,
  caseNumber,
  onViewAnalysis,
}: {
  file: ClientFile;
  clientId: string;
  caseNumber?: string;
  onViewAnalysis: (file: ClientFile) => void;
}) {
  const deleteFile = useDeleteFile(clientId);
  const getUrl = useFileUrl();
  const analyze = useAnalyzePdf(clientId);

  const isPdf = file.file_type === "application/pdf";
  const status = file.processing_status ?? "pending";
  const isHighlighted = !!file.document_kind && HIGHLIGHTED_KINDS.has(file.document_kind);

  const handleView = async () => {
    if (!file.storage_path) {
      toast.info("Este documento foi dividido em partes. Abra o processo para ver detalhes.");
      return;
    }
    try {
      const url = await getUrl.mutateAsync(file.storage_path);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao abrir arquivo.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFile.mutateAsync(file.id);
      toast.success("Arquivo excluído com sucesso");
    } catch {
      toast.error("Erro ao excluir arquivo.");
    }
  };

  const runAnalyze = async () => {
    try {
      const res = await analyze.mutateAsync({ fileId: file.id });
      if (res.status === "analyzed") {
        toast.success("PDF analisado com sucesso.");
      } else {
        toast.error(res.message ?? res.error ?? "Falha ao analisar PDF.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao analisar PDF.");
    }
  };

  const kindLabel = file.document_kind ? KIND_LABELS[file.document_kind] : null;
  const statusInfo = STATUS_LABELS[status];
  const showStatus = isPdf && file.document_kind && file.document_kind !== "geral";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
        <FileIcon fileType={file.file_type} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{file.file_name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(file.file_size)}</span>
          {file.total_parts && file.total_parts > 1 && (
            <Badge variant="outline" className="font-normal">
              Dividido em {file.total_parts} partes
            </Badge>
          )}
          <span>•</span>
          <span>
            {format(new Date(file.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {kindLabel && (
            <Badge variant="outline" className="font-normal">
              {kindLabel}
            </Badge>
          )}
          {caseNumber && (
            <span className="text-muted-foreground">
              Processo: <span className="font-medium text-foreground">{caseNumber}</span>
            </span>
          )}
          {showStatus && statusInfo && (
            <Badge variant={statusInfo.variant} className="font-normal">
              {statusInfo.label}
            </Badge>
          )}
          {file.represented_party && isRepresentedParty(file.represented_party) && (
            <Badge variant="secondary" className="font-normal">
              Perspectiva: {REPRESENTED_PARTY_LABELS[file.represented_party]}
            </Badge>
          )}
        </div>
        {file.description && (
          <p className="text-xs text-muted-foreground">{file.description}</p>
        )}
        {status === "error" && file.error_message && (
          <p className="text-xs text-destructive">{file.error_message}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* AI actions — only for PDFs */}
        {isPdf && (status === "pending" || status === "error") && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isHighlighted ? "default" : "outline"}
                  size="sm"
                  onClick={runAnalyze}
                  disabled={analyze.isPending}
                >
                  {analyze.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {status === "error" ? "Tentar novamente" : "Analisar com IA"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Extrai texto do PDF e gera resumo jurídico.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {isPdf && status === "processing" && (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando
          </Button>
        )}

        {isPdf && status === "analyzed" && (
          <>
            <Button variant="outline" size="sm" onClick={() => onViewAnalysis(file)}>
              <Eye className="mr-2 h-4 w-4" />
              Ver análise
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Reprocessar">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reprocessar análise com IA?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Este documento já foi processado. Reprocessar consome créditos de IA
                    novamente (nível estimado: <strong className="text-orange-600">Alto</strong>,
                    modelo gemini-2.5-flash). A análise anterior será substituída.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={runAnalyze}>Reprocessar mesmo assim</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleView}
          disabled={getUrl.isPending}
          title="Visualizar"
        >
          {getUrl.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir arquivo</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o arquivo &quot;{file.file_name}
                &quot;? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteFile.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function ClientFilesSection({ clientId }: ClientFilesSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analysisFile, setAnalysisFile] = useState<ClientFile | null>(null);
  const { files, isLoading, error } = useClientFiles(clientId);
  const { cases } = useClientCases(clientId);

  const caseMap = new Map(cases.map((c) => [c.id, c.case_number]));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Erro ao carregar arquivos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Upload de Arquivo
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/50 p-8 text-center">
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Nenhum arquivo enviado para este cliente.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em &quot;Upload de Arquivo&quot; para enviar documentos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              clientId={clientId}
              caseNumber={file.case_id ? caseMap.get(file.case_id) : undefined}
              onViewAnalysis={setAnalysisFile}
            />
          ))}
        </div>
      )}

      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
      />

      <FileAnalysisDialog
        file={analysisFile}
        open={!!analysisFile}
        onOpenChange={(open) => !open && setAnalysisFile(null)}
      />
    </div>
  );
}
