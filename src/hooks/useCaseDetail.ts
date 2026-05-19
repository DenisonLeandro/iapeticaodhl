import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCaseById,
  fetchCaseMovements,
  fetchCaseDocuments,
  createMovement,
} from "@/services/caseDetail";
import type { MovementFormValues } from "@/types/case";

const CASE_DETAIL_KEY = "case-detail";
const CASE_MOVEMENTS_KEY = "case-movements";
const CASE_DOCUMENTS_KEY = "case-documents";

export function useCaseDetail(caseId: string | undefined) {
  const query = useQuery({
    queryKey: [CASE_DETAIL_KEY, caseId],
    queryFn: () => fetchCaseById(caseId!),
    enabled: !!caseId,
  });

  return {
    caseData: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCaseMovements(caseId: string | undefined) {
  const query = useQuery({
    queryKey: [CASE_MOVEMENTS_KEY, caseId],
    queryFn: () => fetchCaseMovements(caseId!),
    enabled: !!caseId,
  });

  return {
    movements: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCaseDocuments(caseId: string | undefined) {
  const query = useQuery({
    queryKey: [CASE_DOCUMENTS_KEY, caseId],
    queryFn: () => fetchCaseDocuments(caseId!),
    enabled: !!caseId,
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateMovement(caseId: string | undefined) {
  const { organization, profile } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: MovementFormValues) =>
      createMovement(organization!.id, caseId!, values, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CASE_MOVEMENTS_KEY, caseId],
      });
    },
  });

  return {
    createMovement: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}
