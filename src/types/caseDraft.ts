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
  created_at: string;
  updated_at: string;
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
  created_at: string;
}
