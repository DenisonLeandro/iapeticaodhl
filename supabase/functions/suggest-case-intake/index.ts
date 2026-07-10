// =============================================================================
// Edge Function: suggest-case-intake (PR-4.3A)
// Recebe caseId, lê a ficha (case_intake_forms) + dados básicos do caso,
// chama LLM para devolver sugestão estruturada (área, subtipo, perguntas,
// documentos, riscos, próximos passos) e persiste em ai_suggested_*.
// Telemetria sem PII.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";
import { estimateCost } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRUCTURE = `{
  "suggested_area": "",
  "suggested_subtype": "",
  "missing_information": [],
  "complementary_questions": [],
  "recommended_documents": [],
  "initial_risks": [],
  "next_steps": []
}`;

const SYSTEM_PROMPT = `Você é um assistente jurídico brasileiro full service. Recebe a Ficha Inteligente de um caso e devolve sugestões PRELIMINARES para apoiar o advogado.

REGRAS:
- NÃO invente fatos, valores ou jurisprudência. Use apenas o que está na ficha.
- Se a ficha estiver vazia, retorne arrays vazios e indique nas "missing_information" que faltam dados básicos.
- A área sugerida deve ser uma destas (use exatamente este valor): trabalhista, previdenciario, civel, consumidor, familia, empresarial, contratos, bancario, imobiliario, cobranca_execucao, responsabilidade_civil, acidente, outra.
- "complementary_questions" deve ter perguntas objetivas para o cliente (máx. 7).
- "recommended_documents" deve listar documentos típicos da área provável (máx. 8).
- Use português do Brasil, listas curtas e objetivas.

SAÍDA OBRIGATÓRIA: APENAS um JSON válido seguindo EXATAMENTE este formato (sem markdown, sem comentários):
${STRUCTURE}`;

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function extractJson(text: string): unknown {
  const cleaned = (text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch { return null; }
    return null;
  }
}

