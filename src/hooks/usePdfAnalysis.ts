import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzePdfFile } from "@/services/pdf-analysis.service";

export function useAnalyzePdf(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileId: string) => analyzePdfFile(fileId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["client-files", clientId] });
    },
  });
}
