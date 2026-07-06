// =============================================================================
// PR-4.5B — Serviços de revisão sênior aplicável + versões de minuta
// =============================================================================
import { supabase } from "@/lib/backend/client";
import type {
  CaseDraft,
  CaseDraftVersion,
  SeniorReviewSuggestion,
  SeniorReviewSuggestionStatus,
} from "@/types/caseDraft";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listDraftVersions(draftId: string): Promise<CaseDraftVersion[]> {
  const { data, error } = await db
    .from("case_draft_versions")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDraftVersion[];
}

export async function setSuggestionStatus(
  draft: CaseDraft,
  suggestionId: string,
  status: SeniorReviewSuggestionStatus,
  patch?: Partial<SeniorReviewSuggestion>,
): Promise<CaseDraft> {
  const current: SeniorReviewSuggestion[] = Array.isArray(draft.senior_review_suggestions)
    ? draft.senior_review_suggestions
    : [];
  const next = current.map((s) =>
    s.id === suggestionId ? { ...s, ...(patch ?? {}), status } : s,
  );
  const { data, error } = await db
    .from("case_drafts")
    .update({ senior_review_suggestions: next })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CaseDraft;
}

export async function bulkSetSuggestionStatus(
  draft: CaseDraft,
  status: SeniorReviewSuggestionStatus,
  filter?: (s: SeniorReviewSuggestion) => boolean,
): Promise<CaseDraft> {
  const current: SeniorReviewSuggestion[] = Array.isArray(draft.senior_review_suggestions)
    ? draft.senior_review_suggestions
    : [];
  const next = current.map((s) => (filter ? (filter(s) ? { ...s, status } : s) : { ...s, status }));
  const { data, error } = await db
    .from("case_drafts")
    .update({ senior_review_suggestions: next })
    .eq("id", draft.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CaseDraft;
}

export async function applySeniorReviewToDraft(
  draftId: string,
  acceptedSuggestionIds: string[],
): Promise<{
  status: string;
  previous_version_id?: string;
  new_version_id?: string;
  applied_ids?: string[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("apply-senior-review-to-draft", {
    body: { draft_id: draftId, accepted_suggestion_ids: acceptedSuggestionIds },
  });
  if (error) throw new Error(error.message);
  return data;
}
