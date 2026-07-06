// =============================================================================
// PR-4.4B — Tipos de minutas geradas (case_drafts)
// =============================================================================

export type CaseDraftStatus = "draft" | "reviewed" | "approved" | "archived";

export type CaseDraftType =
  | "initial_petition"
  | "manifestation"
  | "extrajudicial_notice"
  | "opinion"
  | "other";

export const CASE_DRAFT_TYPE_OPTIONS: Array<{
  value: CaseDraftType;
  label: string;
}> = [
  { value: "initial_petition", label: "Petição inicial" },
  { value: "manifestation", label: "Manifestação simples" },
  { value: "extrajudicial_notice", label: "Notificação extrajudicial" },
  { value: "opinion", label: "Parecer/nota técnica" },
  { value: "other", label: "Outro" },
];

export const CASE_DRAFT_TYPE_LABEL: Record<CaseDraftType, string> = {
  initial_petition: "Petição inicial",
  manifestation: "Manifestação simples",
  extrajudicial_notice: "Notificação extrajudicial",
  opinion: "Parecer/nota técnica",
  other: "Outro",
};

export const TONE_OPTIONS = [
  { value: "template_default", label: "Padrão do modelo selecionado" },
  { value: "objective", label: "Técnico e objetivo" },
  { value: "detailed", label: "Detalhado e fundamentado" },
  { value: "persuasive", label: "Mais persuasivo" },
  { value: "simple", label: "Mais simples e direto" },
] as const;

export interface CaseDraftSourcesUsed {
  intake?: boolean;
  analysis?: boolean;
  documents?: boolean;
  template?: boolean;
  chat_history?: boolean;
}

export interface CaseDraftClaimTopic {
  topic: string;
  include: boolean;
  factual_basis?: string;
  documentary_basis?: string;
  legal_basis?: string[];
  main_request?: string;
  alternative_request?: string;
  reflexes?: string[];
  evidence_needed?: string[];
  risk?: string;
  status?: "include" | "include_with_confirmation" | "exclude" | string;
}

export interface CaseDraftClaimMap {
  topics: CaseDraftClaimTopic[];
}

export interface CaseDraftQualityReport {
  is_too_short?: boolean;
  matches_template_depth?: boolean;
  has_preliminaries?: boolean;
  has_factual_section?: boolean;
  has_legal_basis_per_topic?: boolean;
  has_detailed_requests?: boolean;
  has_reflexes?: boolean;
  has_successive_requests_when_applicable?: boolean;
  has_burden_of_proof_when_applicable?: boolean;
  has_points_to_confirm?: boolean;
  avoids_copying_template_facts?: boolean;
  missing_topics?: string[];
  weak_topics?: string[];
  quality_alerts?: string[];
  needs_rewrite?: boolean;
  rewrite_applied?: boolean;
  jurisprudence_replacements?: number;
  jurisprudence_vague_expressions?: number;
  sensitive_alerts?: Array<{ id: string; severity: "high" | "medium" | "low"; message: string }>;
  findings?: Array<{
    severidade: "risco_alto" | "atencao" | "pendencia_documental" | "sugestao_estrategica" | string;
    topico: string;
    motivo: string;
    sugestao: string;
  }>;
}


export type CaseDraftGenerationDepth =
  | "quick_draft"
  | "standard"
  | "professional_full"
  | "protocol_ready_after_review";

export interface CaseDraft {
  id: string;
  organization_id: string;
  case_id: string;
  created_by: string | null;
  updated_by: string | null;
  title: string | null;
  draft_type: CaseDraftType | string;
  status: CaseDraftStatus;
  content: string;
  objective: string | null;
  tone: string | null;
  additional_instructions: string | null;
  template_id: string | null;
  sources_used: CaseDraftSourcesUsed | null;
  missing_information: string[] | null;
  warnings: string[] | null;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_estimate: number | null;
  claim_map: CaseDraftClaimMap | null;
  quality_report: CaseDraftQualityReport | null;
  generation_depth: CaseDraftGenerationDepth | string | null;
  quality_status?: "not_requested" | "pending" | "running" | "done" | "failed" | string | null;
  senior_review?: Record<string, unknown> | null;
  senior_review_status?: "not_requested" | "pending" | "running" | "done" | "failed" | string | null;
  senior_review_at?: string | null;
  calculation_id?: string | null;

  // PR-4.5A — Playbook aplicado à geração
  playbook_id?: string | null;
  playbook_snapshot?: unknown | null;
  playbook_compliance?: unknown | null;
  playbook_status?: "no_playbook_found" | "playbook_applied" | "playbook_partial" | "playbook_error" | "playbook_not_required" | string | null;

