// =============================================================================
// Provider Factory with Fallback
// Story 2.1 — LLM Provider Abstraction Layer
// =============================================================================

import type {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderId,
  DocumentGenerationParams,
  GeneratedDocument,
  ChatMessage,
  ChatResponse,
  LLMModel,
} from "@/types/ai";
import { AllProvidersFailedError } from "@/types/ai";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";

// ---------------------------------------------------------------------------
// Default models per provider (used when no model is specified in config)
// ---------------------------------------------------------------------------
const DEFAULT_MODELS: Record<LLMProviderId, string> = {
  lovable: "google/gemini-3-flash-preview",
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-5-haiku-20241022",
};

// ---------------------------------------------------------------------------
// createProvider — instantiate a single provider
// ---------------------------------------------------------------------------
export function createProvider(
  providerId: LLMProviderId,
  model: string | undefined,
  organizationId: string,
): LLMProvider {
  const resolvedModel = model ?? DEFAULT_MODELS[providerId];

  switch (providerId) {
    case "lovable":
      // Lovable AI uses the edge function; fallback to OpenAI adapter shape
      return new OpenAIProvider(resolvedModel, organizationId);
    case "openai":
      return new OpenAIProvider(resolvedModel, organizationId);
    case "gemini":
      return new GeminiProvider(resolvedModel, organizationId);
    case "claude":
      return new ClaudeProvider(resolvedModel, organizationId);
    default:
      throw new Error(`Unknown LLM provider: ${providerId}`);
  }
}

// ---------------------------------------------------------------------------
// createProviderWithFallback — wraps a primary provider with fallback logic
// ---------------------------------------------------------------------------
export function createProviderWithFallback(
  config: LLMProviderConfig,
  organizationId: string,
): LLMProvider {
  const primary = createProvider(config.provider, config.model, organizationId);
  const fallbackIds = config.fallbackProviders ?? [];

  if (fallbackIds.length === 0) return primary;

  // Build a proxy that intercepts generateDocument and chat
  return {
    id: primary.id,
    name: primary.name,

    async generateDocument(
      params: DocumentGenerationParams,
    ): Promise<GeneratedDocument> {
      return tryWithFallback(
        [config.provider, ...fallbackIds],
        organizationId,
        (provider) => provider.generateDocument(params),
      );
    },

    async chat(messages: ChatMessage[]): Promise<ChatResponse> {
      return tryWithFallback(
        [config.provider, ...fallbackIds],
        organizationId,
        (provider) => provider.chat(messages),
      );
    },

    async getModels(): Promise<LLMModel[]> {
      return primary.getModels();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tryWithFallback<T>(
  providers: LLMProviderId[],
  organizationId: string,
  fn: (provider: LLMProvider) => Promise<T>,
): Promise<T> {
  const attempts: Array<{ provider: LLMProviderId; error: string }> = [];

  for (const providerId of providers) {
    try {
      const provider = createProvider(providerId, undefined, organizationId);
      return await fn(provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ provider: providerId, error: message });
      console.warn(`Provider ${providerId} failed, trying next... (${message})`);
    }
  }

  throw new AllProvidersFailedError(attempts);
}
