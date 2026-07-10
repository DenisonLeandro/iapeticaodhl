// =============================================================================
// PR-4.4B.2 — senior-legal-review
// Revisor jurídico sênior sob demanda. Retorna relatório estruturado + sugestões acionáveis.
// NÃO altera a peça — o UI decide se aplica melhorias via apply-senior-review-to-draft.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";
import { estimateCost } from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é um advogado sênior brasileiro com mais de 25 anos de atuação. Sua tarefa é revisar uma MINUTA em busca de falhas.
Não reescreva a peça. Produza APENAS um relatório objetivo em JSON válido.

REGRAS DE SAÍDA (obrigatórias):
- Responda APENAS com um objeto JSON válido.
- Proibido: markdown, blocos \`\`\`json, comentários, texto antes ou depois do JSON.
- Todos os campos string devem estar entre aspas duplas.
- Use exatamente o schema abaixo.

Regras de qualidade a verificar:
- Pedidos faltantes vs. blocos obrigatórios do escritório.
- Pedidos sem base documental/fática.
- Fundamentos desatualizados (Súmula 450/TST vs. ADPF 501/STF, ADI 5.766/STF, art. 71 §4º pós-Reforma, insalubridade sem base).
- Jurisprudência sem link/fonte oficial ou expressões vagas ("jurisprudência pacífica").
- Pedidos com risco alto que exigem confirmação.
- Valores ausentes e cálculos pendentes.
- Contradições internas.
- Pontos em que a peça está abaixo do modelo/padrão do escritório.

SCHEMA:
{
  "senior_review": "texto da análise em prosa, resumindo os principais achados",
  "overall_score": 0,
  "recommendation": "aprovar|revisar|reescrever",
  "missing_requests": [],
  "requests_without_documental_basis": [],
  "outdated_grounds": [],
  "jurisprudence_without_link": [],
  "high_risk_items": [],
  "missing_values": [],
  "pending_calculations": [],
  "internal_contradictions": [],
  "gaps_vs_template": [],
  "improvement_suggestions": [],
  "should_rewrite": false,
  "suggestions": [
    {
      "titulo": "string curta",
      "descricao": "1-2 frases em linguagem clara",
      "fundamento_juridico": "artigo/súmula/tese",
      "trecho_sugerido": "texto pronto para inserção",
      "local_recomendado_na_peca": "Fatos|Pedidos|Preliminares|...",
      "categoria": "pedido_faltante|fundamento|documento|risco|valor|contradicao|melhoria",
      "severidade": "baixa|media|alta|critica"
    }
  ]
}

O array "suggestions" deve conter de 3 a 15 itens acionáveis quando possível. Se não houver sugestões, retorne "suggestions": [].`;

/**
 * Parser robusto: aceita JSON puro, cercado por fences ``` ou ```json,
 * com texto antes/depois, ou apenas prosa. Nunca lança.
 */
function parseSeniorReviewResponse(rawText: string): {
  parsed: Record<string, unknown> | null;
  parseMode: "json" | "json_in_fence" | "json_substring" | "prose_fallback" | "empty";
} {
  const raw = (rawText ?? "").trim();
  if (!raw) return { parsed: null, parseMode: "empty" };

  // 1. JSON puro
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") return { parsed: p as Record<string, unknown>, parseMode: "json" };
  } catch { /* continue */ }

  // 2. Remover fences ```json ... ``` ou ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      const p = JSON.parse(fenceMatch[1].trim());
      if (p && typeof p === "object") return { parsed: p as Record<string, unknown>, parseMode: "json_in_fence" };
    } catch { /* continue */ }
  }

  // 3. Primeiro { até último }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const slice = raw.slice(first, last + 1);
    try {
      const p = JSON.parse(slice);
      if (p && typeof p === "object") return { parsed: p as Record<string, unknown>, parseMode: "json_substring" };
    } catch { /* continue */ }
  }

  // 4. Fallback: retornar como prosa
  return {
    parsed: { senior_review: raw, suggestions: [] } as Record<string, unknown>,
    parseMode: "prose_fallback",
  };
}

type RawSuggestion = {
  id?: string;
  titulo?: string;
  descricao?: string;
  fundamento_juridico?: string;
  trecho_sugerido?: string;
  local_recomendado_na_peca?: string;
  categoria?: string;
  severidade?: string;
};

