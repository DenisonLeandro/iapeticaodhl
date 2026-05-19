// =============================================================================
// useDocuments — React Query hooks for documents CRUD
// Story 2.2 — Document Generation Flow
// =============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  createDocument,
  fetchDocument,
  fetchDocuments,
  updateDocument,
  logAIUsage,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type LogAIUsageInput,
} from "@/services/documents";

const DOCUMENTS_KEY = "documents";

export function useDocuments() {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const query = useQuery({
    queryKey: [DOCUMENTS_KEY, organizationId],
    queryFn: () => fetchDocuments(organizationId!),
    enabled: !!organizationId,
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDocument(id: string | undefined) {
  const query = useQuery({
    queryKey: [DOCUMENTS_KEY, id],
    queryFn: () => fetchDocument(id!),
    enabled: !!id,
  });

  return {
    document: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDocumentInput) => createDocument(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_KEY] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateDocumentInput;
    }) => updateDocument(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCUMENTS_KEY] });
    },
  });
}

export function useLogAIUsage() {
  return useMutation({
    mutationFn: (input: LogAIUsageInput) => logAIUsage(input),
  });
}
