import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  archiveCaseDraft,
  assembleDraftChapters,
  generateCaseDraft,
  generateDraftSection,
  getCaseDraft,
  listCaseDrafts,
  planDraftChapters,
  triggerDraftReview,
  updateCaseDraft,
} from "@/services/caseDrafts";
import type {
  AssembleChaptersPayload,
  CaseDraft,
  GenerateDraftPayload,
  GenerateDraftSectionPayload,
  PlanChaptersPayload,
} from "@/types/caseDraft";



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
    // Polling leve enquanto a revisão automática estiver em andamento
    refetchInterval: (query) => {
      const status = (query.state.data as CaseDraft | undefined)?.quality_status;
      return status === "pending" || status === "running" ? 5000 : false;
    },
  });
}


export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateDraftPayload) => generateCaseDraft(payload),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, "list", vars.case_id] });
      // Dispara revisão automática em segundo plano (fire-and-forget).
      if (res?.draft_id) void triggerDraftReview(res.draft_id);
    },
  });
}

export function useReviewDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => triggerDraftReview(draftId),
    onSuccess: (_, draftId) => {
      qc.invalidateQueries({ queryKey: [KEY, "one", draftId] });
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

// PR-2 — Modo por capítulos: planeja o esqueleto.
export function usePlanDraftChapters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlanChaptersPayload) => planDraftChapters(payload),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, "list", vars.case_id] });
      if (res.success && res.draft_id) {
        qc.invalidateQueries({ queryKey: [KEY, "one", res.draft_id] });
      }
    },
  });
}


// PR-3 — Gera conteúdo de UMA seção. Invalida a lista de sections do draft.
export function useGenerateDraftSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateDraftSectionPayload) => generateDraftSection(payload),
    onSettled: (_res, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["case_draft_sections", "list", vars.draft_id] });
    },
  });
}

// PR-4 — Montagem determinística da petição final.
export function useAssembleDraftChapters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssembleChaptersPayload) => assembleDraftChapters(payload),
    onSettled: (res, _err, vars) => {
      qc.invalidateQueries({ queryKey: [KEY, "one", vars.draft_id] });
      qc.invalidateQueries({ queryKey: ["case_draft_sections", "list", vars.draft_id] });
      qc.invalidateQueries({ queryKey: ["case_draft_versions", vars.draft_id] });
      if (res && res.success && "draft_id" in res) {
        qc.invalidateQueries({ queryKey: [KEY, "one", res.draft_id] });
      }
    },
  });
}

