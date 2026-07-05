// =============================================================================
// PR-4.4B.2 — senior-legal-review
// Revisor jurídico sênior sob demanda. Retorna relatório estruturado.
// NÃO altera a peça — o UI decide se aplica melhorias (nova versão via update).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é um advogado sênior brasileiro com mais de 25 anos de atuação. Sua tarefa é revisar uma MINUTA em busca de falhas.
Não reescreva a peça. Produza APENAS um relatório objetivo em JSON.

Regras de qualidade a verificar:
- Pedidos faltantes vs. blocos obrigatórios do escritório.
- Pedidos sem base documental/fática.
- Fundamentos desatualizados (Súmula 450/TST vs. ADPF 501/STF, ADI 5.766/STF, art. 71 §4º pós-Reforma, insalubridade sem base).
- Jurisprudência sem link/fonte oficial ou expressões vagas ("jurisprudência pacífica").
- Pedidos com risco alto que exigem confirmação.
- Valores ausentes e cálculos pendentes.
- Contradições internas.
- Pontos em que a peça está abaixo do modelo/padrão do escritório.
- Cópia indevida de fatos do modelo.

Retorne APENAS JSON:
{
  "missing_requests": string[],
  "requests_without_documental_basis": string[],
  "outdated_grounds": string[],
  "jurisprudence_without_link": string[],
  "high_risk_items": string[],
  "missing_values": string[],
  "pending_calculations": string[],
  "internal_contradictions": string[],
  "gaps_vs_template": string[],
  "improvement_suggestions": string[],
  "overall_score": number,
  "should_rewrite": boolean
}`;

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fallback */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callLlm(apiKey: string, model: string, user: string) {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    if (!res.ok) return { parsed: null, input_tokens: 0, output_tokens: 0, ms, http_status: res.status };
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    return {
      parsed: extractJson(raw),
      input_tokens: data?.usage?.prompt_tokens ?? Math.ceil(user.length / 4),
      output_tokens: data?.usage?.completion_tokens ?? Math.ceil(raw.length / 4),
      ms, http_status: res.status,
    };
  } catch (e) {
    return { parsed: null, input_tokens: 0, output_tokens: 0, ms: Date.now() - start, http_status: (e as Error).name === "AbortError" ? 599 : 0 };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const startedAt = Date.now();
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return json({ error: "no_organization" }, 403);

  let body: { draft_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const draftId = body.draft_id;
  if (!draftId) return json({ error: "draft_id_required" }, 400);

  const { data: draft } = await admin
    .from("case_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft) return json({ error: "draft_not_found" }, 404);
  if (draft.organization_id !== profile.organization_id) return json({ error: "forbidden" }, 403);

  await admin.from("case_drafts").update({ senior_review_status: "running" }).eq("id", draftId);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    await admin.from("case_drafts").update({ senior_review_status: "failed" }).eq("id", draftId);
    return json({ error: "missing_api_key" }, 500);
  }

  const taskChoice = selectAIModelForTask("legal_draft_generation");
  const content = String(draft.content ?? "").slice(0, 24000);
  const claimMap = JSON.stringify(draft.claim_map ?? {}).slice(0, 6000);

  const prompt = `# MINUTA
${content}

# CLAIM_MAP (referência)
${claimMap}

# TAREFA
Avalie a minuta como advogado sênior e retorne o relatório JSON solicitado.`;

  try {
    const res = await callLlm(apiKey, taskChoice.model, prompt);
    if (!res.parsed) {
      await admin.from("case_drafts").update({ senior_review_status: "failed" }).eq("id", draftId);
      return json({ status: "failed", error: "llm_invalid_response" }, 200);
    }

    const now = new Date().toISOString();
    await admin.from("case_drafts").update({
      senior_review: res.parsed,
      senior_review_status: "done",
      senior_review_at: now,
      tokens_input: (draft.tokens_input ?? 0) + res.input_tokens,
      tokens_output: (draft.tokens_output ?? 0) + res.output_tokens,
    }).eq("id", draftId);

    await logAiUsage(admin, {
      organization_id: profile.organization_id,
      profile_id: user.id,
      operation: "legal_draft_senior_review",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: res.input_tokens,
      tokens_output: res.output_tokens,
      cost_estimated: 0,
      processing_time_ms: Date.now() - startedAt,
      case_id: draft.case_id,
      prompt_summary: `senior:${draftId.slice(0, 8)}`,
      metadata: {
        overall_score: typeof (res.parsed as { overall_score?: number }).overall_score === "number"
          ? (res.parsed as { overall_score: number }).overall_score : null,
        should_rewrite: (res.parsed as { should_rewrite?: boolean }).should_rewrite === true,
      },
    });

    return json({ status: "done", draft_id: draftId, senior_review: res.parsed });
  } catch (e) {
    console.error("senior-legal-review:error", (e as Error).message);
    await admin.from("case_drafts").update({ senior_review_status: "failed" }).eq("id", draftId);
    return json({ status: "failed", error: (e as Error).message }, 200);
  }
});
