import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getClientById } from "@/services/clients";
import {
  listInteractions,
  createInteraction,
  type InteractionListParams,
} from "@/services/client-interaction.service";
import {
  listFiles,
  uploadFile,
  deleteFile,
  getFileUrl,
} from "@/services/client-file.service";
import type { InteractionFormValues } from "@/schemas/client.schema";

const CLIENT_DETAIL_KEY = "client-detail";
const INTERACTIONS_KEY = "client-interactions";
const CLIENT_FILES_KEY = "client-files";

// ---------------------------------------------------------------------------
// Client Detail
// ---------------------------------------------------------------------------
export function useClientDetail(clientId: string | undefined) {
  const query = useQuery({
    queryKey: [CLIENT_DETAIL_KEY, clientId],
    queryFn: () => getClientById(clientId!),
    enabled: !!clientId,
  });

  return {
    client: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------
export function useInteractions(
  clientId: string | undefined,
  params: InteractionListParams,
) {
  const query = useQuery({
    queryKey: [INTERACTIONS_KEY, clientId, params],
    queryFn: () => listInteractions(clientId!, params),
    enabled: !!clientId,
  });

  return {
    interactions: query.data?.data ?? [],
    totalCount: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateInteraction(clientId: string) {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: InteractionFormValues) =>
      createInteraction(organization!.id, clientId, user!.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY, clientId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------
export function useClientFiles(clientId: string | undefined) {
  const query = useQuery({
    queryKey: [CLIENT_FILES_KEY, clientId],
    queryFn: () => listFiles(clientId!),
    enabled: !!clientId,
  });

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useUploadFile(clientId: string) {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, description }: { file: File; description?: string }) =>
      uploadFile(organization!.id, clientId, user!.id, file, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENT_FILES_KEY, clientId] });
    },
  });
}

export function useDeleteFile(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENT_FILES_KEY, clientId] });
    },
  });
}

export function useFileUrl() {
  return useMutation({
    mutationFn: (storagePath: string) => getFileUrl(storagePath),
  });
}
