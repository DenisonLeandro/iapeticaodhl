import { useQuery } from "@tanstack/react-query";
import { listCaseDraftSections } from "@/services/caseDraftSections";

const KEY = "case_draft_sections";

export function useCaseDraftSections(draftId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "list", draftId],
    queryFn: () => listCaseDraftSections(draftId!),
    enabled: !!draftId,
  });
}
