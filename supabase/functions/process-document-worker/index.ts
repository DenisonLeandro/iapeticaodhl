// Dispatcher da fila. Acionado por cron (1 min) e por enqueue-file-processing.
// Interno: aceita apenas service_role.
// PR-3.6 Onda 1: MAX_PER_TICK=1 (isola crashes por job) + heartbeat_at.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Isola crashes/timeouts: se uma extract estourar WORKER_RESOURCE_LIMIT,
// apenas 1 job é perdido por tick — e o reaper o recupera em ≤1min.
const MAX_PER_TICK = 1;
const BACKOFF_MS = [60_000, 300_000, 900_000]; // 1m, 5m, 15m

type Job = {
  id: string;
  organization_id: string;
  file_id: string;
  case_id: string | null;
  job_type: "extract" | "chunk" | "classify" | "embed" | "full";
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
};

async function heartbeat(svc: ReturnType<typeof serviceClient>, jobId: string) {
  try {
    await svc
      .from("processing_jobs")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch {
    // heartbeat best-effort; falha não interrompe o job
  }
}

async function invoke(
  svc: ReturnType<typeof serviceClient>,
  jobId: string,
  fn: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  await heartbeat(svc, jobId);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    await heartbeat(svc, jobId);
    if (!res.ok) return { ok: false, error: `${fn} ${res.status}: ${text.slice(0, 500)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `${fn} threw: ${(e as Error).message}` };
  }
}

async function runJob(svc: ReturnType<typeof serviceClient>, job: Job): Promise<void> {
  const fileId = job.file_id;
  let result: { ok: boolean; error?: string };

  if (job.job_type === "full") {
    result = await invoke(svc, job.id, "extract-document-text", { file_id: fileId });
    if (result.ok) result = await invoke(svc, job.id, "chunk-document", { file_id: fileId });
    if (result.ok) result = await invoke(svc, job.id, "classify-document", { file_id: fileId });
    if (result.ok) result = await invoke(svc, job.id, "embed-document-chunks", { file_id: fileId });
  } else if (job.job_type === "extract") {
    result = await invoke(svc, job.id, "extract-document-text", { file_id: fileId });
  } else if (job.job_type === "chunk") {
    result = await invoke(svc, job.id, "chunk-document", { file_id: fileId });
  } else if (job.job_type === "classify") {
    result = await invoke(svc, job.id, "classify-document", { file_id: fileId });
  } else {
    result = await invoke(svc, job.id, "embed-document-chunks", { file_id: fileId });
  }

  if (result.ok) {
    await svc
      .from("processing_jobs")
      .update({ status: "done", finished_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);
    return;
  }

  const nextAttempt = job.attempts;
  if (nextAttempt >= job.max_attempts) {
    await svc
      .from("processing_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        last_error: result.error ?? "unknown",
      })
      .eq("id", job.id);
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: result.error ?? "unknown" })
      .eq("id", fileId);
  } else {
    const delay = BACKOFF_MS[Math.min(nextAttempt - 1, BACKOFF_MS.length - 1)];
    await svc
      .from("processing_jobs")
      .update({
        status: "queued",
        scheduled_at: new Date(Date.now() + delay).toISOString(),
        started_at: null,
        heartbeat_at: null,
        last_error: result.error ?? "unknown",
      })
      .eq("id", job.id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!requireServiceRole(req)) return json({ error: "Forbidden" }, 403);

  const svc = serviceClient();
  const { data: jobs, error } = await svc.rpc("claim_processing_jobs", { p_limit: MAX_PER_TICK });
  if (error) return json({ error: error.message }, 500);
  const list = (jobs ?? []) as Job[];

  for (const job of list) {
    try {
      await runJob(svc, job);
    } catch (e) {
      await svc
        .from("processing_jobs")
        .update({ status: "failed", last_error: (e as Error).message })
        .eq("id", job.id);
    }
  }

  return json({ ok: true, processed: list.length });
});
