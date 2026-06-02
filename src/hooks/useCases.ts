import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCases,
  createCase,
  updateCase,
  fetchLawyers,
  fetchUnlinkedCases,
  linkCaseToClient,
} from "@/services/cases";
import type { CaseFilters, CaseFormValues } from "@/types/case";

const CASES_QUERY_KEY = "cases";
const LAWYERS_QUERY_KEY = "lawyers";
const UNLINKED_CASES_KEY = "unlinked-cases";


export function useCases(filters: CaseFilters = {}) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const casesQuery = useQuery({
    queryKey: [CASES_QUERY_KEY, organizationId, filters],
    queryFn: () => fetchCases(organizationId!, filters),
    enabled: !!organizationId,
  });

  return {
    cases: casesQuery.data?.data ?? [],
    totalCount: casesQuery.data?.count ?? 0,
    isLoading: casesQuery.isLoading,
    error: casesQuery.error,
    refetch: casesQuery.refetch,
  };
}

export function useCaseMutations() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  const createMutation = useMutation({
    mutationFn: (values: CaseFormValues) =>
      createCase(organizationId!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CASES_QUERY_KEY],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ caseId, values }: { caseId: string; values: Partial<CaseFormValues> }) =>
      updateCase(caseId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CASES_QUERY_KEY],
      });
    },
  });

  return {
    createCase: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateCase: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function useLawyers() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const lawyersQuery = useQuery({
    queryKey: [LAWYERS_QUERY_KEY, organizationId],
    queryFn: () => fetchLawyers(organizationId!),
    enabled: !!organizationId,
  });

  return {
    lawyers: lawyersQuery.data ?? [],
    isLoading: lawyersQuery.isLoading,
  };
}

export function useUnlinkedCases(search?: string) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const query = useQuery({
    queryKey: [UNLINKED_CASES_KEY, organizationId, search ?? ""],
    queryFn: () => fetchUnlinkedCases(organizationId!, search),
    enabled: !!organizationId,
  });

  return {
    cases: query.data ?? [],
    isLoading: query.isLoading,
  };
}

export function useLinkCaseToClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, clientId }: { caseId: string; clientId: string | null }) =>
      linkCaseToClient(caseId, clientId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CASES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNLINKED_CASES_KEY] });
      if (variables.clientId) {
        queryClient.invalidateQueries({ queryKey: ["client-cases", variables.clientId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["client-cases"] });
      }
      queryClient.invalidateQueries({ queryKey: ["case-detail"] });
    },
  });
}

