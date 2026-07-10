// =============================================================================
// PR-4.1A — Roteador de modelos por tarefa
// Fase 2 · Bloco 1 — adiciona selectModelForTask(task, {economyMode, highPrecision})
// =============================================================================
// selectAIModelForTask(task) permanece intacto para compat. Novas edge functions
// devem preferir selectModelForTask, que respeita o "modo econômico" da org e
// o pedido explícito do usuário por "alta precisão".
// =============================================================================

export type AITaskType =
  | "analyze_case"
  | "summarize_documents"
  | "identify_risks"
  | "suggest_next_action"
  | "premium_review_future"
  | "draft_petition_future"
  | "review_petition_future"
  | "transcribe_audio_future"
  | "audio_transcription_future"
  | "speaker_diarization_future"
  | "analyze_meeting_transcript_future"
  | "hearing_analysis_future"
  | "video_understanding_future"
  | "legal_template_analysis"
  | "legal_draft_generation"
  | "legal_intent_classification"
  // Fase 2 · Bloco 1
  | "case_chat"
  | "ai_generate"
  | "plan_draft_chapters"
  | "generate_draft_section"
  // Fase 2 · Bloco 2 — chaves novas para logging padronizado
  | "review_draft"
  | "senior_review"
  | "apply_senior_review"
  | "build_claim_map"
  | "classify_document"
  | "suggest_case_intake"
  | "document_chat"
  | "pdf_analyze"
  | "ocr_extract"
  | "voice_extract"
  | "voice_extract_client"
  | "embed_chunks"
  | "extract_text_multimodal";

export interface AIModelChoice {
  provider: "lovable-ai";
  model: string;
  params?: Record<string, unknown>;
}

const STABLE_TEXT_MODEL = "google/gemini-2.5-flash";
const STRONG_TEXT_MODEL = "google/gemini-2.5-pro";

const TASK_MAP: Record<AITaskType, AIModelChoice> = {
  analyze_case: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  summarize_documents: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  identify_risks: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  suggest_next_action: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  premium_review_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  draft_petition_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  review_petition_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  transcribe_audio_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  audio_transcription_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  speaker_diarization_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  analyze_meeting_transcript_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  hearing_analysis_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  video_understanding_future: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  legal_template_analysis: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  legal_draft_generation: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  legal_intent_classification: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  case_chat: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  ai_generate: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  plan_draft_chapters: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  generate_draft_section: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  // Fase 2 · Bloco 2 — críticas jurídicas mantêm modelo forte por padrão.
  review_draft: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  senior_review: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  apply_senior_review: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  build_claim_map: { provider: "lovable-ai", model: STRONG_TEXT_MODEL },
  classify_document: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  suggest_case_intake: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  document_chat: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  pdf_analyze: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  ocr_extract: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  voice_extract: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  voice_extract_client: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  embed_chunks: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
  extract_text_multimodal: { provider: "lovable-ai", model: STABLE_TEXT_MODEL },
};

export function selectAIModelForTask(task: AITaskType): AIModelChoice {
  return TASK_MAP[task] ?? { provider: "lovable-ai", model: STABLE_TEXT_MODEL };
}

// -----------------------------------------------------------------------------
// Fase 2 · Bloco 1 — selectModelForTask consciente de custo
// -----------------------------------------------------------------------------
// Regras:
//   - highPrecision=true       => sempre modelo forte (STRONG_TEXT_MODEL)
//   - economyMode=true         => modelo econômico (STABLE_TEXT_MODEL) para
//                                 tarefas simples/intermediárias listadas em
//                                 ECONOMY_OVERRIDES. Tarefas críticas mantêm
//                                 o modelo mapeado em TASK_MAP.
//   - economyMode=false        => usa o modelo mapeado em TASK_MAP.
// -----------------------------------------------------------------------------

/**
 * Tarefas onde o "modo econômico" força FLASH mesmo quando o TASK_MAP escolhe
 * pro. Mantido pequeno de propósito nesta fase — só o que já foi validado.
 */
const ECONOMY_OVERRIDES: Set<AITaskType> = new Set<AITaskType>([
  "plan_draft_chapters",
  "generate_draft_section",
  "analyze_case",
  "case_chat",
  "ai_generate",
  "legal_intent_classification",
  "summarize_documents",
  "identify_risks",
  "suggest_next_action",
]);

/**
 * Tarefas críticas: NUNCA rebaixadas pelo modo econômico. Alta precisão
 * também as mantém no modelo forte (que já é o default).
 */
const ALWAYS_STRONG: Set<AITaskType> = new Set<AITaskType>([
  "legal_template_analysis",
  // Fase 2 · Bloco 2 — críticas jurídicas nunca rebaixadas.
  "review_draft",
  "senior_review",
  "apply_senior_review",
  "build_claim_map",
]);

export interface SelectModelOptions {
  economyMode: boolean;
  highPrecision?: boolean;
}

export function selectModelForTask(
  task: AITaskType,
  opts: SelectModelOptions,
): AIModelChoice {
  const base = selectAIModelForTask(task);

  // Precedência 1: highPrecision explícito → forte.
  if (opts.highPrecision) {
    return { provider: "lovable-ai", model: STRONG_TEXT_MODEL };
  }

  // Precedência 2: tarefas críticas sempre fortes.
  if (ALWAYS_STRONG.has(task)) {
    return { provider: "lovable-ai", model: STRONG_TEXT_MODEL };
  }

  // Precedência 3: modo econômico rebaixa tarefas listadas.
  if (opts.economyMode && ECONOMY_OVERRIDES.has(task)) {
    return { provider: "lovable-ai", model: STABLE_TEXT_MODEL };
  }

  // Default: modelo mapeado em TASK_MAP.
  return base;
}
