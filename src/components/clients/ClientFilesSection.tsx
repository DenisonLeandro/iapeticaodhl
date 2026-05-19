import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
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
import { useClientFiles, useDeleteFile, useFileUrl } from "@/hooks/useClientDetail";
import type { ClientFile } from "@/types/client";
import FileUploadDialog from "./FileUploadDialog";

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
}: {
  file: ClientFile;
  clientId: string;
}) {
  const deleteFile = useDeleteFile(clientId);
  const getUrl = useFileUrl();

  const handleView = async () => {
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

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
        <FileIcon fileType={file.file_type} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="truncate text-sm font-medium">{file.file_name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(file.file_size)}</span>
          <span>-</span>
          <span>
            {format(new Date(file.created_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </div>
        {file.description && (
          <p className="text-xs text-muted-foreground">{file.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
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
  const { files, isLoading, error } = useClientFiles(clientId);

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
      {/* Action bar */}
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
            <FileRow key={file.id} file={file} clientId={clientId} />
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
      />
    </div>
  );
}
