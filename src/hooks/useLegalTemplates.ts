import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeLegalTemplate,
  createLegalTemplate,
  getLegalTemplate,
  listLegalTemplates,
  setLegalTemplateStatus,
  updateLegalTemplate,
  uploadLegalTemplateFile,
  type LegalTemplateFilters,
  type LegalTemplateInput,
} from "@/services/legalTemplates";
import type { LegalTemplateStatus } from "@/types/legalTemplate";

export function useLegalTemplates(filters: LegalTemplateFilters = {}) {
  return useQuery({
    queryKey: ["legal_templates", filters],
    queryFn: () => listLegalTemplates(filters),
  });
}

export function useLegalTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["legal_templates", "detail", id],
    queryFn: () => getLegalTemplate(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.analysis_status;
      return status === "processing" || status === "pending" ? 3000 : false;
    },
  });
}

export function useCreateLegalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LegalTemplateInput) => createLegalTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["legal_templates"] }),
  });
}

export function useUpdateLegalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: Partial<LegalTemplateInput> }) =>
      updateLegalTemplate(args.id, args.patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["legal_templates"] });
      qc.invalidateQueries({ queryKey: ["legal_templates", "detail", vars.id] });
    },
  });
}

export function useSetLegalTemplateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; status: LegalTemplateStatus }) =>
      setLegalTemplateStatus(args.id, args.status),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["legal_templates"] });
      qc.invalidateQueries({ queryKey: ["legal_templates", "detail", vars.id] });
    },
  });
}

export function useUploadLegalTemplateFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; file: File }) =>
      uploadLegalTemplateFile(args.id, args.file),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["legal_templates"] });
      qc.invalidateQueries({ queryKey: ["legal_templates", "detail", vars.id] });
    },
  });
}

export function useAnalyzeLegalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyzeLegalTemplate(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["legal_templates", "detail", id] });
      qc.invalidateQueries({ queryKey: ["legal_templates"] });
    },
  });
}