function buildSuggestions(parsed: Record<string, unknown>): Array<Record<string, unknown>> {
  const rawList = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(rawList)) return [];
  return (rawList as RawSuggestion[])
    .filter((s) => s && typeof s === "object")
    .map((s, i) => ({
      id: typeof s.id === "string" && s.id ? s.id : `sug_${Date.now().toString(36)}_${i}`,
      titulo: String(s.titulo ?? "").slice(0, 200) || `Sugestão ${i + 1}`,
      descricao: String(s.descricao ?? "").slice(0, 1200),
      fundamento_juridico: String(s.fundamento_juridico ?? "").slice(0, 600),
      trecho_sugerido: String(s.trecho_sugerido ?? "").slice(0, 4000),
      local_recomendado_na_peca: String(s.local_recomendado_na_peca ?? "").slice(0, 120),
      categoria: String(s.categoria ?? "melhoria").slice(0, 60),
      severidade: String(s.severidade ?? "sugestao").slice(0, 40),
      status: "pending",
    }));
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
    if (!res.ok) return { raw: "", input_tokens: 0, output_tokens: 0, ms, http_status: res.status };
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    return {
      raw,
      input_tokens: data?.usage?.prompt_tokens ?? Math.ceil(user.length / 4),
      output_tokens: data?.usage?.completion_tokens ?? Math.ceil(raw.length / 4),
      ms, http_status: res.status,
    };
  } catch (e) {
    return { raw: "", input_tokens: 0, output_tokens: 0, ms: Date.now() - start, http_status: (e as Error).name === "AbortError" ? 599 : 0 };
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
Avalie a minuta como advogado sênior e retorne o relatório JSON solicitado, incluindo o array "suggestions" com melhorias acionáveis.`;

  try {
    const res = await callLlm(apiKey, taskChoice.model, prompt);

    // Falha real de rede / HTTP — sem conteúdo do LLM.
    if (!res.raw && res.http_status !== 200) {
      await admin.from("case_drafts").update({
        senior_review_status: "failed",
        senior_review_apply_error: `llm_http_${res.http_status}`,
      }).eq("id", draftId);
      return json({ status: "failed", error: "llm_unavailable", http_status: res.http_status }, 200);
    }

    const { parsed, parseMode } = parseSeniorReviewResponse(res.raw);
    const structured = parsed ?? { senior_review: res.raw, suggestions: [] };
    const suggestions = buildSuggestions(structured as Record<string, unknown>);
    const parseFailed = parseMode === "prose_fallback" || parseMode === "empty";

    if (parseFailed) {
      console.warn("senior-legal-review:parse_failed", {
        draft_id: draftId,
        parse_mode: parseMode,
        raw_length: res.raw.length,
      });
    }

    const now = new Date().toISOString();
    await admin.from("case_drafts").update({
      senior_review: structured,
      senior_review_suggestions: suggestions,
      senior_review_status: "done",
      senior_review_at: now,
      senior_review_apply_status: null,
      senior_review_apply_error: parseFailed ? `parse_failed:${parseMode}` : null,
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
      cost_estimated: estimateCost(taskChoice.model, res.input_tokens, res.output_tokens),
      processing_time_ms: Date.now() - startedAt,
      case_id: draft.case_id,
      prompt_summary: `senior:${draftId.slice(0, 8)}`,
      metadata: {
        edge_function: "senior-legal-review",
        status: parseFailed ? "error" : "success",
        overall_score: typeof (structured as { overall_score?: number }).overall_score === "number"
          ? (structured as { overall_score: number }).overall_score : null,
        should_rewrite: (structured as { should_rewrite?: boolean }).should_rewrite === true,
        suggestions_count: suggestions.length,
        parse_mode: parseMode,
      },
    });

    return json({
      status: "done",
      draft_id: draftId,
      senior_review: structured,
      suggestions,
      parse_mode: parseMode,
      structured_ok: !parseFailed,
    });
  } catch (e) {
    console.error("senior-legal-review:error", (e as Error).message);
    await admin.from("case_drafts").update({ senior_review_status: "failed" }).eq("id", draftId);
    return json({ status: "failed", error: (e as Error).message }, 200);
  }
});
