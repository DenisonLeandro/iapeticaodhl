// =============================================================================
// AI / LLM Provider Types
// Story 2.1 — LLM Provider Abstraction Layer
// =============================================================================

/** Supported LLM provider identifiers */
export type LLMProviderId = "lovable" | "openai" | "gemini" | "claude";

/** Legal document types */
export type DocumentType =
  | "petition"
  | "contestation"
  | "reply"
  | "counterclaim"
  | "appeal"
  | "injunction_appeal"
  | "internal_appeal"
  | "declaration_objection"
  | "special_appeal"
  | "extraordinary_appeal"
  | "contract"
  | "notification"
  | "requirement"
  | "opinion"
  | "power_of_attorney"
  | "final_arguments"
  | "simple_petition"
  | "other";

/** Document lifecycle statuses */
export type DocumentStatus = "draft" | "review" | "approved" | "signed";

/** Chat message roles */
export type ChatRole = "system" | "user" | "assistant";

// ---------------------------------------------------------------------------
// Document Type Metadata
// ---------------------------------------------------------------------------

export type DocumentCategory = "peticoes" | "recursos" | "contratos" | "extrajudiciais" | "outros";

export interface DocumentTypeInfo {
  type: DocumentType;
  label: string;
  description: string;
  category: DocumentCategory;
}

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, { label: string; color: string }> = {
  peticoes: { label: "Petições", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  recursos: { label: "Recursos", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  contratos: { label: "Contratos", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  extrajudiciais: { label: "Extrajudiciais", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  outros: { label: "Outros", color: "bg-muted text-muted-foreground border-border" },
};

export const ALL_DOCUMENT_TYPES: DocumentTypeInfo[] = [
  // Petições
  { type: "petition", label: "Petição Inicial", description: "Peça inaugural de ação judicial com pedidos e fundamentação (Art. 319 CPC)", category: "peticoes" },
  { type: "contestation", label: "Contestação", description: "Resposta do réu com preliminares e impugnação dos fatos", category: "peticoes" },
  { type: "reply", label: "Réplica", description: "Manifestação do autor sobre a contestação do réu", category: "peticoes" },
  { type: "counterclaim", label: "Reconvenção", description: "Ação do réu contra o autor dentro do mesmo processo", category: "peticoes" },
  // Recursos
  { type: "appeal", label: "Apelação", description: "Recurso contra sentença de primeiro grau", category: "recursos" },
  { type: "injunction_appeal", label: "Agravo de Instrumento", description: "Recurso contra decisão interlocutória (Art. 1.015 CPC)", category: "recursos" },
  { type: "internal_appeal", label: "Agravo Interno", description: "Recurso contra decisão monocrática do relator", category: "recursos" },
  { type: "declaration_objection", label: "Embargos de Declaração", description: "Recurso para sanar obscuridade, contradição ou omissão", category: "recursos" },
  { type: "special_appeal", label: "Recurso Especial (REsp)", description: "Recurso ao STJ por violação de lei federal", category: "recursos" },
  { type: "extraordinary_appeal", label: "Recurso Extraordinário (RExt)", description: "Recurso ao STF por violação constitucional", category: "recursos" },
  // Contratos
  { type: "contract", label: "Contrato", description: "Instrumento contratual com cláusulas e condições configuráveis", category: "contratos" },
  // Extrajudiciais
  { type: "notification", label: "Notificação Extrajudicial", description: "Comunicação formal fora do âmbito judicial", category: "extrajudiciais" },
  { type: "requirement", label: "Requerimento", description: "Pedido administrativo ou requerimento formal", category: "extrajudiciais" },
  // Outros
  { type: "final_arguments", label: "Alegações Finais / Memoriais", description: "Peça conclusiva com síntese de fatos e direito", category: "outros" },
  { type: "simple_petition", label: "Petição Simples", description: "Petição intercorrente para juntada, manifestação, etc.", category: "outros" },
  { type: "opinion", label: "Parecer Jurídico", description: "Análise técnica e opinativa sobre questão de direito", category: "outros" },
  { type: "power_of_attorney", label: "Procuração", description: "Instrumento de mandato para representação legal", category: "outros" },
  { type: "other", label: "Outro", description: "Outros tipos de documentos jurídicos", category: "outros" },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = Object.fromEntries(
  ALL_DOCUMENT_TYPES.map((d) => [d.type, d.label])
) as Record<DocumentType, string>;

// ---------------------------------------------------------------------------
// LLM Model
// ---------------------------------------------------------------------------

export interface LLMModel {
  id: string;
  name: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

// ---------------------------------------------------------------------------
// Document Generation
// ---------------------------------------------------------------------------

export interface DocumentGenerationContext {
  client?: string;
  case?: string;
  facts?: string;
  legal_basis?: string;
  court?: string;
  additional_instructions?: string;
  [key: string]: string | undefined;
}

export interface DocumentGenerationParams {
  type: DocumentType;
  context: DocumentGenerationContext;
  template?: string;
  language?: string;
}

export interface GeneratedDocument {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  provider: LLMProviderId;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
}

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface LLMProvider {
  id: LLMProviderId;
  name: string;
  generateDocument(params: DocumentGenerationParams): Promise<GeneratedDocument>;
  chat(messages: ChatMessage[]): Promise<ChatResponse>;
  getModels(): Promise<LLMModel[]>;
}

// ---------------------------------------------------------------------------
// Provider Configuration
// ---------------------------------------------------------------------------

export interface LLMProviderConfig {
  provider: LLMProviderId;
  model: string;
  fallbackProviders?: LLMProviderId[];
}

// ---------------------------------------------------------------------------
// AI Usage Log
// ---------------------------------------------------------------------------

export interface AIUsageLogEntry {
  id: string;
  organization_id: string;
  profile_id: string;
  provider: LLMProviderId;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost_estimated: number;
  document_id: string | null;
  prompt_summary: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Document (mapped to documents table)
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  organization_id: string;
  case_id: string | null;
  client_id: string | null;
  type: DocumentType;
  title: string;
  content: string;
  llm_provider: LLMProviderId;
  llm_model: string;
  prompt_used: string;
  tokens_used: number;
  status: DocumentStatus;
  storage_path: string | null;
  created_at: string;
  created_by: string;
}

// ---------------------------------------------------------------------------
// Edge Function request / response
// ---------------------------------------------------------------------------

export interface AIGenerateRequest {
  prompt: string;
  provider: LLMProviderId;
  model: string;
  organizationId: string;
  documentType?: DocumentType;
  context?: DocumentGenerationContext;
  systemPrompt?: string;
}

export interface AIGenerateResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  provider: LLMProviderId;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AllProvidersFailedError extends Error {
  public readonly attempts: Array<{ provider: LLMProviderId; error: string }>;

  constructor(attempts: Array<{ provider: LLMProviderId; error: string }>) {
    super(
      `All LLM providers failed: ${attempts.map((a) => `${a.provider}: ${a.error}`).join("; ")}`,
    );
    this.name = "AllProvidersFailedError";
    this.attempts = attempts;
  }
}
