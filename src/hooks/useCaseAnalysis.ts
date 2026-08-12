// =============================================================================
// PR-4.1A — Hook de análise inicial do caso
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getLatestCaseAnalysis,
  runCaseAnalysis,
  type CaseAnalysis,
} from "@/services/caseAnalysis";

const KEY = "case-analysis-latest";

export function useCaseAnalysis(caseId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, caseId],
    queryFn: () => getLatestCaseAnalysis(caseId!),
    enabled: !!caseId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (force: boolean) => {
      if (!caseId) throw new Error("Caso inválido");
      return runCaseAnalysis(caseId, force);
    },
    onMutate: async (_force) => {
      // Marca otimisticamente como running para feedback imediato
      const previous = qc.getQueryData<CaseAnalysis | null>([KEY, caseId]);
      return { previous };
    },
    onSuccess: ({ analysis, reused }) => {
      qc.setQueryData([KEY, caseId], analysis);
      if (analysis.status === "failed") {
        toast.error("A análise não pôde ser concluída. Tente novamente.");
      } else if (reused) {
        toast.message("Análise existente carregada.");
      } else {
        toast.success("Análise concluída.");
      }
    },
    onError: (e: Error) => {
      console.error("case-analysis:error", e);
      toast.error(
        e.message || "Não foi possível iniciar a análise — tente novamente.",
      );
    },
  });

  // Uma linha `running` antiga (função interrompida) não pode travar o botão.
  const runningRow = query.data?.status === "running" ? query.data : null;
  const staleRunning =
    !!runningRow &&
    Date.now() - new Date(runningRow.updated_at ?? runningRow.created_at).getTime() >
      5 * 60_000;

  return {
    analysis: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRunning: mutation.isPending || (!!runningRow && !staleRunning),
    generate: (force: boolean) => mutation.mutateAsync(force),
    error: query.error as Error | null,
  };
}

