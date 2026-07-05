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
