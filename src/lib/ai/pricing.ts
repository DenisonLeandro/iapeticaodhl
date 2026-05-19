// =============================================================================
// LLM Pricing — Cost estimation per model & provider metadata
// Story 2.2 — Document Generation Flow
// Story 3.3 — AI Provider Settings
// =============================================================================

import type { LLMProviderId } from "@/types/ai";

// ---------------------------------------------------------------------------
// Per-1K token pricing (legacy, used by existing code)
// ---------------------------------------------------------------------------

export const LLM_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.001, output: 0.005 },
};

/**
 * Estima o custo de uma chamada LLM com base no modelo e tokens consumidos.
 * Valores em USD por 1K tokens.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = LLM_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

// ---------------------------------------------------------------------------
// Provider metadata for Settings page (Story 3.3)
// ---------------------------------------------------------------------------

export interface ModelOption {
  id: string;
  name: string;
}

export interface ProviderOption {
  id: LLMProviderId;
  name: string;
  description: string;
  models: ModelOption[];
}

export const AI_PROVIDERS: ProviderOption[] = [
  {
    id: "lovable",
    name: "Lovable AI",
    description:
      "IA integrada sem necessidade de chave de API. Funciona imediatamente com modelos de alta qualidade.",
    models: [
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash (Recomendado)" },
      { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "openai/gpt-5", name: "GPT-5" },
      { id: "openai/gpt-5-mini", name: "GPT-5 Mini" },
      { id: "openai/gpt-5.2", name: "GPT-5.2" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Modelos GPT de última geração para geração de documentos jurídicos de alta qualidade.",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "o3-mini", name: "o3-mini (Raciocínio)" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description:
      "Família Gemini com grande janela de contexto e preços competitivos.",
    models: [
      { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash-preview-05-20", name: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    description:
      "Claude Sonnet 4 e Claude 3.5 para raciocínio jurídico avançado.",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    ],
  },
];
export function getProviderOption(
  providerId: LLMProviderId,
): ProviderOption | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}
