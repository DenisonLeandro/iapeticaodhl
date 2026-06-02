import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzePdfFile } from "@/services/pdf-analysis.service";

export function useAnalyzePdf(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: { fileId: string; representedParty?: string }) =>
      analyzePdfFile(args.fileId, args.representedParty),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
    },
  });
}
