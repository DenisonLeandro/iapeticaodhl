import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchOrganizationMembers,
  updateMemberRole,
  removeMember,
} from "@/services/members";
import type { UserRole } from "@/types/database.types";

const MEMBERS_QUERY_KEY = "organization-members";

export function useOrganizationMembers() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;

  const membersQuery = useQuery({
    queryKey: [MEMBERS_QUERY_KEY, organizationId],
    queryFn: () => fetchOrganizationMembers(organizationId!),
    enabled: !!organizationId,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      profileId,
      newRole,
    }: {
      profileId: string;
      newRole: UserRole;
    }) => updateMemberRole(profileId, newRole, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [MEMBERS_QUERY_KEY, organizationId],
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (profileId: string) =>
      removeMember(profileId, organizationId!, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [MEMBERS_QUERY_KEY, organizationId],
      });
    },
  });

  return {
    members: membersQuery.data ?? [],
    isLoading: membersQuery.isLoading,
    error: membersQuery.error,
    refetch: membersQuery.refetch,
    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    removeMember: removeMemberMutation.mutateAsync,
    isRemoving: removeMemberMutation.isPending,
  };
}
