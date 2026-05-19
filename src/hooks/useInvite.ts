import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { inviteUserByEmail } from "@/services/invite";
import type { UserRole } from "@/types/database.types";

export function useInvite() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) =>
      inviteUserByEmail(email, role, organization!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organization?.id],
      });
    },
  });

  return {
    sendInvite: inviteMutation.mutateAsync,
    isLoading: inviteMutation.isPending,
    error: inviteMutation.error,
    reset: inviteMutation.reset,
  };
}
