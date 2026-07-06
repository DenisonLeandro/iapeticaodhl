// =============================================================================
// PR-4.5B — apply-senior-review-to-draft
// Aplica sugestões aceitas do revisor sênior à minuta atual, preservando estrutura.
// Snapshot da versão anterior em case_draft_versions. Não gera peça do zero.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `Você é um advogado sênior brasileiro editando uma MINUTA existente.
Sua tarefa NÃO é reescrever a peça. Sua tarefa é INCORPORAR apenas as sugestões aceitas listadas, preservando integralmente a estrutura, o estilo e o conteúdo existente da minuta.

Regras obrigatórias:
- Aplique SOMENTE as sugestões aceitas fornecidas. Não invente sugestões novas.
- PRESERVE nomes completos das partes exatamente como estão.
- PRESERVE todos os fatos já descritos na minuta.
- PRESERVE todos os pedidos existentes.
- PRESERVE todos os valores, datas, números de processo e documentos citados.
- NÃO invente fatos, documentos, datas, valores, partes ou jurisprudência.
- NÃO exclua capítulos, seções ou parágrafos que não tenham relação direta com as sugestões aceitas.
- MANTENHA a estrutura, títulos, numeração de seções, ordem, cabeçalho, endereçamento, qualificações e assinaturas.
- Melhore apenas os pontos necessários para incorporar cada sugestão aceita.
- Ao aplicar cada sugestão, incorpore o "trecho_sugerido" na seção indicada em "local_recomendado_na_peca" quando fizer sentido; caso contrário, no local mais natural sem quebrar a estrutura.
- Se a sugestão for redundante com o que já existe, ignore-a sem duplicar conteúdo.
- Preserve todos os marcadores [PENDENTE: ...] existentes se ainda forem aplicáveis.
- Retorne APENAS o texto completo e revisado da minuta, sem comentários, sem cabeçalhos de resposta, sem markdown de bloco de código.`;

type Suggestion = {
  id: string;
  titulo: string;
  descricao: string;
  fundamento_juridico?: string;
  trecho_sugerido?: string;
  local_recomendado_na_peca?: string;
  categoria?: string;
  severidade?: string;
  status?: string;
};

function renderSuggestions(list: Suggestion[]): string {
  return list.map((s, i) => `
[${i + 1}] ${s.titulo}
Descrição: ${s.descricao}
Fundamento: ${s.fundamento_juridico ?? ""}
Local recomendado: ${s.local_recomendado_na_peca ?? ""}
Trecho sugerido: ${s.trecho_sugerido ?? ""}`.trim()).join("\n\n");
}

async function callLlm(apiKey: string, model: string, user: string) {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
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
      }),
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { text: null, input_tokens: 0, output_tokens: 0, ms, http_status: res.status, error: errText };
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return {
      text,
      input_tokens: data?.usage?.prompt_tokens ?? Math.ceil(user.length / 4),
      output_tokens: data?.usage?.completion_tokens ?? Math.ceil(text.length / 4),
      ms, http_status: res.status, error: null,
    };
  } catch (e) {
    return { text: null, input_tokens: 0, output_tokens: 0, ms: Date.now() - start, http_status: (e as Error).name === "AbortError" ? 599 : 0, error: (e as Error).message };
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

  let body: { draft_id?: string; accepted_suggestion_ids?: string[] };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const draftId = body.draft_id;
  const acceptedIds = Array.isArray(body.accepted_suggestion_ids) ? body.accepted_suggestion_ids : [];
  if (!draftId) return json({ error: "draft_id_required" }, 400);
  if (acceptedIds.length === 0) return json({ error: "no_suggestions_accepted" }, 400);

  const { data: draft } = await admin
    .from("case_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft) return json({ error: "draft_not_found" }, 404);
  if (draft.organization_id !== profile.organization_id) return json({ error: "forbidden" }, 403);

  const currentSuggestions: Suggestion[] = Array.isArray(draft.senior_review_suggestions)
    ? (draft.senior_review_suggestions as Suggestion[]) : [];
  // Defensive: só aplica sugestões cujo ID foi enviado E que não estejam já rejeitadas/aplicadas.
  const accepted = currentSuggestions.filter(
    (s) => acceptedIds.includes(s.id) && s.status !== "rejected" && s.status !== "applied",
  );
  if (accepted.length === 0) return json({ error: "accepted_ids_not_found" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  // Marca aplicando
  await admin.from("case_drafts").update({
    senior_review_apply_status: "applying",
    senior_review_apply_error: null,
  }).eq("id", draftId);

  // Snapshot da versão atual ANTES de qualquer alteração
  const { data: versionRow, error: versionErr } = await admin
    .from("case_draft_versions")
    .insert({
      organization_id: profile.organization_id,
      draft_id: draftId,
      content: String(draft.content ?? ""),
      source: "before_senior_review_apply",
      applied_suggestion_ids: null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionErr) {
    await admin.from("case_drafts").update({
      senior_review_apply_status: "error",
      senior_review_apply_error: `snapshot_failed: ${versionErr.message}`.slice(0, 500),
    }).eq("id", draftId);
    return json({ error: "snapshot_failed", detail: versionErr.message }, 500);
  }

  const taskChoice = selectAIModelForTask("legal_draft_generation");
  const currentContent = String(draft.content ?? "").slice(0, 40000);
  const seniorProse = JSON.stringify(draft.senior_review ?? {}).slice(0, 6000);
  const suggestionsBlock = renderSuggestions(accepted).slice(0, 12000);

  const userPrompt = `# MINUTA ATUAL
