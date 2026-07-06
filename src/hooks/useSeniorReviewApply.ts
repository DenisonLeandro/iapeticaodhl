// =============================================================================
// PR-4.5B — Hooks para revisão sênior aplicável + versões da minuta
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applySeniorReviewToDraft,
  bulkSetSuggestionStatus,
  listDraftVersions,
  setSuggestionStatus,
} from "@/services/seniorReviewApply";
import type { CaseDraft, SeniorReviewSuggestion, SeniorReviewSuggestionStatus } from "@/types/caseDraft";

const draftKey = (id: string) => ["case_drafts", "one", id];

export function useDraftVersions(draftId: string | undefined) {
  return useQuery({
    queryKey: ["case_draft_versions", draftId],
    queryFn: () => listDraftVersions(draftId!),
    enabled: !!draftId,
  });
}

export function useSetSuggestionStatus(draft: CaseDraft | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      suggestionId: string;
      status: SeniorReviewSuggestionStatus;
      patch?: Partial<SeniorReviewSuggestion>;
    }) => {
      if (!draft) throw new Error("Minuta indisponível.");
      return setSuggestionStatus(draft, args.suggestionId, args.status, args.patch);
    },
    onSuccess: (updated) => {
      qc.setQueryData(draftKey(updated.id), updated);
    },
  });
}

export function useBulkSetSuggestionStatus(draft: CaseDraft | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      status: SeniorReviewSuggestionStatus;
      filter?: (s: SeniorReviewSuggestion) => boolean;
    }) => {
      if (!draft) throw new Error("Minuta indisponível.");
      return bulkSetSuggestionStatus(draft, args.status, args.filter);
    },
    onSuccess: (updated) => {
      qc.setQueryData(draftKey(updated.id), updated);
    },
  });
}

export function useApplySeniorReview(draftId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (acceptedIds: string[]) => {
      if (!draftId) throw new Error("Minuta indisponível.");
      return applySeniorReviewToDraft(draftId, acceptedIds);
    },
    onSuccess: () => {
      if (!draftId) return;
      qc.invalidateQueries({ queryKey: draftKey(draftId) });
      qc.invalidateQueries({ queryKey: ["case_draft_versions", draftId] });
    },
  });
}
