// =============================================================================
// PR-4.5A — Tipos compartilhados do Playbook Jurídico (edge functions).
// Mesma forma dos tipos do frontend (src/types/legalPlaybook.ts).
// =============================================================================

export type PlaybookSeverity =
  | "risco_alto"
  | "atencao"
  | "pendencia_documental"
  | "sugestao_estrategica";

export type PlaybookApplicability = "always" | "if_claim_present" | "optional";
export type PlaybookDocImportance = "obrigatorio" | "recomendado" | "se_aplicavel";

export interface PlaybookRequiredItem {
  key: string;
  title: string;
  required: boolean;
  applicability?: PlaybookApplicability;
  keywords?: string[];
  default_text?: string;
  placement?: string;
  severity_if_missing?: PlaybookSeverity;
}

export interface PlaybookDocumentItem {
  key: string;
  label: string;
  importance: PlaybookDocImportance;
  keywords?: string[];
  observation?: string;
  severity_if_missing?: PlaybookSeverity;
}

export interface PlaybookSensitiveThesis {
  key: string;
  label: string;
  warning: string;
  required_marker?: string;
  keywords?: string[];
  severity?: PlaybookSeverity;
}

export interface PlaybookChecklistItem {
  key: string;
  label: string;
  required: boolean;
  severity?: PlaybookSeverity;
}

export interface PlaybookConfig {
  required_blocks?: PlaybookRequiredItem[];
  required_requests?: PlaybookRequiredItem[];
  document_requests?: PlaybookDocumentItem[];
  sensitive_theses?: PlaybookSensitiveThesis[];
  review_checklist?: PlaybookChecklistItem[];
  drafting_instructions?: string[];
}

export interface LegalPlaybook {
  id: string;
  organization_id: string;
  name: string;
  legal_area: string;
  document_type: string;
  case_subtype: string | null;
  description: string | null;
  is_active: boolean;
  version: number;
  config: PlaybookConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PlaybookComplianceStatus =
  | "aprovado_para_revisao"
  | "revisar_antes"
  | "incompleto"
  | "risco_alto";

export interface ComplianceMissing {
  key: string;
  title: string;
  severity: PlaybookSeverity;
  reason: string;
  suggestion?: string;
  kind: "block" | "request" | "document" | "thesis";
}

export interface ComplianceResult {
  score: number;
  status: PlaybookComplianceStatus;
  missing_blocks: ComplianceMissing[];
  missing_requests: ComplianceMissing[];
  missing_documents: ComplianceMissing[];
  sensitive_alerts: ComplianceMissing[];
  passed_items: Array<{ key: string; title: string; kind: string }>;
  checked_at: string;
}
