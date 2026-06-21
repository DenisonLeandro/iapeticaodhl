// Chunking page-block@v1: 1 chunk por página; páginas grandes (>CHUNK_MAX_CHARS)
// dividem em blocos com overlap. Idempotente por (file_id, chunk_index, chunking_version).
// Interno — service_role only.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";
import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  CHUNKING_VERSION,
  EXTRACTION_VERSION,
} from "../_shared/versions.ts";

function parsePages(text: string): { page: number; text: string }[] {
  const out: { page: number; text: string }[] = [];
  const parts = text.split(/\[\[PAGE (\d+)\]\]/);
  // split format: ["", "1", "...content...", "2", "...content..."]
  for (let i = 1; i < parts.length; i += 2) {
    const page = parseInt(parts[i], 10);
    const content = (parts[i + 1] ?? "").trim();
    if (content) out.push({ page, text: content });
  }
  if (out.length === 0 && text.trim()) out.push({ page: 1, text: text.trim() });
  return out;
}

function splitBlock(s: string, max: number, overlap: number): string[] {
  if (s.length <= max) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(i + max, s.length);
    out.push(s.slice(i, end));
    if (end === s.length) break;
    i = end - overlap;
  }
  return out;
}

async function hash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const { data: file, error: fErr } = await svc
    .from("client_files")
    .select("id, organization_id, case_id, extracted_text, extraction_version")
    .eq("id", body.file_id)
    .maybeSingle();
  if (fErr || !file) return json({ error: "file not found" }, 404);
  if (!file.extracted_text) return json({ error: "no extracted_text" }, 400);

  await svc.from("client_files").update({ pipeline_stage: "chunking" }).eq("id", file.id);

  try {
    const pages = parsePages(file.extracted_text);
    const rows: Array<Record<string, unknown>> = [];
    let idx = 0;
    for (const p of pages) {
      const blocks = splitBlock(p.text, CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS);
      for (const block of blocks) {
        rows.push({
          organization_id: file.organization_id,
          case_id: file.case_id,
          file_id: file.id,
          chunk_index: idx++,
          page_from: p.page,
          page_to: p.page,
          content: block,
          content_hash: await hash(block),
          token_count: Math.ceil(block.length / 4),
          extraction_version: file.extraction_version ?? EXTRACTION_VERSION,
          chunking_version: CHUNKING_VERSION,
        });
      }
    }

    // Upsert idempotente via unique (file_id, chunk_index, chunking_version)
    const { error: uErr } = await svc
      .from("document_chunks")
      .upsert(rows, { onConflict: "file_id,chunk_index,chunking_version" });
    if (uErr) throw new Error(uErr.message);

    return json({ ok: true, chunks: rows.length });
  } catch (e) {
    const msg = (e as Error).message;
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: `chunk: ${msg}` })
      .eq("id", file.id);
    return json({ error: msg }, 500);
  }
});
