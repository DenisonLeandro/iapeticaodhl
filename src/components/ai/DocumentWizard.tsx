// =============================================================================
// DocumentWizard — 3-step wizard container for document generation
// Story 2.2 — Document Generation Flow
// =============================================================================

import { useCallback, useRef, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentGeneration } from "@/hooks/useDocumentGeneration";
import { useCreateDocument } from "@/hooks/useDocuments";
import { useLogAIUsage } from "@/hooks/useDocuments";
import { estimateCost } from "@/lib/ai/pricing";
import { buildUserPrompt, buildContext } from "@/lib/ai/prompt-builder";
import { cn } from "@/lib/utils";
import StepDocumentType from "@/components/ai/steps/StepDocumentType";
import StepDocumentData from "@/components/ai/steps/StepDocumentData";
import StepDocumentResult from "@/components/ai/steps/StepDocumentResult";
import JurisprudenceSearch from "@/components/ai/JurisprudenceSearch";
import { DOCUMENT_TYPE_LABELS } from "@/types/ai";
import { DEMO_FORM_DATA } from "@/lib/demo-data";
import type { DocumentType, DocumentGenerationContext } from "@/types/ai";
import type { DocumentGenerationFormData } from "@/lib/validators/document-generation";
import type { JurisprudenceResult } from "@/types/jurisprudence";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Tipo",
  2: "Dados",
  3: "Resultado",
};

export default function DocumentWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, organization } = useAuth();

  const isDemo = searchParams.get("demo") === "true";
  const demoInitialData = useMemo(() => (isDemo ? DEMO_FORM_DATA : null), [isDemo]);

  const [step, setStep] = useState<Step>(isDemo ? 1 : 1);
  const [documentType, setDocumentType] = useState<DocumentType | null>(isDemo ? "petition" : null);
  const [formData, setFormData] = useState<DocumentGenerationFormData | null>(demoInitialData);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [selectedJurisprudence, setSelectedJurisprudence] = useState<JurisprudenceResult[]>([]);

  const formRef = useRef<HTMLFormElement | null>(null);

  const {
    generate,
    document: generatedDocument,
    isGenerating,
    error: generationError,
    reset: resetGeneration,
  } = useDocumentGeneration();

  const createDocumentMutation = useCreateDocument();
  const logUsageMutation = useLogAIUsage();

  const canGoNext = (): boolean => {
    if (step === 1) return documentType !== null;
    if (step === 2) return true;
    return false;
  };

  const handleNext = useCallback(() => {
    if (step === 1 && documentType) {
      setStep(2);
    } else if (step === 2) {
      formRef.current?.requestSubmit();
    }
  }, [step, documentType]);

  const handleBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) { resetGeneration(); setStep(2); }
  }, [step, resetGeneration]);

  const handleFormSubmit = useCallback(
    async (data: DocumentGenerationFormData) => {
      setFormData(data);
      setStep(3);

      const jurisprudenciaText = selectedJurisprudence.length > 0
        ? selectedJurisprudence
            .map((j) => `${j.court}. ${j.caseNumber}. ${j.summary}${j.relator ? `. Relator: ${j.relator}` : ""}. ${j.date}.`)
            .join("\n\n")
        : "";

      const context = buildContext(data, jurisprudenciaText);

      try {
        const result = await generate({
          documentType: data.documentType,
          context,
        });

        if (organization?.id && user?.id) {
          const cost = estimateCost(result.model, result.tokensUsed.input, result.tokensUsed.output);
          logUsageMutation.mutate({
            organization_id: organization.id,
            profile_id: user.id,
            provider: result.provider,
            model: result.model,
            tokens_input: result.tokensUsed.input,
            tokens_output: result.tokensUsed.output,
            cost_estimated: cost,
            document_id: null,
            prompt_summary: `Geração de ${DOCUMENT_TYPE_LABELS[data.documentType]}`,
          });
        }
      } catch {
        // Error handled by generation hook
      }
    },
    [generate, organization, user, logUsageMutation, selectedJurisprudence],
  );

  const handleSave = useCallback(async () => {
    if (!generatedDocument || !formData || !organization?.id || !user?.id) return;

    try {
      const title = `${DOCUMENT_TYPE_LABELS[formData.documentType]} — ${formData.autor.nome}`;
      const totalTokens = generatedDocument.tokensUsed.input + generatedDocument.tokensUsed.output;

      const doc = await createDocumentMutation.mutateAsync({
        organization_id: organization.id,
        type: formData.documentType,
        title,
        content: generatedDocument.content,
        llm_provider: generatedDocument.provider,
        llm_model: generatedDocument.model,
        prompt_used: formData.fatos,
        tokens_used: totalTokens,
        status: "draft",
        created_by: user.id,
      });

      setSavedDocumentId(doc.id);
      toast({ title: "Rascunho salvo com sucesso", description: "O documento foi salvo como rascunho." });
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    }
  }, [generatedDocument, formData, organization, user, createDocumentMutation, toast]);

  const handleEdit = useCallback(() => {
    if (savedDocumentId) navigate(`/ai/documents/${savedDocumentId}/edit`);
  }, [savedDocumentId, navigate]);

  const handleRetry = useCallback(() => {
    if (formData) { resetGeneration(); handleFormSubmit(formData); }
  }, [formData, resetGeneration, handleFormSubmit]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {([1, 2, 3] as Step[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
              step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
            )}>{s}</div>
            <span className={cn("text-sm font-medium", step === s ? "text-foreground" : "text-muted-foreground")}>{STEP_LABELS[s]}</span>
            {idx < 2 && <Separator orientation="horizontal" className={cn("w-12", step > s ? "bg-primary/40" : "bg-muted")} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 1 && <StepDocumentType selectedType={documentType} onSelect={setDocumentType} />}
        {step === 2 && documentType && (
          <div className="space-y-8">
            <StepDocumentData documentType={documentType} initialData={formData} onSubmit={handleFormSubmit} formRef={formRef} />
            <Separator />
            <JurisprudenceSearch onSelectionChange={setSelectedJurisprudence} initialSelected={selectedJurisprudence} />
          </div>
        )}
        {step === 3 && (
          <StepDocumentResult
            isGenerating={isGenerating}
            generatedDocument={generatedDocument}
            error={generationError}
            isSaving={createDocumentMutation.isPending}
            isSaved={!!savedDocumentId}
            title={documentType ? `${DOCUMENT_TYPE_LABELS[documentType]} — ${formData?.autor?.nome ?? ""}` : "Documento"}
            onSave={handleSave}
            onEdit={handleEdit}
            onRetry={handleRetry}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 3 && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={step === 1}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext()}>
              Próximo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
