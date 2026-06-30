// =============================================================================
// PR-4.3A — Hook da Ficha Inteligente
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getCaseIntake,
  upsertCaseIntake,
  requestIntakeSuggestion,
} from "@/services/caseIntake";
import type { CaseIntakeForm, CaseIntakeFormValues } from "@/types/caseIntake";

const KEY = "case-intake";

export function useCaseIntake(caseId: string | undefined, clientId: string | null) {
  const qc = useQueryClient();
  const { profile, organization } = useAuth();

  const query = useQuery({
    queryKey: [KEY, caseId],
    queryFn: () => getCaseIntake(caseId!),
    enabled: !!caseId,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CaseIntakeFormValues) => {
      if (!caseId) throw new Error("Caso inválido");
      if (!organization?.id || !profile?.id) throw new Error("Sessão inválida");
      return upsertCaseIntake(caseId, organization.id, clientId, profile.id, values);
    },
    onSuccess: (data) => {
      qc.setQueryData([KEY, caseId], data);
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new Error("Caso inválido");
      return requestIntakeSuggestion(caseId);
    },
    onSuccess: () => {
      // sugestões são persistidas no servidor; refetch para refletir ai_* fields
      qc.invalidateQueries({ queryKey: [KEY, caseId] });
      toast.success("Sugestão da IA gerada.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Falha ao gerar sugestão");
    },
  });

  return {
    intake: (query.data ?? null) as CaseIntakeForm | null,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    suggest: suggestMutation.mutateAsync,
    isSuggesting: suggestMutation.isPending,
  };
}
