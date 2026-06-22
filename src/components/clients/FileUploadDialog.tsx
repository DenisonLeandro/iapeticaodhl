import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2, X, FileText, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
import { useUploadFiles, useClientCases } from "@/hooks/useClientDetail";
import {
  DEFAULT_REPRESENTED_PARTY,
  REPRESENTED_PARTY_LABELS,
  REPRESENTED_PARTY_OPTIONS,
  type RepresentedParty,
} from "@/lib/represented-party";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  /** Pré-seleciona um processo (ex.: abertura via tela do processo). */
  initialCaseId?: string;
  /** Quando true, trava o Select de processo no initialCaseId e impede troca/remoção. */
  lockCase?: boolean;
}

const NO_CASE = "__none__";
const NO_KIND = "__none__";

type ItemStatus = "idle" | "uploading" | "done" | "error" | "invalid";

interface QueueItem {
  id: string;
  file: File;
  kind: string; // NO_KIND or document_kind value
  status: ItemStatus;
  error?: string;
  validationError?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return FILE_TOO_LARGE_MESSAGE;
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou PDF";
  }
  return null;
}

export default function FileUploadDialog({
  open,
  onOpenChange,
  clientId,
  initialCaseId,
  lockCase = false,
}: FileUploadDialogProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [batchKind, setBatchKind] = useState<string>(NO_KIND);
  const [caseId, setCaseId] = useState<string>(initialCaseId ?? NO_CASE);
  const [representedParty, setRepresentedParty] = useState<RepresentedParty>(
    DEFAULT_REPRESENTED_PARTY,
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useUploadFiles(clientId);
  const { cases, isLoading: isLoadingCases } = useClientCases(clientId);

  const selectedCase = useMemo(
    () => (caseId !== NO_CASE ? cases.find((c) => c.id === caseId) ?? null : null),
    [cases, caseId],
  );
  const inheritedParty = (selectedCase?.represented_party as RepresentedParty | null) ?? null;

  const validCount = items.filter((i) => i.status !== "invalid").length;
  const isUploading = items.some((i) => i.status === "uploading");

  const resetState = useCallback(() => {
    setItems([]);
    setBatchKind(NO_KIND);
    setCaseId(initialCaseId ?? NO_CASE);
    setRepresentedParty(DEFAULT_REPRESENTED_PARTY);
    setIsDragging(false);
  }, [initialCaseId]);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      const newItems: QueueItem[] = arr.map((file) => {
        const err = validateFile(file);
        return {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          kind: NO_KIND,
          status: err ? "invalid" : "idle",
          validationError: err ?? undefined,
        };
      });
      setItems((prev) => [...prev, ...newItems]);
    },
    [],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = ""; // allow re-selecting same files
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const updateItem = (id: string, patch: Partial<QueueItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const applyKindToAll = () => {
    setItems((prev) =>
      prev.map((i) => (i.status === "invalid" ? i : { ...i, kind: batchKind })),
    );
  };

  const handleUpload = async () => {
    const toUpload = items.filter((i) => i.status === "idle" || i.status === "error");
    if (toUpload.length === 0) return;

    // Mark as uploading
    setItems((prev) =>
      prev.map((i) =>
        toUpload.find((t) => t.id === i.id)
          ? { ...i, status: "uploading", error: undefined }
          : i,
      ),
    );

    const partyToPersist = selectedCase ? undefined : representedParty;
    const idsInOrder = toUpload.map((t) => t.id);

    try {
      await uploadFiles.mutateAsync({
        items: toUpload.map((it) => ({
          file: it.file,
          options: {
            document_kind: it.kind !== NO_KIND ? it.kind : undefined,
            case_id: caseId !== NO_CASE ? caseId : undefined,
            represented_party: partyToPersist,
          },
        })),
        onItemDone: (index, result) => {
          const id = idsInOrder[index];
          updateItem(id, {
            status: result.success ? "done" : "error",
            error: result.error,
          });
        },
      });
    } catch (err) {
      // Mark remaining uploading items as error
      const msg = err instanceof Error ? err.message : "Falha no envio";
      setItems((prev) =>
        prev.map((i) =>
          i.status === "uploading" ? { ...i, status: "error", error: msg } : i,
        ),
      );
    }

    // Final summary
    setTimeout(() => {
      setItems((prev) => {
        const done = prev.filter((i) => i.status === "done").length;
        const errored = prev.filter((i) => i.status === "error").length;
        if (errored === 0 && done > 0) {
          toast.success(`${done} arquivo(s) enviado(s) com sucesso`);
          // auto close
          resetState();
          onOpenChange(false);
        } else if (done > 0 && errored > 0) {
          toast.warning(`${done} enviado(s), ${errored} com erro`);
        } else if (errored > 0) {
          toast.error(`Falha ao enviar ${errored} arquivo(s)`);
        }
        return prev;
      });
    }, 100);
  };

  const handleClose = (value: boolean) => {
    if (isUploading) return;
    if (!value) resetState();
    onOpenChange(value);
  };

  const goToCases = () => {
    onOpenChange(false);
    navigate("/cases");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload de Arquivos</DialogTitle>
          <DialogDescription>
            Envie um ou vários documentos (PDF, JPG, PNG, WebP — máx. {MAX_FILE_SIZE_LABEL} por arquivo).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dropzone */}
          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              onChange={handleInputChange}
            />
            <FileUp className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Arraste e solte arquivos aqui ou clique para selecionar (múltiplos permitidos)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, WebP ou PDF — máx. {MAX_FILE_SIZE_LABEL} por arquivo
            </p>
          </div>

          {/* File list */}
          {items.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 rounded-md border p-2 ${
                    item.status === "invalid" || item.status === "error"
                      ? "border-destructive/50 bg-destructive/5"
                      : item.status === "done"
                      ? "border-green-500/40 bg-green-500/5"
                      : "border-border"
                  }`}
                >
                  {item.file.type === "application/pdf" ? (
                    <FileText className="mt-1 h-5 w-5 shrink-0 text-red-500" />
                  ) : (
                    <ImageIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>
                    {item.status === "invalid" && (
                      <p className="text-xs text-destructive">{item.validationError}</p>
                    )}
                    {item.status === "error" && (
                      <p className="text-xs text-destructive">Erro: {item.error}</p>
                    )}
                    {item.status !== "invalid" && (
                      <Select
                        value={item.kind}
                        onValueChange={(v) => updateItem(item.id, { kind: v })}
                        disabled={item.status === "uploading" || item.status === "done"}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Tipo do documento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_KIND}>Não classificado</SelectItem>
                          {DOCUMENT_KINDS.map((k) => (
                            <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {item.status === "done" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {(item.status === "invalid" || item.status === "error") && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={item.status === "uploading"}
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              {items.some((i) => i.status === "invalid") && (
                <p className="px-1 pt-1 text-xs text-destructive">
                  Um ou mais arquivos ultrapassam o limite de {MAX_FILE_SIZE_LABEL} ou têm tipo não permitido. Remova-os ou divida em volumes menores.
                </p>
              )}
            </div>
          )}

          {/* Batch settings */}
          {items.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>Aplicar tipo a todos</Label>
                <div className="flex gap-2">
                  <Select value={batchKind} onValueChange={setBatchKind}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_KIND}>Não classificado</SelectItem>
                      {DOCUMENT_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={applyKindToAll}>
                    Aplicar a todos
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="case-link">Vincular todos a um processo (opcional)</Label>
                {isLoadingCases ? (
                  <p className="text-xs text-muted-foreground">Carregando processos...</p>
                ) : cases.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border bg-muted/40 p-3">
                    <p className="text-sm">Este cliente ainda não possui processo cadastrado.</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={goToCases}>
                      Cadastrar processo
                    </Button>
                  </div>
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

              <div className="space-y-2">
                <Label>Parte representada pelo escritório</Label>
                {selectedCase ? (
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                    {inheritedParty
                      ? `Herdada do processo: ${REPRESENTED_PARTY_LABELS[inheritedParty] ?? inheritedParty}`
                      : "Este processo ainda não tem parte representada definida. Edite o processo para alterar."}
                  </div>
                ) : (
                  <Select
                    value={representedParty}
                    onValueChange={(v) => setRepresentedParty(v as RepresentedParty)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPRESENTED_PARTY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              isUploading ||
              !items.some((i) => i.status === "idle" || i.status === "error")
            }
          >
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar {validCount > 0 ? `(${items.filter((i) => i.status === "idle" || i.status === "error").length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
