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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  FILE_TOO_LARGE_MESSAGE,
  DOCUMENT_KINDS,
} from "@/schemas/client.schema";
import { useUploadFile, useClientCases } from "@/hooks/useClientDetail";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

const NO_CASE = "__none__";
const NO_KIND = "__none__";

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
  const [documentKind, setDocumentKind] = useState<string>(NO_KIND);
  const [caseId, setCaseId] = useState<string>(NO_CASE);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile(clientId);
  const { cases, isLoading: isLoadingCases } = useClientCases(clientId);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setDescription("");
    setDocumentKind(NO_KIND);
    setCaseId(NO_CASE);
    setPreview(null);
    setUploadProgress(0);
    setValidationError(null);
    setIsDragging(false);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return FILE_TOO_LARGE_MESSAGE;
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
      setUploadProgress(30);
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadFile.mutateAsync({
        file: selectedFile,
        description: description || undefined,
        options: {
          document_kind: documentKind !== NO_KIND ? documentKind : undefined,
          case_id: caseId !== NO_CASE ? caseId : undefined,
        },
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload de Arquivo</DialogTitle>
          <DialogDescription>
            Envie documentos do cliente ou peças do processo (PDF, JPG, PNG, WebP — máx. {MAX_FILE_SIZE_LABEL}).
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
              JPEG, PNG, WebP ou PDF (máx. {MAX_FILE_SIZE_LABEL})
            </p>
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          {selectedFile && (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
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

          {uploadProgress > 0 && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {uploadProgress}%
              </p>
            </div>
          )}

          {/* Classificação */}
          <div className="space-y-2">
            <Label htmlFor="document-kind">Tipo do documento (opcional)</Label>
            <Select value={documentKind} onValueChange={setDocumentKind}>
              <SelectTrigger id="document-kind">
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_KIND}>Não classificado</SelectItem>
                {DOCUMENT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vínculo com processo */}
          <div className="space-y-2">
            <Label htmlFor="case-link">Vincular a um processo (opcional)</Label>
            {isLoadingCases ? (
              <p className="text-xs text-muted-foreground">Carregando processos...</p>
            ) : cases.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum processo cadastrado para este cliente.
              </p>
            ) : (
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger id="case-link">
                  <SelectValue placeholder="Selecione um processo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CASE}>Não vincular</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number}
                      {c.court ? ` — ${c.court}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="file-description">Descrição (opcional)</Label>
            <Input
              id="file-description"
              placeholder="Ex: Procuração, RG frente, volume 1..."
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
