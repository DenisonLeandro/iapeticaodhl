// =============================================================================
// useCaseFiles — PR-3A + PR-3.6
// Lista documentos lógicos (parent_file_id IS NULL) vinculados ao processo.
// Para documentos com múltiplas partes, agrega progresso (X/Y processadas) e
// soma chunks/páginas das partes filhas. Polling enquanto há partes em curso.
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
  // PR-3.6 — agregação de partes
  total_parts: number | null;
  processed_parts: number; // 0 quando não há partes
  failed_parts: number;
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
        (f) =>
          (f.pipeline_stage && RUNNING_STAGES.has(f.pipeline_stage)) ||
          (f.total_parts && f.total_parts > 1 && f.processed_parts < f.total_parts && f.failed_parts === 0),
      );
      return hasRunning ? 5000 : false;
    },
    queryFn: async (): Promise<CaseFileRow[]> => {
      // 1) Documentos lógicos (pais OU arquivos únicos).
      const { data: parents, error } = await supabase
        .from("client_files")
        .select(
          "id, file_name, file_size, file_type, created_at, pipeline_stage, pipeline_last_error, classification, classification_confidence, page_count, total_parts, logical_file_name",
        )
        .eq("case_id", caseId!)
        .is("parent_file_id", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (parents ?? []) as Array<
        Omit<CaseFileRow, "chunk_count" | "processed_parts" | "failed_parts"> & {
          logical_file_name: string | null;
        }
      >;
      if (rows.length === 0) return [];

      const parentIds = rows.map((r) => r.id);

      // 2) Filhos: pipeline_stage + page_count agrupados por parent_file_id.
      const { data: children, error: childErr } = await supabase
        .from("client_files")
        .select("id, parent_file_id, pipeline_stage, page_count")
        .in("parent_file_id", parentIds);
      if (childErr) throw new Error(childErr.message);

      const partsByParent = new Map<
        string,
        { ids: string[]; done: number; failed: number; pages: number }
      >();
      for (const c of (children ?? []) as Array<{
        id: string;
        parent_file_id: string;
        pipeline_stage: string | null;
        page_count: number | null;
      }>) {
        const agg =
          partsByParent.get(c.parent_file_id) ?? { ids: [], done: 0, failed: 0, pages: 0 };
        agg.ids.push(c.id);
        if (c.pipeline_stage === "done") agg.done += 1;
        if (c.pipeline_stage === "failed") agg.failed += 1;
        if (c.page_count) agg.pages += c.page_count;
        partsByParent.set(c.parent_file_id, agg);
      }

      // 3) Chunks: para arquivos simples, contagem por id; para pais, somar
      //    pelos ids dos filhos.
      const allIds = [
        ...parentIds.filter((id) => !partsByParent.has(id)),
        ...Array.from(partsByParent.values()).flatMap((p) => p.ids),
      ];
      let chunkByFile = new Map<string, number>();
      if (allIds.length > 0) {
        const { data: chunks, error: chunksErr } = await supabase
          .from("document_chunks")
          .select("file_id")
          .in("file_id", allIds);
        if (chunksErr) throw new Error(chunksErr.message);
        for (const c of (chunks ?? []) as Array<{ file_id: string }>) {
          chunkByFile.set(c.file_id, (chunkByFile.get(c.file_id) ?? 0) + 1);
        }
      }

      return rows.map((r) => {
        const parts = partsByParent.get(r.id);
        const chunkCount = parts
          ? parts.ids.reduce((sum, id) => sum + (chunkByFile.get(id) ?? 0), 0)
          : chunkByFile.get(r.id) ?? 0;
        const pages = parts && parts.pages > 0 ? parts.pages : r.page_count;
        return {
          id: r.id,
          file_name: r.logical_file_name ?? r.file_name,
          file_size: r.file_size,
          file_type: r.file_type,
          created_at: r.created_at,
          pipeline_stage: r.pipeline_stage,
          pipeline_last_error: r.pipeline_last_error,
          classification: r.classification,
          classification_confidence: r.classification_confidence,
          page_count: pages,
          chunk_count: chunkCount,
          total_parts: r.total_parts,
          processed_parts: parts?.done ?? 0,
          failed_parts: parts?.failed ?? 0,
        };
      });
    },
  });
}
