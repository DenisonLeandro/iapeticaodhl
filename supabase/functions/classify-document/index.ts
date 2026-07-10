// Classifica o documento usando Lovable AI (Gemini Flash).
// Usa apenas as primeiras páginas para conter custo.
// Interno — service_role only.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { requireServiceRole, serviceClient } from "../_shared/auth.ts";
import { CLASSIFICATION_MODEL, CLASSIFICATION_VERSION } from "../_shared/versions.ts";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { estimateCost } from "../_shared/pricing.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TAXONOMY = [
  "peticao_inicial",
  "contestacao",
  "replica",
  "sentenca",
  "acordao",
  "despacho",
  "decisao_interlocutoria",
  "recurso",
  "contrato",
  "procuracao",
  "documento_pessoal",
  "comprovante",
  "laudo_pericial",
  "ata_audiencia",
  "outros",
];

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
    .select("id, organization_id, case_id, client_id, uploaded_by, extracted_text, classification, classification_version")
    .eq("id", body.file_id)
    .maybeSingle();
  if (fErr || !file) return json({ error: "file not found" }, 404);
  if (!file.extracted_text) return json({ error: "no extracted_text" }, 400);

  // PR-3.6 Onda 2: idempotência. Se já temos classification na versão corrente, pula.
  if (file.classification && file.classification_version === CLASSIFICATION_VERSION) {
    console.log("classify:skip_idempotent", { file_id: file.id, classification: file.classification });
    return json({ ok: true, skipped: true, classification: file.classification });
  }

  console.log("classify:start", { file_id: file.id, text_len: file.extracted_text.length });

  {
    const { error: stageErr } = await svc
      .from("client_files")
      .update({ pipeline_stage: "classifying" })
      .eq("id", file.id);
    if (stageErr) {
      console.error("classify:error", { file_id: file.id, stage: "set_classifying", msg: stageErr.message });
      return json({ error: `set stage: ${stageErr.message}` }, 500);
    }
  }

  const startedAt = Date.now();
  try {
    // Limita o input a ~6k chars (primeiras páginas) — suficiente para classificar.
    const sample = file.extracted_text.slice(0, 6000);
    const prompt = `Classifique o documento jurídico brasileiro abaixo em UMA das categorias:
${TAXONOMY.join(", ")}

Responda APENAS um JSON: {"classification":"<categoria>","confidence":<0..1>}

Documento:
${sample}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: CLASSIFICATION_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${await res.text()}`);
    const out = await res.json();
    const content = out.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const classification = TAXONOMY.includes(parsed.classification)
      ? parsed.classification
      : "outros";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    console.log("classify:ai_response", { file_id: file.id, classification, confidence });

    // Tokens reais do gateway (fallback heurístico)
    const tIn = Number(out?.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4));
    const tOut = Number(out?.usage?.completion_tokens ?? Math.ceil(content.length / 4));
    const cost = estimateCost(CLASSIFICATION_MODEL, tIn, tOut);

    const { error: updErr } = await svc
      .from("client_files")
      .update({
        classification,
        classification_confidence: confidence,
        classification_source: "auto",
        classification_version: CLASSIFICATION_VERSION,
        classification_model: CLASSIFICATION_MODEL,
        classification_at: new Date().toISOString(),
      })
      .eq("id", file.id);
    if (updErr) throw new Error(`update classification: ${updErr.message}`);

    console.log("classify:persisted", { file_id: file.id, classification });

    // PR-3.7: telemetria (best-effort)
    await logAiUsage(svc, {
      organization_id: file.organization_id,
      profile_id: file.uploaded_by,
      operation: "classification",
      provider: "lovable",
      model: CLASSIFICATION_MODEL,
      tokens_input: tIn,
      tokens_output: tOut,
      cost_estimated: cost,
      processing_time_ms: Date.now() - startedAt,
      case_id: file.case_id ?? null,
      client_id: file.client_id ?? null,
      file_id: file.id,
      prompt_summary: summaryTag("classification", file.id),
      metadata: { edge_function: "classify-document", status: "success", classification, confidence, sample_chars: sample.length },
    });

    return json({ ok: true, classification, confidence });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("classify:error", { file_id: body.file_id, msg });
    await svc
      .from("client_files")
      .update({ pipeline_stage: "failed", pipeline_last_error: `classify: ${msg}` })
      .eq("id", file.id);
    return json({ error: msg }, 500);
  }
});

