export type LegalTemplateStatus = "active" | "inactive" | "in_review";
export type LegalTemplateAnalysisStatus = "pending" | "processing" | "done" | "error";

export interface LegalTemplate {
  id: string;
  organization_id: string;
  created_by: string | null;
  updated_by: string | null;
  name: string;
  description: string | null;
  internal_notes: string | null;
  legal_area: string | null;
  piece_type: string | null;
  main_topic: string | null;
  subtopic: string | null;
  represented_party: string | null;
  procedural_stage: string | null;
  status: LegalTemplateStatus;
  file_name: string | null;
  file_path: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  extracted_text: string | null;
  structure_summary: string | null;
  style_summary: string | null;
  standard_sections: string[] | null;
  topic_structure: Array<{ section: string; purpose: string }> | null;
  writing_patterns: Record<string, string> | null;
  request_patterns: string[] | null;
  risk_notes: string[] | null;
  usage_guidelines: string | null;
  analysis_status: LegalTemplateAnalysisStatus;
  analysis_error: string | null;
  analysis_model: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LEGAL_AREAS = [
  "Trabalhista",
  "Previdenciário",
  "Cível",
  "Consumidor",
  "Família",
  "Empresarial",
  "Contratos",
  "Bancário",
  "Imobiliário",
  "Cobrança/Execução",
  "Responsabilidade civil",
  "Acidente",
  "Outra",
] as const;

export const PIECE_TYPES = [
  "Petição inicial",
  "Contestação",
  "Impugnação",
  "Manifestação",
  "Recurso ordinário",
  "Agravo de petição",
  "Embargos",
  "Razões finais",
  "Parecer",
  "Notificação extrajudicial",
  "Contrato",
  "Outro",
] as const;

export const REPRESENTED_PARTIES = [
  "Autor/Requerente/Reclamante",
  "Réu/Requerido/Reclamado",
  "Exequente",
  "Executado",
  "Recorrente",
  "Recorrido",
  "Interessado",
  "Empresa",
  "Pessoa física",
  "Outro",
] as const;

export const PROCEDURAL_STAGES = [
  "Pré-processual",
  "Conhecimento",
  "Contestação/defesa",
  "Instrução",
  "Razões finais",
  "Sentença",
  "Recurso",
  "Execução",
  "Cumprimento de sentença",
  "Administrativo",
  "Extrajudicial",
  "Outro",
] as const;
