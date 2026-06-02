import { supabase } from "@/lib/backend/client";

export interface PdfAnalyzeResponse {
  status: "analyzed" | "error";
  summary?: string;
  analysis_json?: Record<string, unknown>;
  message?: string;
  error?: string;
}

export async function analyzePdfFile(fileId: string): Promise<PdfAnalyzeResponse> {
  const { data, error } = await supabase.functions.invoke("process-pdf-analyze", {
    body: { file_id: fileId },
  });

  if (error) {
    throw new Error(error.message ?? "Falha ao chamar análise de PDF.");
  }
  return data as PdfAnalyzeResponse;
}
