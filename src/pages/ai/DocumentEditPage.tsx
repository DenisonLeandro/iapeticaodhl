// =============================================================================
// DocumentEditPage — /ai/documents/:id/edit
// Story 2.3 — Legal Document Editor
// =============================================================================

import { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  FileDown,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  FileEdit,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useDocument } from "@/hooks/useDocuments";
import { useAutoSave } from "@/hooks/useAutoSave";
import { updateDocumentStatus } from "@/services/documents";
import { exportDocumentToPDF } from "@/lib/pdf/export-document";
import { exportDocumentToDOCX } from "@/lib/docx/export-document";
import { downloadBlob } from "@/lib/document-parser";
import LegalEditor from "@/components/ai/LegalEditor";
import type { DocumentStatus } from "@/types/ai";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Rascunho",
  review: "Em Revisão",
  approved: "Aprovado",
  signed: "Assinado",
};

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  review: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  approved: "bg-green-500/15 text-green-400 border-green-500/30",
  signed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DocumentEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { document: doc, isLoading, error } = useDocument(id);

  const [content, setContent] = useState<string>("");
  const [contentReady, setContentReady] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>("draft");
  const [isExporting, setIsExporting] = useState(false);

  // Initialize content when document loads
  const handleContentInit = useCallback(
    (initialContent: string) => {
      if (!contentReady && initialContent) {
        setContent(initialContent);
        setContentReady(true);
      }
    },
    [contentReady],
  );

  // Auto-save
  const { isSaving, lastSavedAt, saveNow } = useAutoSave({
    documentId: id ?? "",
    content,
    interval: 30_000,
  });

  // Set initial state from document
  if (doc && !contentReady) {
    handleContentInit(doc.content);
    setCurrentStatus(doc.status);
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleContentChange = useCallback((html: string) => {
    setContent(html);
  }, []);

  const handleStatusChange = async (newStatus: DocumentStatus) => {
    if (!id) return;
    try {
      await updateDocumentStatus(id, newStatus);
      setCurrentStatus(newStatus);
      toast.success(`Status alterado para "${STATUS_LABELS[newStatus]}"`);
    } catch (err) {
      toast.error("Falha ao alterar status do documento.");
      console.error(err);
    }
  };

  const sanitizeFilename = (name: string) =>
    name.replace(/[^a-zA-Z0-9À-ÿ ]/g, "_");

  const handleExportPDF = async () => {
    if (!doc) return;
    setIsExporting(true);
    try {
      saveNow();
      const blob = await exportDocumentToPDF(content, doc.title);
      downloadBlob(blob, `${sanitizeFilename(doc.title)}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      toast.error("Falha ao exportar PDF.");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    if (!doc) return;
    setIsExporting(true);
    try {
      saveNow();
      const blob = await exportDocumentToDOCX(content, doc.title);
      downloadBlob(blob, `${sanitizeFilename(doc.title)}.docx`);
      toast.success("DOCX exportado com sucesso!");
    } catch (err) {
      toast.error("Falha ao exportar DOCX.");
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">
          Documento não encontrado ou erro ao carregar.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileEdit className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              {doc.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvando...
                </span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Salvo
                </span>
              ) : (
                <span>Auto-save ativo</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={STATUS_COLORS[currentStatus]}
            >
              {STATUS_LABELS[currentStatus]}
            </Badge>
            <Select
              value={currentStatus}
              onValueChange={(v) => handleStatusChange(v as DocumentStatus)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="review">Em Revisão</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Exportar
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportDOCX}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Manual save */}
          <Button onClick={saveNow} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {/* Editor */}
      <LegalEditor
        initialContent={doc.content}
        onUpdate={handleContentChange}
      />
    </div>
  );
}
