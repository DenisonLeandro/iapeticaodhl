// =============================================================================
// PR-4.1A — Roteador de modelos por tarefa
// =============================================================================
// Centraliza a escolha do modelo por tipo de tarefa. Permite trocar de modelo
// futuramente sem alterar as edge functions. A UI NUNCA deve consumir este
// mapa — apenas o backend.
//
// Tarefas futuras já catalogadas (resolvendo hoje para o modelo estável):
//   - analyze_case            (PR-4.1A)
//   - summarize_documents
//   - identify_risks
//   - suggest_next_action
//   - premium_review_future
//   - draft_petition_future
//   - review_petition_future
//   - transcribe_audio_future
//   - audio_transcription_future
//   - speaker_diarization_future
//   - analyze_meeting_transcript_future
//   - hearing_analysis_future
//   - video_understanding_future
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
  | "legal_draft_generation";

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
};

export function selectAIModelForTask(task: AITaskType): AIModelChoice {
  return TASK_MAP[task] ?? { provider: "lovable-ai", model: STABLE_TEXT_MODEL };
}