${currentContent}

# RELATÓRIO DA REVISÃO SÊNIOR (contexto)
${seniorProse}

# SUGESTÕES ACEITAS PARA INCORPORAR (${accepted.length})
${suggestionsBlock}

# TAREFA
Reescreva a MINUTA ATUAL incorporando as sugestões aceitas acima, preservando estrutura, seções e estilo.
Retorne APENAS o texto completo revisado, sem comentários.`;

  try {
    const res = await callLlm(apiKey, taskChoice.model, userPrompt);
    if (!res.text) {
      await admin.from("case_drafts").update({
        senior_review_apply_status: "error",
        senior_review_apply_error: `llm_failed: http=${res.http_status} ${res.error ?? ""}`.slice(0, 500),
      }).eq("id", draftId);
      return json({ status: "error", error: "llm_failed" }, 200);
    }

    // Atualiza sugestões: aceitas → applied
    const updatedSuggestions = currentSuggestions.map((s) =>
      acceptedIds.includes(s.id) ? { ...s, status: "applied" } : s,
    );

    const now = new Date().toISOString();
    await admin.from("case_drafts").update({
      content: res.text,
      senior_review_suggestions: updatedSuggestions,
      senior_review_apply_status: "done",
      senior_review_apply_error: null,
      senior_review_applied_at: now,
      updated_by: user.id,
      tokens_input: (draft.tokens_input ?? 0) + res.input_tokens,
      tokens_output: (draft.tokens_output ?? 0) + res.output_tokens,
    }).eq("id", draftId);

    // Nova versão após aplicação
    const { data: newVersion } = await admin
      .from("case_draft_versions")
      .insert({
        organization_id: profile.organization_id,
        draft_id: draftId,
        content: res.text,
        source: "senior_review_applied",
        applied_suggestion_ids: acceptedIds,
        created_by: user.id,
      })
      .select("id")
      .single();

    await logAiUsage(admin, {
      organization_id: profile.organization_id,
      profile_id: user.id,
      operation: "legal_draft_senior_apply",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: res.input_tokens,
      tokens_output: res.output_tokens,
      cost_estimated: 0,
      processing_time_ms: Date.now() - startedAt,
      case_id: draft.case_id,
      prompt_summary: `senior_apply:${draftId.slice(0, 8)}`,
      metadata: {
        applied_count: accepted.length,
        previous_version_id: versionRow.id,
        new_version_id: newVersion?.id ?? null,
      },
    });

    return json({
      status: "done",
      draft_id: draftId,
      previous_version_id: versionRow.id,
      new_version_id: newVersion?.id ?? null,
      applied_ids: acceptedIds,
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("apply-senior-review-to-draft:error", msg);
    await admin.from("case_drafts").update({
      senior_review_apply_status: "error",
      senior_review_apply_error: msg.slice(0, 500),
    }).eq("id", draftId);
    return json({ status: "error", error: msg }, 200);
  }
});
