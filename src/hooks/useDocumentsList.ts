// =============================================================================
// useDocumentsList — React Query hook for documents list with filters
// Story 2.4 — My Documents List
// =============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchDocuments,
  deleteDocument,
  type FetchDocumentsParams,
} from "@/services/documents";

const DOCUMENTS_QUERY_KEY = "documents";

export type UseDocumentsListParams = FetchDocumentsParams;

export function useDocumentsList(params: UseDocumentsListParams = {}) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const query = useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, organizationId, params],
    queryFn: () => fetchDocuments(organizationId!, params),
    enabled: !!organizationId,
  });

  const totalCount = query.data?.count ?? 0;
  const pageSize = params.pageSize ?? 20;

  return {
    documents: query.data?.data ?? [],
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
    },
  });
}
