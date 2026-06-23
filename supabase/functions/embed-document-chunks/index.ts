// Gera embeddings via Lovable AI Gateway para chunks do arquivo que ainda não
// têm vetor da versão corrente. Idempotente: respeita unique
// (file_id, chunk_index, embedding_version, model_name).
// Interno — service_role only.
// PR-3.6 Onda 1: retry granular por batch (429/500/502/503) preserva progresso
// parcial; só promove 'done' quando todos os chunks têm embedding.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";
import {
  CHUNKING_VERSION,
  EMBEDDING_BATCH_SIZE,
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../_shared/versions.ts";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { estimateCost } from "../_shared/pricing.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function embedBatchOnce(inputs: string[]): Promise<{ ok: true; vectors: number[][] } | { ok: false; status: number; body: string }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIMS,
      output_dimensionality: EMBEDDING_DIMS,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  const out = await res.json();
  return { ok: true, vectors: (out.data as { embedding: number[] }[]).map((d) => d.embedding) };
}

async function embedBatchWithRetry(inputs: string[]): Promise<number[][]> {
  let lastErr = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const r = await embedBatchOnce(inputs);
    if (r.ok) return r.vectors;
    lastErr = `embeddings ${r.status}: ${r.body.slice(0, 200)}`;
    if (!RETRYABLE_STATUS.has(r.status) || attempt === RETRY_DELAYS_MS.length) break;
    await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error(lastErr || "embeddings: unknown error");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!requireServiceRole(req)) return json({ error: "Forbidden" }, 403);

  let body: { file_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.file_id) return json({ error: "file_id required" }, 400);

  const svc = serviceClient();
  const { data: file } = await svc
    .from("client_files")
    .select("id, organization_id, case_id, client_id, uploaded_by")
    .eq("id", body.file_id)
    .maybeSingle();
  if (!file) return json({ error: "file not found" }, 404);

  const startedAt = Date.now();

  await svc.from("client_files").update({ pipeline_stage: "embedding" }).eq("id", file.id);

  try {
    const { data: chunks, error: cErr } = await svc
      .from("document_chunks")
      .select("id, chunk_index, page_from, page_to, content")
      .eq("file_id", file.id)
      .eq("chunking_version", CHUNKING_VERSION)
      .order("chunk_index", { ascending: true });
    if (cErr) throw new Error(cErr.message);
    if (!chunks || chunks.length === 0) throw new Error("no chunks");

    const { data: existing } = await svc
      .from("document_embeddings")
      .select("chunk_index")
      .eq("file_id", file.id)
      .eq("embedding_version", EMBEDDING_VERSION)
      .eq("model_name", EMBEDDING_MODEL);
    const done = new Set((existing ?? []).map((r) => r.chunk_index));
    const todo = chunks.filter((c) => !done.has(c.chunk_index));

    // Early-return idempotente: tudo já feito → promove e sai.
    if (todo.length === 0) {
      await svc
        .from("client_files")
        .update({
          embedding_version: EMBEDDING_VERSION,
          embedding_model: EMBEDDING_MODEL,
          embedding_at: new Date().toISOString(),
          pipeline_stage: "done",
          pipeline_last_error: null,
        })
        .eq("id", file.id);
      return json({ ok: true, inserted: 0, total_chunks: chunks.length, skipped: chunks.length });
    }

    let inserted = 0;
    let lastBatchError: string | null = null;
    for (let i = 0; i < todo.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = todo.slice(i, i + EMBEDDING_BATCH_SIZE);
      let vectors: number[][];
      try {
        vectors = await embedBatchWithRetry(batch.map((b) => b.content));
      } catch (e) {
        lastBatchError = (e as Error).message;
        // Para no primeiro batch que falhou após retries — preserva progresso parcial.
        break;
      }
      const rows = batch.map((c, k) => ({
        organization_id: file.organization_id,
        case_id: file.case_id,
        file_id: file.id,
        chunk_id: c.id,
        source_kind: "pdf",
        chunk_index: c.chunk_index,
        page_from: c.page_from,
        page_to: c.page_to,
        content: c.content,
        embedding: vectors[k] as unknown as string,
        token_count: Math.ceil(c.content.length / 4),
        embedding_version: EMBEDDING_VERSION,
        model_name: EMBEDDING_MODEL,
        model_version: EMBEDDING_VERSION,
        metadata: {},
      }));
      const { error: iErr } = await svc
        .from("document_embeddings")
        .upsert(rows, {
          onConflict: "file_id,chunk_index,embedding_version,model_name",
          ignoreDuplicates: false,
        });
      if (iErr) throw new Error(iErr.message);
      inserted += rows.length;
    }

    const totalDone = done.size + inserted;
    if (totalDone < chunks.length) {
      // Progresso parcial: NÃO marca 'failed' (preserva o trabalho feito), apenas registra
      // o erro informativo e retorna 500. O worker reagendará com backoff e o próximo
      // run reaproveita os embeddings já gravados (filtrados pelo `existing`).
      const errMsg = `embed_partial: ${totalDone}/${chunks.length} (${lastBatchError ?? "stopped"})`;
      await svc
        .from("client_files")
        .update({ pipeline_last_error: errMsg })
        .eq("id", file.id);
      return json({ error: errMsg, inserted, total_chunks: chunks.length, done_total: totalDone }, 500);
    }

    await svc
      .from("client_files")
      .update({
        embedding_version: EMBEDDING_VERSION,
        embedding_model: EMBEDDING_MODEL,
        embedding_at: new Date().toISOString(),
        pipeline_stage: "done",
        pipeline_last_error: null,
      })
      .eq("id", file.id);

    return json({ ok: true, inserted, total_chunks: chunks.length });
  } catch (e) {
    const msg = (e as Error).message;
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: `embed: ${msg}` })
      .eq("id", file.id);
    return json({ error: msg }, 500);
  }
});
