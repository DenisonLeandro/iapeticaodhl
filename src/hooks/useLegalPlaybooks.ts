// =============================================================================
// PR-4.5A — Hooks para Playbooks Jurídicos.
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlaybook,
  deletePlaybook,
  duplicatePlaybook,
  getPlaybook,
  installMotoristaPlaybook,
  listPlaybooks,
  togglePlaybookActive,
  updatePlaybook,
  type PlaybookInput,
} from "@/services/legalPlaybooks";
import { useAuth } from "@/hooks/useAuth";

const KEY = ["legal_playbooks"] as const;

export function useLegalPlaybooks() {
  return useQuery({ queryKey: KEY, queryFn: listPlaybooks });
}

export function useLegalPlaybook(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => (id ? getPlaybook(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useCreatePlaybook() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: (input: PlaybookInput) => {
      if (!profile?.organization_id) throw new Error("Sem organização");
      return createPlaybook(profile.organization_id, user?.id ?? null, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PlaybookInput> }) => updatePlaybook(id, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, v.id] });
    },
  });
}

export function useTogglePlaybookActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => togglePlaybookActive(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDuplicatePlaybook() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: (source: Parameters<typeof duplicatePlaybook>[0]) => {
      if (!profile?.organization_id) throw new Error("Sem organização");
      return duplicatePlaybook(source, profile.organization_id, user?.id ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlaybook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useInstallMotoristaPlaybook() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: () => {
      if (!profile?.organization_id) throw new Error("Sem organização");
      return installMotoristaPlaybook(profile.organization_id, user?.id ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
