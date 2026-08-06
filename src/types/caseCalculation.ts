import {
  deriveCalculationStatus,
  effectiveItemValue,
  isDraftInjectableItem,
  computeCaseValue,
  CALCULATION_STATUS_LABEL,
  type CalculationStatus,
} from "@shared/completeness.ts";

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
  // PR-COMPLETUDE 1 — valor definido pelo advogado (nunca sobrescreve o do sistema)
  manual_value: number | null;
  manual_value_confirmed: boolean;
  manual_value_confirmed_at: string | null;
  manual_value_confirmed_by: string | null;
  manual_value_note: string | null;
  system_value_confirmed: boolean;
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
 * O status por pedido é DERIVADO em runtime (nunca persistido) — evita
 * divergência entre estado gravado e estado real. Fonte única compartilhada
 * com as Edge Functions.
 */
export {
  deriveCalculationStatus,
  effectiveItemValue,
  computeCaseValue,
  CALCULATION_STATUS_LABEL,
};
export type { CalculationStatus };

/** Gate de injeção na peça, definido pelo motor determinístico. */
export function isDraftInjectable(item: CaseCalculationItem): boolean {
  return isDraftInjectableItem(item);
}
