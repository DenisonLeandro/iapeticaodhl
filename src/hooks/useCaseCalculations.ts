import { useQuery } from "@tanstack/react-query";
import { getCalculationByDraft } from "@/services/caseCalculations";

export function useCalculationByDraft(draftId: string | undefined) {
  return useQuery({
    queryKey: ["case_calculations", "by_draft", draftId],
    queryFn: () => getCalculationByDraft(draftId!),
    enabled: !!draftId,
  });
}
