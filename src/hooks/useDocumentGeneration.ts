// =============================================================================
// useDocumentGeneration — Hook for AI document generation
// Story 2.2 — Document Generation Flow
// =============================================================================

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { USE_EDGE_FUNCTIONS } from "@/lib/config";
import { directAIGenerate } from "@/lib/ai/direct-client";
import { buildSystemPrompt } from "@/lib/ai/prompt-builder";
import type {
  DocumentType,
  DocumentGenerationContext,
  GeneratedDocument,
  LLMProviderId,
} from "@/types/ai";

interface GenerateDocumentParams {
  documentType: DocumentType;
  context: DocumentGenerationContext;
  provider?: LLMProviderId;
  model?: string;
}

type GenerationStatus = "idle" | "generating" | "success" | "error";

export function useDocumentGeneration() {
  const { organization } = useAuth();
  const [status, setStatus] = useState<GenerationStatus>("idle");

  const mutation = useMutation({
    mutationFn: async (params: GenerateDocumentParams): Promise<GeneratedDocument> => {
      if (!organization?.id) throw new Error("Organização não encontrada");

      setStatus("generating");

      // Build the full prompt from context
      const userPrompt = params.context.full_prompt
        || params.context.facts
        || `Gere um documento jurídico do tipo: ${params.documentType}`;

      const systemPrompt = buildSystemPrompt(params.documentType);

      const requestBody = {
        documentType: params.documentType,
        context: params.context,
        provider: params.provider ?? "lovable",
        model: params.model ?? "google/gemini-3-flash-preview",
        organizationId: organization.id,
        prompt: userPrompt,
        systemPrompt,
      };

      if (USE_EDGE_FUNCTIONS) {
        const { data, error } = await supabase.functions.invoke("ai-generate", {
          body: requestBody,
        });
        if (error) throw new Error(`Falha na geração: ${error.message}`);
        return data as GeneratedDocument;
      }

      return directAIGenerate({
        prompt: userPrompt,
        systemPrompt,
        provider: requestBody.provider,
        model: requestBody.model,
        organizationId: requestBody.organizationId,
        documentType: params.documentType,
        context: params.context,
      });
    },
    onSuccess: () => setStatus("success"),
    onError: () => setStatus("error"),
  });

  const generate = useCallback(
    (params: GenerateDocumentParams) => mutation.mutateAsync(params),
    [mutation],
  );

  const reset = useCallback(() => {
    mutation.reset();
    setStatus("idle");
  }, [mutation]);

  return {
    generate,
    document: mutation.data ?? null,
    isGenerating: mutation.isPending,
    error: mutation.error,
    status,
    reset,
  };
}
