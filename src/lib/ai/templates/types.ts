// =============================================================================
// Legal Template Types
// Story 3.1 — Legal Document Templates
// =============================================================================

/** Template categories for grouping in the UI */
export type TemplateCategory = "peticao" | "recurso" | "contrato" | "outros";

/** Legal document template definition */
export interface LegalTemplate {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Display name in Portuguese */
  name: string;
  /** Short description of the document type */
  description: string;
  /** Lucide icon name for UI display */
  icon: string;
  /** Category for grouping */
  category: TemplateCategory;
  /** System prompt sent to the LLM to generate this document type */
  systemPrompt: string;
  /** Fields that must be provided by the user */
  requiredFields: string[];
  /** Ordered list of document sections */
  structure: string[];
}

/** Category metadata for UI display */
export interface TemplateCategoryInfo {
  id: TemplateCategory;
  label: string;
  description: string;
}

/** All template categories with labels */
export const TEMPLATE_CATEGORIES: TemplateCategoryInfo[] = [
  {
    id: "peticao",
    label: "Pecas Processuais",
    description: "Peticoes iniciais, replicas e alegacoes finais",
  },
  {
    id: "recurso",
    label: "Recursos",
    description: "Apelacao, agravo, embargos, REsp e RExt",
  },
  {
    id: "contrato",
    label: "Contratos",
    description: "Contratos e instrumentos particulares",
  },
  {
    id: "outros",
    label: "Outros",
    description: "Notificacoes extrajudiciais e demais documentos",
  },
];
