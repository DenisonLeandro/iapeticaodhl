import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCalculationByDraft,
  saveManualValue,
  confirmManualValue,
  confirmSystemValue,
} from "@/services/caseCalculations";

export function useCalculationByDraft(draftId: string | undefined) {
  return useQuery({
    queryKey: ["case_calculations", "by_draft", draftId],
    queryFn: () => getCalculationByDraft(draftId!),
    enabled: !!draftId,
  });
}

type ManualInput =
  | { kind: "manual_value"; itemId: string; value: number | null; note?: string | null }
  | { kind: "confirm_manual"; itemId: string; confirmed: boolean }
  | { kind: "confirm_system"; itemId: string; confirmed: boolean };

export function useCalculationItemMutation(draftId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualInput) => {
      if (input.kind === "manual_value") {
        await saveManualValue(input.itemId, { manual_value: input.value, manual_value_note: input.note ?? null });
      } else if (input.kind === "confirm_manual") {
        await confirmManualValue(input.itemId, input.confirmed);
      } else {
        await confirmSystemValue(input.itemId, input.confirmed);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case_calculations", "by_draft", draftId] });
    },
  });
}
