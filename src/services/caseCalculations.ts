import { supabase } from "@/lib/backend/client";
import type { CaseCalculation, CaseCalculationItem } from "@/types/caseCalculation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getCalculationByDraft(
  draftId: string,
): Promise<{ calculation: CaseCalculation; items: CaseCalculationItem[] } | null> {
  const { data: calc, error } = await db
    .from("case_calculations")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!calc) return null;
  const { data: items, error: iErr } = await db
    .from("case_calculation_items")
    .select("*")
    .eq("calculation_id", calc.id)
    .order("sort_order", { ascending: true });
  if (iErr) throw new Error(iErr.message);
  return { calculation: calc as CaseCalculation, items: (items ?? []) as CaseCalculationItem[] };
}

/**
 * PR-COMPLETUDE 1 — grava/edita o valor definido pelo advogado.
 * Nunca altera `estimated_value` (valor do sistema). Alterar o valor manual
 * invalida a confirmação anterior (regra garantida também no banco).
 */
export async function saveManualValue(
  itemId: string,
  input: { manual_value: number | null; manual_value_note?: string | null },
): Promise<void> {
  const { error } = await db
    .from("case_calculation_items")
    .update({
      manual_value: input.manual_value,
      manual_value_note: input.manual_value_note ?? null,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

/** Ato explícito do advogado confirmando o valor que ele mesmo definiu. */
export async function confirmManualValue(itemId: string, confirmed: boolean): Promise<void> {
  const { error } = await db
    .from("case_calculation_items")
    .update({ manual_value_confirmed: confirmed })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

/** Ato explícito do advogado confirmando o valor produzido pelo motor. */
export async function confirmSystemValue(itemId: string, confirmed: boolean): Promise<void> {
  const { error } = await db
    .from("case_calculation_items")
    .update({ system_value_confirmed: confirmed })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}
