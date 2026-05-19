import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/schemas/client.schema";
import { useUploadFile } from "@/hooks/useClientDetail";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function FileUploadDialog({
  open,
  onOpenChange,
  clientId,
}: FileUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile(clientId);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setDescription("");
    setPreview(null);
    setUploadProgress(0);
    setValidationError(null);
    setIsDragging(false);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return "Arquivo deve ter no máximo 10MB";
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF";
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        setPreview(null);
        return;
      }

      setValidationError(null);
      setSelectedFile(file);

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    },
    [validateFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      // Simulate progress since Supabase JS client doesn't expose upload progress
      setUploadProgress(30);
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadFile.mutateAsync({
        file: selectedFile,
        description: description || undefined,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);
      toast.success("Arquivo enviado com sucesso");

      setTimeout(() => {
        resetState();
        onOpenChange(false);
      }, 300);
    } catch {
      setUploadProgress(0);
      toast.error("Erro ao enviar arquivo. Tente novamente.");
    }
  };

  const handleClose = (value: boolean) => {
    if (!value) resetState();
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload de Arquivo</DialogTitle>
          <DialogDescription>
            Envie documentos pessoais do cliente (RG, CPF, procuração, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={handleInputChange}
            />
            <FileUp className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Arraste e solte um arquivo aqui ou clique para selecionar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, WebP ou PDF (máx. 10MB)
            </p>
          </div>

          {/* Validation error */}
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          {/* Selected file preview */}
          {selectedFile && (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              {/* Preview thumbnail or icon */}
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="h-16 w-16 rounded object-cover"
                />
              ) : selectedFile.type === "application/pdf" ? (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-red-50">
                  <FileText className="h-8 w-8 text-red-500" />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setPreview(null);
                  setValidationError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Progress bar */}
          {uploadProgress > 0 && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {uploadProgress}%
              </p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="file-description">Descrição (opcional)</Label>
            <Input
              id="file-description"
              placeholder="Ex: Procuração, RG frente, CNH..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadFile.isPending}
          >
            {uploadFile.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
