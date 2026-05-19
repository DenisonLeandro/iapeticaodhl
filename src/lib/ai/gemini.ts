// =============================================================================
// Gemini Adapter — calls Edge Function, does NOT call Gemini API directly
// Story 2.1 — LLM Provider Abstraction Layer
// =============================================================================

import { supabase } from "@/lib/backend/client";
import type {
  LLMProvider,
  LLMModel,
  DocumentGenerationParams,
  GeneratedDocument,
  ChatMessage,
  ChatResponse,
} from "@/types/ai";

const GEMINI_MODELS: LLMModel[] = [
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    maxTokens: 1_048_576,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    maxTokens: 1_048_576,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    maxTokens: 1_048_576,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
  },
];

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini";

  private model: string;
  private organizationId: string;

  constructor(model: string, organizationId: string) {
    this.model = model;
    this.organizationId = organizationId;
  }

  async generateDocument(
    params: DocumentGenerationParams,
  ): Promise<GeneratedDocument> {
    const prompt = this.buildDocumentPrompt(params);

    const { data, error } = await supabase.functions.invoke("ai-generate", {
      body: {
        prompt,
        provider: this.id,
        model: this.model,
        organizationId: this.organizationId,
        documentType: params.type,
        context: params.context,
      },
    });

    if (error) throw new Error(`Gemini generateDocument failed: ${error.message}`);

    return {
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: data.model,
      provider: this.id,
    };
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const prompt = JSON.stringify(messages);

    const { data, error } = await supabase.functions.invoke("ai-generate", {
      body: {
        prompt,
        provider: this.id,
        model: this.model,
        organizationId: this.organizationId,
      },
    });

    if (error) throw new Error(`Gemini chat failed: ${error.message}`);

    return {
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: data.model,
    };
  }

  async getModels(): Promise<LLMModel[]> {
    return GEMINI_MODELS;
  }

  private buildDocumentPrompt(params: DocumentGenerationParams): string {
    const ctx = params.context;
    const parts = [
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
    return parts.filter(Boolean).join("\n");
  }
}
