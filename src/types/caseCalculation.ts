export type CalcConfidence = "high" | "medium" | "low";
export type CalcStatus = "complete" | "partial" | "pending_data";

export interface CaseCalculationItem {
  id: string;
  calculation_id: string;
  request_label: string;
  legal_basis: string | null;
  formula: string | null;
  input_data: Record<string, unknown> | null;
  assumptions: Record<string, unknown> | null;
  estimated_value: number | null;
  confidence: CalcConfidence;
  missing_fields: string[] | null;
  period: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface CaseCalculation {
  id: string;
  organization_id: string;
  case_id: string;
  draft_id: string | null;
  calculation_status: CalcStatus;
  total_estimated_value: number | null;
  assumptions: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: CaseCalculationItem[];
}

/**
 * Read the draft-injection gate flag set by the backend calc-engine.
 * Legacy items without the flag are treated as NOT injectable.
 */
export function isDraftInjectable(item: CaseCalculationItem): boolean {
  const a = (item.assumptions ?? {}) as Record<string, unknown>;
  return a._draft_injectable === true && item.estimated_value != null;
}