  // PR-4.5B — Revisão sênior aplicável
  senior_review_suggestions?: SeniorReviewSuggestion[] | null;
  senior_review_apply_status?: "applying" | "done" | "error" | null | string;
  senior_review_apply_error?: string | null;
  senior_review_applied_at?: string | null;

  // PR-1 (chapters foundation) — sem uso ativo no fluxo atual
  generation_mode?: "fast" | "chapters" | string | null;
  assembly_status?: "stale" | "assembled" | "failed" | null | string;
  piece_type_key?: string | null;

  created_at: string;
  updated_at: string;
}

export type CaseDraftSectionStatus =
  | "pending"
  | "generating"
  | "generated"
  | "edited"
  | "approved"
  | "skipped"
  | "failed";

export interface CaseDraftSection {
  id: string;
  organization_id: string;
  case_id: string;
  draft_id: string;
  section_key: string;
  section_label: string;
  order_index: number;
  content: string | null;
  status: CaseDraftSectionStatus | string;
  generation_prompt: Record<string, unknown> | null;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_estimate: number | null;
  quality_notes: Record<string, unknown> | null;
  last_error: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}


export type SeniorReviewSuggestionStatus = "pending" | "accepted" | "rejected" | "edited" | "applied";

export interface SeniorReviewSuggestion {
  id: string;
  titulo: string;
  descricao: string;
  fundamento_juridico?: string;
  trecho_sugerido?: string;
  local_recomendado_na_peca?: string;
  categoria?: string;
  severidade?: "risco_alto" | "atencao" | "sugestao" | string;
  status: SeniorReviewSuggestionStatus | string;
}

export interface CaseDraftVersion {
  id: string;
  organization_id: string;
  draft_id: string;
  content: string;
  source: string;
  applied_suggestion_ids: string[] | null;
  created_by: string | null;
  created_at: string;
}


export interface GenerateDraftPayload {
  case_id: string;
  draft_type: CaseDraftType;
  objective?: string;
  tone?: string;
  template_id?: string | null;
  use_intake: boolean;
  use_analysis: boolean;
  use_documents: boolean;
  use_template: boolean;
  use_chat_history: boolean;
  additional_instructions?: string;
}

export interface GenerateDraftResponse {
  draft_id: string;
  title: string;
  draft_type: string;
  content: string;
  warnings: string[];
  missing_information: string[];
  sources_used: CaseDraftSourcesUsed;
  quality_report?: CaseDraftQualityReport;
  quality_status?: "not_requested" | "pending" | "running" | "done" | "failed" | string;
  generation_depth?: CaseDraftGenerationDepth | string;
  created_at: string;
}

// PR-2 — Planejamento por capítulos (esqueleto)
export interface PlanChaptersPayload {
  case_id: string;
  draft_id?: string | null;
  piece_type_key: string; // "trabalhista_inicial" suportado neste PR
  legal_area?: string | null;
  template_id?: string | null;
  objective?: string;
  structure_instructions?: string;
  use_intake: boolean;
  use_analysis: boolean;
  use_documents: boolean;
  use_template: boolean;
}

export interface PlanChaptersResponse {
  success: true;
  draft_id: string;
  piece_type_key: string;
  sections_count: number;
}

export interface PlanChaptersUnsupported {
  success: false;
  code: "unsupported_piece_type";
  stage: "unsupported_type";
  message: string;
}

// PR-3 — Geração de conteúdo por seção
export interface GenerateDraftSectionPayload {
  draft_id: string;
  section_id: string;
  force_regenerate?: boolean;
}

export interface GenerateDraftSectionResponse {
  success: true;
  section_id: string;
  status?: string;
  skipped?: boolean;
  reason?: string;
  chars?: number;
  alerts?: number;
}

// PR-4 — Montagem determinística da petição final
export interface AssembleChaptersPayload {
  draft_id: string;
}

export interface AssembleChaptersResponse {
  success: true;
  draft_id: string;
  version_id: string;
  sections_used: number;
  chars: number;
  source: "chapters_assembled" | "chapters_reassembled" | string;
}

export interface AssembleChaptersPendingSection {
  section_key: string;
  section_label: string;
  reason: "not_generated" | "failed" | "empty_content" | "missing" | string;
  status: string;
}

export interface AssembleChaptersBlocked {
  success: false;
  code: "missing_required_sections";
  message: string;
  pending_sections: AssembleChaptersPendingSection[];
}




