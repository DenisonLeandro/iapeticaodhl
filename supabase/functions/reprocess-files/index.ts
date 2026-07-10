// Reenfileira arquivos cujas versões estejam abaixo das versões correntes.
// Exposta — apenas ADMIN da organização. Nunca cruza organizações.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";
import {
  CLASSIFICATION_VERSION,
  EMBEDDING_VERSION,
  EXTRACTION_VERSION,
} from "../_shared/versions.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!user.isAdmin) return json({ error: "Admin only" }, 403);

  let body: {
    case_id?: string;
    stage?: "extract" | "classify" | "embed" | "full";
    /** Fase 2 · Bloco 1 — quando false (default), pula arquivos já processados. */
    force?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* permite body vazio */
  }
  const stage = body.stage ?? "embed";
  const force = body.force === true;

  const svc = serviceClient();
  let q = svc
    .from("client_files")
    .select("id, case_id, extraction_version, classification_version, embedding_version, pipeline_stage, extracted_text")
    .eq("organization_id", user.organizationId);
  if (body.case_id) q = q.eq("case_id", body.case_id);

  const { data: files, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const target =
    stage === "extract"
      ? EXTRACTION_VERSION
      : stage === "classify"
        ? CLASSIFICATION_VERSION
        : EMBEDDING_VERSION;

  const filtered = (files ?? []).filter((f) => {
    // Sem force: pula quaisquer arquivos que já estão em 'done' com versão ok.
    if (!force) {
      const already =
        f.pipeline_stage === "done" &&
        (stage === "extract"
          ? f.extraction_version === target
          : stage === "classify"
            ? f.classification_version === target
            : stage === "embed"
              ? f.embedding_version === target
              : f.extraction_version === EXTRACTION_VERSION &&
                f.classification_version === CLASSIFICATION_VERSION &&
                f.embedding_version === EMBEDDING_VERSION);
      if (already) return false;
    }
    if (stage === "full") return true;
    if (stage === "extract") return f.extraction_version !== target;
    if (stage === "classify") return f.classification_version !== target;
    return f.embedding_version !== target;
  });

  const skipped = (files ?? []).length - filtered.length;
  if (filtered.length === 0) {
    return json({
      ok: true,
      enqueued: 0,
      skipped,
      reason: skipped > 0 ? "already_processed" : "no_files",
      force,
    });
  }

  const rows = filtered.map((f) => ({
    organization_id: user.organizationId,
    file_id: f.id,
    case_id: f.case_id,
    job_type: stage,
    status: "queued",
    priority: 200,
  }));
  const { error: iErr } = await svc.from("processing_jobs").insert(rows);
  if (iErr) return json({ error: iErr.message }, 500);

  // Aciona dispatcher.
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-document-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    },
    body: JSON.stringify({ source: "reprocess" }),
  }).catch(() => {});

  return json({ ok: true, enqueued: rows.length, stage, target_version: target });
});
