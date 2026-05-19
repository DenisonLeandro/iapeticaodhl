import { z } from "zod";

// =============================================================================
// Types
// =============================================================================

export type CaseStatus = "active" | "archived" | "closed";

export type MovementType =
  | "peticao"
  | "despacho"
  | "decisao"
  | "sentenca"
  | "audiencia"
  | "recurso"
  | "outro";

export interface Case {
  id: string;
  organization_id: string;
  client_id: string | null;
  case_number: string;
  court: string;
  branch: string | null;
  subject: string | null;
  status: CaseStatus;
  opposing_party: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

/** Case row with joined client and lawyer names for list display */
export interface CaseWithRelations extends Case {
  client_name: string | null;
  lawyer_name: string | null;
}

export interface CaseMovement {
  id: string;
  organization_id: string;
  case_id: string;
  movement_date: string;
  type: MovementType;
  description: string;
  created_by: string | null;
  created_at: string;
  creator_name?: string | null;
}

export interface CaseDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  created_by: string;
  creator_name?: string | null;
}

export interface CaseDetail extends CaseWithRelations {
  movements: CaseMovement[];
  documents: CaseDocument[];
}

export interface CaseFilters {
  search?: string;
  status?: CaseStatus | "";
  court?: string;
  assigned_to?: string;
  page?: number;
  pageSize?: number;
}

// =============================================================================
// Constants
// =============================================================================

export const COURT_OPTIONS = [
  { value: "STF", label: "STF" },
  { value: "STJ", label: "STJ" },
  { value: "TST", label: "TST" },
  { value: "TSE", label: "TSE" },
  { value: "STM", label: "STM" },
  { value: "TJPE", label: "TJPE" },
  { value: "Outro", label: "Outro" },
] as const;

export const CASE_STATUS_OPTIONS = [
  { value: "active", label: "Ativo" },
  { value: "archived", label: "Arquivado" },
  { value: "closed", label: "Encerrado" },
] as const;

export const STATUS_BADGE_COLORS: Record<CaseStatus, string> = {
  active: "bg-green-600 text-white hover:bg-green-600/80 border-transparent",
  archived: "bg-yellow-500 text-black hover:bg-yellow-500/80 border-transparent",
  closed: "bg-gray-500 text-white hover:bg-gray-500/80 border-transparent",
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
  closed: "Encerrado",
};

export const MOVEMENT_TYPE_OPTIONS = [
  { value: "peticao", label: "Petição" },
  { value: "despacho", label: "Despacho" },
  { value: "decisao", label: "Decisão" },
  { value: "sentenca", label: "Sentença" },
  { value: "audiencia", label: "Audiência" },
  { value: "recurso", label: "Recurso" },
  { value: "outro", label: "Outro" },
] as const;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  peticao: "Petição",
  despacho: "Despacho",
  decisao: "Decisão",
  sentenca: "Sentença",
  audiencia: "Audiência",
  recurso: "Recurso",
  outro: "Outro",
};

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  peticao: "bg-green-500 text-white hover:bg-green-500/80 border-transparent",
  despacho: "bg-blue-500 text-white hover:bg-blue-500/80 border-transparent",
  decisao: "bg-indigo-500 text-white hover:bg-indigo-500/80 border-transparent",
  sentenca: "bg-purple-500 text-white hover:bg-purple-500/80 border-transparent",
  audiencia: "bg-yellow-500 text-black hover:bg-yellow-500/80 border-transparent",
  recurso: "bg-orange-500 text-white hover:bg-orange-500/80 border-transparent",
  outro: "bg-gray-500 text-white hover:bg-gray-500/80 border-transparent",
};

export const MOVEMENT_DOT_COLORS: Record<MovementType, string> = {
  peticao: "bg-green-500",
  despacho: "bg-blue-500",
  decisao: "bg-indigo-500",
  sentenca: "bg-purple-500",
  audiencia: "bg-yellow-500",
  recurso: "bg-orange-500",
  outro: "bg-gray-500",
};

// =============================================================================
// Zod Schemas
// =============================================================================

export const caseFormSchema = z.object({
  case_number: z
    .string()
    .min(1, "Número do processo é obrigatório"),
  court: z
    .string()
    .min(1, "Tribunal é obrigatório"),
  branch: z.string().optional(),
  subject: z.string().optional(),
  opposing_party: z.string().optional(),
  client_id: z.string().optional(),
  assigned_to: z.string().optional(),
  status: z.enum(["active", "archived", "closed"]).default("active"),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

export const movementFormSchema = z.object({
  type: z.enum(["peticao", "despacho", "decisao", "sentenca", "audiencia", "recurso", "outro"], {
    required_error: "Tipo de movimentação é obrigatório",
  }),
  movement_date: z.string().min(1, "Data da movimentação é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
});

export type MovementFormValues = z.infer<typeof movementFormSchema>;
