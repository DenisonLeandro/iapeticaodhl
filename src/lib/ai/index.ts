// =============================================================================
// AI Module — Barrel Exports
// Story 2.1 — LLM Provider Abstraction Layer
// =============================================================================

// Types (re-exported from src/types/ai.ts)
export type {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderId,
  LLMModel,
  DocumentType,
  DocumentStatus,
  DocumentGenerationParams,
  DocumentGenerationContext,
  GeneratedDocument,
  ChatMessage,
  ChatResponse,
  ChatRole,
  AIUsageLogEntry,
  Document,
  AIGenerateRequest,
  AIGenerateResponse,
} from "@/types/ai";

export { AllProvidersFailedError } from "@/types/ai";

// Provider adapters
export { OpenAIProvider } from "./openai";
export { GeminiProvider } from "./gemini";
export { ClaudeProvider } from "./claude";

// Factory
export { createProvider, createProviderWithFallback } from "./factory";
