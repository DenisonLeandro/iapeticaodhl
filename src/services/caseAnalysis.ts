// =============================================================================
// PR-4.1A — Serviço de análise de casos
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { withInflight } from "@/lib/ai/inflight-guard";

export interface CaseAnalysisContent {
  summary: string;
  case_type: string;
  represented_party: string;
  facts: string[];
  strengths: string[];
  risks: string[];
  relevant_documents: string[];
  missing_documents: string[];
  legal_theories: string[];
  next_action: string;
  recommended_piece: string;
  confidence_level: string;
  human_review_notes: string[];
}

export interface CaseAnalysis {
  id: string;
  case_id: string;
  client_id: string | null;
  organization_id: string;
  analysis_type: string;
  status: "pending" | "running" | "done" | "failed";
  content_json: CaseAnalysisContent;
  summary: string | null;
  model_task: string | null;
  model_used: string | null;
  provider: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getLatestCaseAnalysis(caseId: string): Promise<CaseAnalysis | null> {
  const { data, error } = await supabase
    .from("case_analyses")
    .select("*")
    .eq("case_id", caseId)
    .in("status", ["done", "running", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as CaseAnalysis | null) ?? null;
}

/** Tempo máximo de espera pela edge function antes de liberar a UI. */
export const ANALYSIS_TIMEOUT_MS = 120_000;

export async function runCaseAnalysis(
  caseId: string,
  force = false,
  opts: { highPrecision?: boolean } = {},
): Promise<{ analysis: CaseAnalysis; reused: boolean }> {
  return withInflight(`analyze-case:${caseId}`, async () => {
    const call = (async () => {
      const { data, error } = await supabase.functions.invoke("analyze-case", {
        body: { caseId, force, highPrecision: opts.highPrecision === true },
      });
      if (error) {
        console.error("analyze-case:invoke_error", error);
        throw new Error(error.message || "Falha ao gerar análise");
      }
      if (!data?.analysis) {
        console.error("analyze-case:invalid_response", data);
        throw new Error("Resposta inválida do servidor");
      }
      return { analysis: data.analysis as CaseAnalysis, reused: !!data.reused };
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "A análise demorou mais que o esperado e foi interrompida. Tente novamente.",
            ),
          ),
        ANALYSIS_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([call, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  });
}

