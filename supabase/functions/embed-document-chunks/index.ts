// Gera embeddings via Lovable AI Gateway para chunks do arquivo que ainda não
// têm vetor da versão corrente. Idempotente: respeita unique
// (file_id, chunk_index, embedding_version, model_name).
// Interno — service_role only.
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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function embedBatch(inputs: string[]): Promise<number[][]> {
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
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const out = await res.json();
  return (out.data as { embedding: number[] }[]).map((d) => d.embedding);
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
    .select("id, organization_id, case_id")
    .eq("id", body.file_id)
    .maybeSingle();
  if (!file) return json({ error: "file not found" }, 404);

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

    // Filtra chunks já embedados nesta versão+modelo.
    const { data: existing } = await svc
      .from("document_embeddings")
      .select("chunk_index")
      .eq("file_id", file.id)
      .eq("embedding_version", EMBEDDING_VERSION)
      .eq("model_name", EMBEDDING_MODEL);
    const done = new Set((existing ?? []).map((r) => r.chunk_index));
    const todo = chunks.filter((c) => !done.has(c.chunk_index));

    let inserted = 0;
    for (let i = 0; i < todo.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = todo.slice(i, i + EMBEDDING_BATCH_SIZE);
      const vectors = await embedBatch(batch.map((b) => b.content));
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
