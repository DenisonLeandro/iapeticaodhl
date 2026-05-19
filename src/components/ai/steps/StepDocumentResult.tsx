// =============================================================================
// StepDocumentResult — Step 3: Loading state + generated document display
// Story 2.2 — Document Generation Flow
// =============================================================================

import { Loader2, Save, Pencil, FileText, Copy, Check, FileDown, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportDocumentToPDF } from "@/lib/pdf/export-document";
import { exportDocumentToDOCX } from "@/lib/docx/export-document";
import { downloadBlob } from "@/lib/document-parser";
import type { GeneratedDocument } from "@/types/ai";

interface StepDocumentResultProps {
  isGenerating: boolean;
  generatedDocument: GeneratedDocument | null;
  error: Error | null;
  isSaving: boolean;
  isSaved: boolean;
  title?: string;
  onSave: () => void;
  onEdit: () => void;
  onRetry: () => void;
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
  title = "Documento",
  onSave,
  onEdit,
  onRetry,
}: StepDocumentResultProps) {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
    await navigator.clipboard.writeText(generatedDocument.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sanitizeFilename = (name: string) =>
    name.replace(/[^a-zA-Z0-9À-ÿ ]/g, "_");

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await exportDocumentToPDF(generatedDocument.content, title);
      downloadBlob(blob, `${sanitizeFilename(title)}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    setIsExporting(true);
    try {
      const blob = await exportDocumentToDOCX(generatedDocument.content, title);
      downloadBlob(blob, `${sanitizeFilename(title)}.docx`);
    } finally {
      setIsExporting(false);
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
            Revise o documento gerado pela IA abaixo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {generatedDocument.provider} / {generatedDocument.model}
          </Badge>
          <Badge variant="secondary">{totalTokens} tokens</Badge>
        </div>
      </div>

      {/* Document Content */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="prose prose-invert max-w-none">
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
              data-testid="generated-content"
            >
              {generatedDocument.content}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-3">
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
                Rascunho Salvo
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Rascunho
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
