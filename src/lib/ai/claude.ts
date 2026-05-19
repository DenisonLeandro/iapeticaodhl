// =============================================================================
// Claude Adapter — calls Edge Function, does NOT call Anthropic API directly
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

const CLAUDE_MODELS: LLMModel[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    maxTokens: 200_000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    maxTokens: 200_000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
  },
];

export class ClaudeProvider implements LLMProvider {
  readonly id = "claude" as const;
  readonly name = "Anthropic Claude";

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

    if (error) throw new Error(`Claude generateDocument failed: ${error.message}`);

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

    if (error) throw new Error(`Claude chat failed: ${error.message}`);

    return {
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: data.model,
    };
  }

  async getModels(): Promise<LLMModel[]> {
    return CLAUDE_MODELS;
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
