// =============================================================================
// PR-4.3A — Tipos e schema da Ficha Inteligente Universal do Caso
// =============================================================================
import { z } from "zod";

export const LEGAL_AREA_OPTIONS = [
  { value: "nao_sei", label: "Não sei / IA sugerir" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "civel", label: "Cível" },
  { value: "consumidor", label: "Consumidor" },
  { value: "familia", label: "Família" },
  { value: "empresarial", label: "Empresarial" },
  { value: "contratos", label: "Contratos" },
  { value: "bancario", label: "Bancário" },
  { value: "imobiliario", label: "Imobiliário" },
  { value: "cobranca_execucao", label: "Cobrança/Execução" },
  { value: "responsabilidade_civil", label: "Responsabilidade civil" },
  { value: "acidente", label: "Acidente" },
  { value: "outra", label: "Outra" },
] as const;

export const REPRESENTED_PARTY_OPTIONS = [
  { value: "autor", label: "Autor/Requerente/Reclamante" },
  { value: "reu", label: "Réu/Requerido/Reclamado" },
  { value: "interessado", label: "Interessado" },
  { value: "empresa", label: "Empresa" },
  { value: "pessoa_fisica", label: "Pessoa física" },
  { value: "nao_definido", label: "Não definido" },
] as const;

export const CLIENT_GOAL_OPTIONS = [
  { value: "receber_valores", label: "Receber valores" },
  { value: "cancelar_cobranca", label: "Cancelar cobrança" },
  { value: "obter_beneficio", label: "Obter benefício" },
  { value: "reintegrar_trabalho", label: "Reintegrar ao trabalho" },
  { value: "reconhecer_direito", label: "Reconhecer direito" },
  { value: "resolver_conflito_familiar", label: "Resolver conflito familiar" },
  { value: "cobrar_divida", label: "Cobrar dívida" },
  { value: "defender_em_processo", label: "Defender-se em processo" },
  { value: "revisar_contrato", label: "Revisar contrato" },
  { value: "obter_indenizacao", label: "Obter indenização" },
  { value: "apenas_orientacao", label: "Apenas orientação" },
  { value: "outro", label: "Outro" },
] as const;

export const URGENCY_OPTIONS = [
  { value: "sem_urgencia", label: "Sem urgência aparente" },
  { value: "urgente", label: "Urgente" },
  { value: "prazo_processual", label: "Existe prazo processual" },
  { value: "audiencia_proxima", label: "Existe audiência próxima" },
  { value: "risco_prescricao", label: "Risco de prescrição/decadência" },
  { value: "risco_bloqueio", label: "Risco de bloqueio/perda de direito" },
  { value: "nao_informado", label: "Não informado" },
] as const;

// =============================================================================
// Schema
// =============================================================================
export const caseIntakeFormSchema = z.object({
  legal_area: z.string().max(60).nullable().optional(),
  legal_area_other: z.string().max(120).nullable().optional(),
  represented_party: z.string().max(60).nullable().optional(),
  opposing_party: z.string().max(500).nullable().optional(),

  problem_summary: z.string().max(2000).nullable().optional(),
  client_story: z.string().max(20000).nullable().optional(),
  client_goal: z.string().max(60).nullable().optional(),
  client_goal_other: z.string().max(500).nullable().optional(),

  urgency: z.string().max(60).nullable().optional(),
  deadline_date: z.string().nullable().optional(),

  facts_period: z.string().max(500).nullable().optional(),
  facts_location: z.string().max(500).nullable().optional(),
  amount_involved: z.string().max(120).nullable().optional(),

  has_existing_lawsuit: z.boolean().nullable().optional(),
  existing_case_number: z.string().max(60).nullable().optional(),

  existing_documents: z.string().max(5000).nullable().optional(),
  uploaded_documents_notes: z.string().max(5000).nullable().optional(),
  missing_documents: z.string().max(5000).nullable().optional(),
  witnesses: z.string().max(5000).nullable().optional(),
  other_evidence: z.string().max(5000).nullable().optional(),

  internal_notes: z.string().max(5000).nullable().optional(),
});

export type CaseIntakeFormValues = z.infer<typeof caseIntakeFormSchema>;

// =============================================================================
// Row + sugestões
// =============================================================================
export interface CaseIntakeAISuggestion {
  suggested_area?: string;
  suggested_subtype?: string;
  missing_information?: string[];
  complementary_questions?: string[];
  recommended_documents?: string[];
  initial_risks?: string[];
  next_steps?: string[];
}

export interface CaseIntakeForm extends CaseIntakeFormValues {
  id: string;
  case_id: string;
  organization_id: string;
  client_id: string | null;
  ai_suggested_area: string | null;
  ai_suggested_subtype: string | null;
  ai_missing_information: string[] | null;
  ai_complementary_questions: string[] | null;
  ai_recommended_documents: string[] | null;
  ai_initial_risks: string[] | null;
  ai_next_steps: string[] | null;
  ai_suggested_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Status calculado no frontend
// =============================================================================
export type CaseIntakeStatus = "empty" | "partial" | "complete";

export function computeIntakeStatus(v: Partial<CaseIntakeFormValues> | null | undefined): CaseIntakeStatus {
  if (!v) return "empty";
  const has = (s: string | null | undefined) => !!(s && s.trim().length > 0);
  const hasSummary = has(v.problem_summary);
  const hasStory = has(v.client_story);
  const hasGoal = has(v.client_goal);
  if (!hasSummary && !hasStory && !hasGoal) return "empty";

  const completeFields = [
    has(v.legal_area),
    has(v.represented_party),
    hasSummary,
    hasStory,
    hasGoal,
    has(v.urgency),
    has(v.existing_documents),
  ];
  if (completeFields.every(Boolean)) return "complete";
  return "partial";
}

export const INTAKE_STATUS_LABEL: Record<CaseIntakeStatus, string> = {
  empty: "Ficha não preenchida",
  partial: "Ficha parcial",
  complete: "Ficha preenchida",
};
