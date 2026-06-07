// =============================================================================
// useDocumentVersions — Fase D
// =============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyNewVersion,
  listVersions,
  restoreVersion,
  type VersionSource,
} from "@/services/documentVersions";

const KEY = "document-versions";

export function useDocumentVersions(documentId: string | undefined) {
  const queryClient = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: [KEY, documentId],
    queryFn: () => listVersions(documentId!),
    enabled: !!documentId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [KEY, documentId] });
    queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
  };

  const applyMutation = useMutation({
    mutationFn: (params: {
      newContent: string;
      changeSummary: string;
      source: VersionSource;
    }) =>
      applyNewVersion({
        documentId: documentId!,
        ...params,
      }),
    onSuccess: invalidate,
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restoreVersion(documentId!, versionId),
    onSuccess: invalidate,
  });

  return {
    versions: versionsQuery.data ?? [],
    isLoading: versionsQuery.isLoading,
    applyNewContent: applyMutation.mutateAsync,
    isApplying: applyMutation.isPending,
    restore: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
  };
}
