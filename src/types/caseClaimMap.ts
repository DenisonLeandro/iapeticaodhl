// =============================================================================
// PR-6A — Tipos do Mapa de Pedidos e Riscos
// =============================================================================

export type ClaimApplicability = "applicable" | "not_applicable" | "uncertain";
export type ClaimConfidence = "low" | "medium" | "high";
export type ClaimRiskLevel = "low" | "medium" | "high" | "critical";
export type ClaimRecommendedAction = "include" | "exclude" | "confirm" | "warn_only";
export type ClaimLawyerDecision = "pending" | "approved" | "rejected" | "needs_more_info";
export type CaseClaimMapStatus = "draft" | "awaiting_lawyer_review" | "reviewed";

export interface ClaimMapClaim {
  id: string;
  title: string;
  category: string;
  applicability: ClaimApplicability;
  confidence: ClaimConfidence;
  risk_level: ClaimRiskLevel;
  recommended_action: ClaimRecommendedAction;
  requires_lawyer_confirmation: boolean;
  facts_supporting: string[];
  documents_supporting: string[];
  missing_documents: string[];
  legal_basis: string[];
  warnings: string[];
  should_generate_merit_section: boolean;
  should_include_in_prayer_list: boolean;
  should_include_in_final_requests: boolean;
  lawyer_decision: ClaimLawyerDecision;
  lawyer_decision_by: string | null;
  lawyer_decision_at: string | null;
  lawyer_notes: string;
}

export interface CaseClaimMap {
  id: string;
  organization_id: string;
  case_id: string;
  version: number;
  is_current: boolean;
  claims: ClaimMapClaim[];
  global_warnings: string[];
  missing_case_data: string[];
  status: CaseClaimMapStatus | string;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_estimate: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuildClaimMapPayload {
  case_id: string;
  force_regenerate?: boolean;
}

export interface BuildClaimMapResponse {
  success: true;
  claim_map: CaseClaimMap;
}

export const APPLICABILITY_LABEL: Record<ClaimApplicability, string> = {
  applicable: "Aplicável",
  not_applicable: "Não se aplica",
  uncertain: "Incerto",
};

export const CONFIDENCE_LABEL: Record<ClaimConfidence, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const RISK_LEVEL_LABEL: Record<ClaimRiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const RECOMMENDED_ACTION_LABEL: Record<ClaimRecommendedAction, string> = {
  include: "Incluir",
  exclude: "Excluir",
  confirm: "Confirmar",
  warn_only: "Apenas alerta",
};

export const CLAIM_MAP_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  awaiting_lawyer_review: "Aguardando revisão do advogado",
  reviewed: "Revisado",
};
