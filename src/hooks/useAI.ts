// =============================================================================
// useAI — React hook for LLM generation via Edge Function or direct client
// Story 2.1 — LLM Provider Abstraction Layer
// =============================================================================

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { USE_EDGE_FUNCTIONS } from "@/lib/config";
import { directAIGenerate } from "@/lib/ai/direct-client";
import type {
  LLMProviderId,
  AIGenerateRequest,
  AIGenerateResponse,
  DocumentGenerationParams,
  GeneratedDocument,
} from "@/types/ai";

interface UseAIOptions {
  provider?: LLMProviderId;
  model?: string;
}

async function invokeAIGenerate(
  request: AIGenerateRequest,
): Promise<AIGenerateResponse> {
  // When Edge Functions are available, use them (API keys stay server-side)
  if (USE_EDGE_FUNCTIONS) {
    const { data, error } = await supabase.functions.invoke("ai-generate", {
      body: request,
    });

    if (error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }

    return data as AIGenerateResponse;
  }

  // Lovable-compatible fallback: call LLM APIs directly from the client
  // using the API key stored in the organization's llm_config
  return directAIGenerate(request);
}

export function useAI(options: UseAIOptions = {}) {
  const { organization } = useAuth();
  const [lastResponse, setLastResponse] = useState<AIGenerateResponse | null>(
    null,
  );

  const organizationId = organization?.id;

  const generateMutation = useMutation({
    mutationFn: async (params: {
      prompt: string;
      provider?: LLMProviderId;
      model?: string;
    }) => {
      if (!organizationId) {
        throw new Error("Organization not found");
      }

      const request: AIGenerateRequest = {
        prompt: params.prompt,
        provider: params.provider ?? options.provider ?? "openai",
        model: params.model ?? options.model ?? "gpt-4o-mini",
        organizationId,
      };

      const response = await invokeAIGenerate(request);
      setLastResponse(response);
      return response;
    },
  });

  const generateDocumentMutation = useMutation({
    mutationFn: async (params: DocumentGenerationParams) => {
      if (!organizationId) {
        throw new Error("Organization not found");
      }

      const ctx = params.context;
      const promptParts = [
        `Gere um documento jurídico do tipo: ${params.type}.`,
        ctx.client ? `Cliente: ${ctx.client}` : "",
        ctx.case ? `Caso: ${ctx.case}` : "",
        ctx.facts ? `Fatos: ${ctx.facts}` : "",
        ctx.legal_basis ? `Base legal: ${ctx.legal_basis}` : "",
        ctx.court ? `Tribunal: ${ctx.court}` : "",
        ctx.additional_instructions
          ? `Instruções adicionais: ${ctx.additional_instructions}`
          : "",
        params.template ? `Template base: ${params.template}` : "",
        `Idioma: ${params.language ?? "pt-BR"}`,
      ];

      const request: AIGenerateRequest = {
        prompt: promptParts.filter(Boolean).join("\n"),
        provider: options.provider ?? "openai",
        model: options.model ?? "gpt-4o-mini",
        organizationId,
        documentType: params.type,
        context: params.context,
      };

      const response = await invokeAIGenerate(request);
      setLastResponse(response);

      const doc: GeneratedDocument = {
        content: response.content,
        tokensUsed: response.tokensUsed,
        model: response.model,
        provider: response.provider,
      };

      return doc;
    },
  });

  const generate = useCallback(
    (prompt: string, overrides?: { provider?: LLMProviderId; model?: string }) =>
      generateMutation.mutateAsync({
        prompt,
        provider: overrides?.provider,
        model: overrides?.model,
      }),
    [generateMutation],
  );

  const generateDocument = useCallback(
    (params: DocumentGenerationParams) =>
      generateDocumentMutation.mutateAsync(params),
    [generateDocumentMutation],
  );

  return {
    generate,
    generateDocument,
    lastResponse,
    isGenerating: generateMutation.isPending || generateDocumentMutation.isPending,
    error: generateMutation.error ?? generateDocumentMutation.error,
  };
}