function arr(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim()).slice(0, 12)
    : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 200) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const caseId = (body?.caseId ?? "") as string;
    if (!caseId) return json({ error: "caseId é obrigatório" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // 1. Confirma que o caso pertence à organização do usuário (via RLS do user-client)
    const { data: caseRow, error: caseErr } = await supabase
      .from("cases")
      .select("id, organization_id, client_id, case_number, court, subject, opposing_party, represented_party")
      .eq("id", caseId)
      .maybeSingle();
    if (caseErr || !caseRow) return json({ error: "Caso não encontrado" }, 404);

    // 2. Carrega ficha (também via RLS)
    const { data: intake } = await supabase
      .from("case_intake_forms")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();

    // 3. Monta prompt
    const fichaBlock = intake
      ? [
          `Área indicada: ${intake.legal_area ?? "(não informada)"}${intake.legal_area_other ? ` / ${intake.legal_area_other}` : ""}`,
          `Parte representada: ${intake.represented_party ?? "(não informada)"}`,
          `Parte contrária: ${intake.opposing_party ?? "—"}`,
          `Resumo: ${truncate(intake.problem_summary, 800) || "(vazio)"}`,
          `Relato: ${truncate(intake.client_story, 4000) || "(vazio)"}`,
          `Objetivo: ${intake.client_goal ?? "—"}${intake.client_goal_other ? ` (${intake.client_goal_other})` : ""}`,
          `Urgência: ${intake.urgency ?? "—"}; Prazo: ${intake.deadline_date ?? "—"}`,
          `Período dos fatos: ${intake.facts_period ?? "—"}; Local: ${intake.facts_location ?? "—"}; Valores: ${intake.amount_involved ?? "—"}`,
          `Documentos existentes: ${truncate(intake.existing_documents, 800) || "—"}`,
          `Documentos faltantes percebidos: ${truncate(intake.missing_documents, 800) || "—"}`,
          `Testemunhas: ${truncate(intake.witnesses, 400) || "—"}`,
          `Outras provas: ${truncate(intake.other_evidence, 400) || "—"}`,
          `Processo existente: ${intake.has_existing_lawsuit ? "sim" : "não/indef."} (${intake.existing_case_number ?? caseRow.case_number ?? "—"})`,
          `Observações internas do advogado: ${truncate(intake.internal_notes, 800) || "—"}`,
        ].join("\n")
      : "(Ficha ainda não preenchida.)";

    const caseBlock = [
      `Número do processo: ${caseRow.case_number?.trim() || "(caso sem processo)"}`,
      `Assunto: ${caseRow.subject ?? "—"}`,
      `Parte contrária (cadastro): ${caseRow.opposing_party ?? "—"}`,
    ].join("\n");

    const userPrompt = [
      "Analise a Ficha Inteligente abaixo e devolva sugestões preliminares.",
      "",
      "DADOS DO CASO:",
      caseBlock,
      "",
      "FICHA:",
      fichaBlock,
      "",
      `Retorne APENAS o JSON: ${STRUCTURE}`,
    ].join("\n");

    // 4. LLM
    const taskChoice = selectAIModelForTask("analyze_case");
    const llmStart = Date.now();
    const llmRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: taskChoice.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (llmRes.status === 429) return json({ error: "Limite de requisições atingido. Tente em instantes." }, 429);
    if (llmRes.status === 402) return json({ error: "Créditos da IA esgotados." }, 402);
    if (!llmRes.ok) return json({ error: `LLM ${llmRes.status}: ${(await llmRes.text()).slice(0, 200)}` }, 500);

    const llmData = await llmRes.json();
    const llmMs = Date.now() - llmStart;
    const rawText: string = llmData?.choices?.[0]?.message?.content ?? "";
    const inputTokens = llmData?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
    const outputTokens = llmData?.usage?.completion_tokens ?? Math.ceil(rawText.length / 4);

    const parsed = extractJson(rawText) as Record<string, unknown> | null;
    const suggestion = {
      suggested_area: str(parsed?.suggested_area),
      suggested_subtype: str(parsed?.suggested_subtype),
      missing_information: arr(parsed?.missing_information),
      complementary_questions: arr(parsed?.complementary_questions),
      recommended_documents: arr(parsed?.recommended_documents),
      initial_risks: arr(parsed?.initial_risks),
      next_steps: arr(parsed?.next_steps),
    };

    // 5. Persiste sugestão (cria ficha vazia se ainda não existir)
    const upsertPayload = {
      case_id: caseId,
      organization_id: caseRow.organization_id,
      client_id: caseRow.client_id ?? null,
      ai_suggested_area: suggestion.suggested_area || null,
      ai_suggested_subtype: suggestion.suggested_subtype || null,
      ai_missing_information: suggestion.missing_information,
      ai_complementary_questions: suggestion.complementary_questions,
      ai_recommended_documents: suggestion.recommended_documents,
      ai_initial_risks: suggestion.initial_risks,
      ai_next_steps: suggestion.next_steps,
      ai_suggested_at: new Date().toISOString(),
      updated_by: userId,
    };

    const { error: upsertErr } = await admin
      .from("case_intake_forms")
      .upsert(upsertPayload, { onConflict: "case_id" });
    if (upsertErr) console.error("suggest-case-intake:upsert", upsertErr.message);

    // 6. Telemetria (sem PII)
    const totalMs = Date.now() - startedAt;
    const cost = estimateCost(taskChoice.model, inputTokens, outputTokens);
    await logAiUsage(admin, {
      organization_id: caseRow.organization_id,
      profile_id: userId,
      operation: "case_analysis",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      cost_estimated: cost,
      processing_time_ms: totalMs,
      case_id: caseId,
      client_id: caseRow.client_id ?? null,
      prompt_summary: summaryTag("case_analysis", `intake-${caseId}`),
      metadata: {
        edge_function: "suggest-case-intake",
        status: "success",
        subop: "intake_suggestion",
        has_intake: !!intake,
        has_story: !!(intake?.client_story && intake.client_story.length > 0),
        has_summary: !!(intake?.problem_summary && intake.problem_summary.length > 0),
        legal_area_hint: intake?.legal_area ?? null,
        llm_ms: llmMs,
      },
    });

    return json({ suggestion });
  } catch (e) {
    const msg = (e as Error).message || "erro desconhecido";
    console.error("suggest-case-intake:error", msg);
    return json({ error: msg }, 500);
  }
});
