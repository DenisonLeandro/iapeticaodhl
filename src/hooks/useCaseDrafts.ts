import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveCaseDraft,
  generateCaseDraft,
  getCaseDraft,
  listCaseDrafts,
  updateCaseDraft,
} from "@/services/caseDrafts";
import type { CaseDraft, GenerateDraftPayload } from "@/types/caseDraft";

const KEY = "case_drafts";

export function useCaseDrafts(caseId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "list", caseId],
    queryFn: () => listCaseDrafts(caseId!),
    enabled: !!caseId,
  });
}

export function useCaseDraft(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "one", id],
    queryFn: () => getCaseDraft(id!),
    enabled: !!id,
  });
}

export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateDraftPayload) => generateCaseDraft(payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, "list", vars.case_id] });
    },
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<CaseDraft, "content" | "title" | "status">>;
    }) => updateCaseDraft(id, patch),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: [KEY, "one", draft.id] });
      qc.invalidateQueries({ queryKey: [KEY, "list", draft.case_id] });
    },
  });
}

export function useArchiveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveCaseDraft(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
