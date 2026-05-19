import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchClients,
  createClient,
  updateClient,
  softDeleteClient,
} from "@/services/clients";
import type { ClientListParams } from "@/types/client";
import type { ClientFormValues } from "@/schemas/client.schema";

const CLIENTS_QUERY_KEY = "clients";

export function useClients(params: ClientListParams) {
  const { organization } = useAuth();
  const organizationId = organization?.id;

  const query = useQuery({
    queryKey: [CLIENTS_QUERY_KEY, organizationId, params],
    queryFn: () => fetchClients(organizationId!, params),
    enabled: !!organizationId,
  });

  return {
    clients: query.data?.data ?? [],
    totalCount: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateClient() {
  const { user, organization, profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: ClientFormValues) => {
      if (!organization?.id || !user?.id || !profile?.id) {
        throw new Error("Sessão incompleta. Recarregue a página ou faça login novamente.");
      }
      return createClient(organization.id, user.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientFormValues }) =>
      updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => softDeleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_QUERY_KEY] });
    },
  });
}
