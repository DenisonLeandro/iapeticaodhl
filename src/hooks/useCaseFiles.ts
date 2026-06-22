// =============================================================================
// useCaseFiles — PR-3A
// Lista arquivos (client_files) vinculados a um processo + contagem de chunks.
// Faz polling automático enquanto algum arquivo estiver processando.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/backend/client";

export type PipelineStage =
  | "pending"
  | "queued"
  | "extracting"
  | "chunking"
  | "classifying"
  | "embedding"
  | "done"
  | "failed"
  | null;

export interface CaseFileRow {
  id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
  pipeline_stage: PipelineStage;
  pipeline_last_error: string | null;
  classification: string | null;
  classification_confidence: number | null;
  page_count: number | null;
  chunk_count: number;
}

const KEY = "case-files";

const RUNNING_STAGES = new Set([
  "pending",
  "queued",
  "extracting",
  "chunking",
  "classifying",
  "embedding",
]);

export function useCaseFiles(caseId: string | undefined) {
  return useQuery({
    queryKey: [KEY, caseId],
    enabled: !!caseId,
    refetchInterval: (q) => {
      const data = q.state.data as CaseFileRow[] | undefined;
      if (!data || data.length === 0) return false;
      const hasRunning = data.some(
        (f) => f.pipeline_stage && RUNNING_STAGES.has(f.pipeline_stage),
      );
      return hasRunning ? 5000 : false;
    },
    queryFn: async (): Promise<CaseFileRow[]> => {
      const { data: files, error } = await supabase
        .from("client_files")
        .select(
          "id, file_name, file_size, file_type, created_at, pipeline_stage, pipeline_last_error, classification, classification_confidence, page_count",
        )
        .eq("case_id", caseId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (files ?? []) as Array<Omit<CaseFileRow, "chunk_count">>;
      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      const { data: chunks, error: chunksErr } = await supabase
        .from("document_chunks")
        .select("file_id")
        .in("file_id", ids);
      if (chunksErr) throw new Error(chunksErr.message);

      const counts = new Map<string, number>();
      for (const c of (chunks ?? []) as Array<{ file_id: string }>) {
        counts.set(c.file_id, (counts.get(c.file_id) ?? 0) + 1);
      }

      return rows.map((r) => ({ ...r, chunk_count: counts.get(r.id) ?? 0 }));
    },
  });
}
