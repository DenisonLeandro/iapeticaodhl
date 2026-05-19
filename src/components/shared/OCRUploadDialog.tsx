import { useState, useRef } from "react";
import { FileSearch, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/backend/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface OCRUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: "client" | "petition";
  onExtracted: (data: Record<string, unknown>) => void;
}

export default function OCRUploadDialog({
  open,
  onOpenChange,
  context,
  onExtracted,
}: OCRUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setProcessing(false);
    setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handleFileSelect = (selected: File) => {
    setError(null);
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Formato não suportado. Use JPG, PNG, WebP ou PDF.");
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }
    setFile(selected);

    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      const base64 = await fileToBase64(file);

      const { data, error: fnError } = await supabase.functions.invoke("ocr-extract", {
        body: { image: base64, context },
      });

      if (fnError) {
        throw new Error(fnError.message || "Erro ao chamar função de extração.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.extracted) {
        onExtracted(data.extracted);
        toast.success("Dados extraídos com sucesso!");
        handleClose(false);
      } else {
        throw new Error("Nenhum dado extraído do documento.");
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      setError(err.message || "Erro ao processar documento.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Preencher por Documento (OCR)
          </DialogTitle>
          <DialogDescription>
            Envie uma foto ou PDF de um documento para extrair os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input area */}
          {!file ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Clique para selecionar ou arraste um arquivo
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP ou PDF (máx. {MAX_SIZE_MB}MB)
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              <div className="relative rounded-lg border border-border bg-muted/30 p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={resetState}
                  disabled={processing}
                >
                  <X className="h-4 w-4" />
                </Button>
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="mx-auto max-h-48 rounded object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-3 pr-8">
                    <FileSearch className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={processing}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleProcess}
            disabled={!file || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando documento...
              </>
            ) : (
              <>
                <FileSearch className="mr-2 h-4 w-4" />
                Extrair Dados
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
