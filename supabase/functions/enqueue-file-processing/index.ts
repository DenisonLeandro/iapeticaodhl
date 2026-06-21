// Enfileira processamento assíncrono de um arquivo.
// Exposta ao frontend — valida JWT e checa organização.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: { file_id?: string; job_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const fileId = body.file_id;
  const jobType = body.job_type ?? "full";
  if (!fileId || typeof fileId !== "string") {
    return json({ error: "file_id is required" }, 400);
  }
  if (!["extract", "chunk", "classify", "embed", "full"].includes(jobType)) {
    return json({ error: "invalid job_type" }, 400);
  }

  const svc = serviceClient();

  // Garante isolamento por organização — nunca aceita file_id de outra org.
  const { data: file, error: fErr } = await svc
    .from("client_files")
    .select("id, organization_id, case_id")
    .eq("id", fileId)
    .maybeSingle();
  if (fErr || !file) return json({ error: "File not found" }, 404);
  if (file.organization_id !== user.organizationId) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: job, error: jErr } = await svc
    .from("processing_jobs")
    .insert({
      organization_id: file.organization_id,
      file_id: file.id,
      case_id: file.case_id,
      job_type: jobType,
      status: "queued",
      priority: 100,
    })
    .select()
    .single();
  if (jErr) return json({ error: jErr.message }, 500);

  await svc
    .from("client_files")
    .update({ pipeline_stage: "queued", pipeline_last_error: null })
    .eq("id", file.id);

  // Aciona dispatcher imediatamente para reduzir latência (best-effort).
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-document-worker`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    },
    body: JSON.stringify({ source: "enqueue" }),
  }).catch(() => {});

  return json({ ok: true, job_id: job.id });
});
