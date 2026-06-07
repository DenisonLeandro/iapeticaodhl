// =============================================================================
// StepDocumentResult — Step 3: Loading state + generated document display
// Story 2.2 — Document Generation Flow
// =============================================================================

import {
  Loader2,
  Save,
  Pencil,
  FileText,
  Copy,
  Check,
  FileDown,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { exportDocumentToPDF } from "@/lib/pdf/export-document";
import { toSafeHtml } from "@/lib/ai/normalize-html";
import { exportDocumentToDOCX } from "@/lib/docx/export-document";
import { downloadBlob } from "@/lib/document-parser";
import DocumentChatPanel from "@/components/ai/chat/DocumentChatPanel";
import type { GeneratedDocument } from "@/types/ai";

interface StepDocumentResultProps {
  isGenerating: boolean;
  generatedDocument: GeneratedDocument | null;
  error: Error | null;
  isSaving: boolean;
  isSaved: boolean;
  savedDocumentId?: string | null;
  autoSaveError?: string | null;
  title?: string;
  onSave: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onBack?: () => void;
  onNewPetition?: () => void;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-16">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Gerando documento...
        </h3>
        <p className="text-sm text-muted-foreground">
          A IA está redigindo o documento. Isso pode levar de 15 a 30 segundos.
        </p>
      </div>
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <FileText className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Erro na geração
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export default function StepDocumentResult({
  isGenerating,
  generatedDocument,
  error,
  isSaving,
  isSaved,
  autoSaveError,
  title = "Documento",
  onSave,
  onEdit,
  onRetry,
  onBack,
  onNewPetition,
}: StepDocumentResultProps) {
  const [copied, setCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingDOCX, setIsExportingDOCX] = useState(false);

  if (isGenerating) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (!generatedDocument) {
    return null;
  }

  const handleCopy = async () => {
    // Copy as plain text (strip tags) so it pastes cleanly into Word
    const tmp = document.createElement("div");
    tmp.innerHTML = toSafeHtml(generatedDocument.content);
    const text = tmp.innerText;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sanitizeFilename = (name: string) =>
    name.replace(/[^a-zA-Z0-9À-ÿ ]/g, "_");

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const blob = await exportDocumentToPDF(generatedDocument.content, title);
      downloadBlob(blob, `${sanitizeFilename(title)}.pdf`);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportDOCX = async () => {
    setIsExportingDOCX(true);
    try {
      const blob = await exportDocumentToDOCX(generatedDocument.content, title);
      downloadBlob(blob, `${sanitizeFilename(title)}.docx`);
    } finally {
      setIsExportingDOCX(false);
    }
  };

  const totalTokens =
    generatedDocument.tokensUsed.input + generatedDocument.tokensUsed.output;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Documento Gerado
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise a peça abaixo. O texto está formatado em padrão jurídico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {generatedDocument.provider} / {generatedDocument.model}
          </Badge>
          <Badge variant="secondary">{totalTokens} tokens</Badge>
        </div>
      </div>

      {/* Save status banner */}
      {isSaved && !autoSaveError && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Petição salva no histórico.</span>
        </div>
      )}

      {autoSaveError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Salvamento automático falhou:</strong> {autoSaveError}
          <div className="mt-1 text-xs text-destructive/80">
            Sua petição ainda está aqui. Clique em <strong>Salvar</strong> para tentar novamente.
          </div>
        </div>
      )}

      {/* Document — A4 paper look */}
      <div className="flex justify-center bg-muted/30 p-4 sm:p-6 rounded-lg">
        <div
          className="legal-doc-preview shadow-xl"
          data-testid="generated-content"
          dangerouslySetInnerHTML={{ __html: toSafeHtml(generatedDocument.content) }}
        />
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          {onNewPetition && (
            <Button variant="ghost" size="sm" onClick={onNewPetition}>
              <Sparkles className="mr-2 h-4 w-4" />
              Nova petição
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-muted-foreground"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar texto
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportDOCX} disabled={isExportingDOCX}>
            {isExportingDOCX ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exportar Word
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isExportingPDF}>
            {isExportingPDF ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Gerar PDF
          </Button>
          <Button
            variant="outline"
            onClick={onSave}
            disabled={isSaving || isSaved}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : isSaved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Salvo
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
          <Button onClick={onEdit} disabled={!isSaved}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
