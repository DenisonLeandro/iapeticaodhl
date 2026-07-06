// =============================================================================
// PR-6A — Hook do Mapa de Pedidos e Riscos
// =============================================================================
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildClaimMap, getCurrentClaimMap } from "@/services/caseClaimMaps";

const KEY = "case_claim_maps";

export function useCurrentClaimMap(caseId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "current", caseId],
    queryFn: () => getCurrentClaimMap(caseId!),
    enabled: !!caseId,
  });
}

export function useBuildClaimMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => buildClaimMap({ case_id: caseId, force_regenerate: true }),
    onSuccess: (map) => {
      qc.invalidateQueries({ queryKey: [KEY, "current", map.case_id] });
    },
  });
}
