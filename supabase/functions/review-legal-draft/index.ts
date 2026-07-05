// =============================================================================
// PR-4.4B.1.1 — review-legal-draft
// Fase 2 assíncrona: quality_gate + rewrite opcional.
// Chamada logo após generate-legal-draft (fire-and-forget) e via polling do UI.
//
// Regras:
// - Só executa se quality_status ∈ {pending, failed}. Update condicional evita corrida.
// - Se o draft foi editado depois da geração (updated_at > created_at ou content
//   mudou), NÃO sobrescreve o content: salva apenas quality_report + warning.
// - Nunca loga content, claim_map completo ou quality_report bruto em telemetria.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";
import { validateJurisprudence } from "../_shared/jurisprudence-validator.ts";
import { detectSensitiveAlerts } from "../_shared/sensitive-theses.ts";
import {
  NON_LIMITATION_TOPIC,
  NON_LIMITATION_TOPIC_HEADER,
  NON_LIMITATION_REQUEST,
  SUCCESSIVE_RESCISAO_INDIRETA_TOPIC,
  SUCCESSIVE_RESCISAO_INDIRETA_REQUEST,
  MOTORISTA_EXHIBITION_LIST,
  detectMotoristaProfile,
} from "../_shared/legal-blocks.ts";

// -----------------------------------------------------------------------
// Post-checks determinísticos de qualidade da peça (PR-4.4B.2C)
// -----------------------------------------------------------------------
interface DeterministicFinding {
  severidade: "risco_alto" | "atencao" | "pendencia_documental" | "sugestao_estrategica";
  topico: string;
  motivo: string;
  sugestao: string;
}

function runDeterministicQualityChecks(
  content: string,
  opts: { isTrabalhistaInicial: boolean; isMotorista: boolean; hasRescisaoIndireta: boolean; contractCrossesReform: boolean },
): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];
  if (!opts.isTrabalhistaInicial) return findings;
  const lower = content.toLowerCase();

  // 1. Tópico obrigatório de não limitação
  if (!content.includes(NON_LIMITATION_TOPIC_HEADER)) {
    findings.push({
      severidade: "risco_alto",
      topico: "Não limitação da condenação",
      motivo: `O tópico obrigatório "${NON_LIMITATION_TOPIC_HEADER}" não foi encontrado na peça.`,
      sugestao: NON_LIMITATION_TOPIC,
    });
  }

  // 2. Item de não limitação no pedido final
  if (!/não limita(?:ndo)? a condena[cç][aã]o/i.test(content)) {
    findings.push({
      severidade: "risco_alto",
      topico: "Pedido final — não limitação",
      motivo: 'Falta item de pedido final com "NÃO LIMITANDO A CONDENAÇÃO".',
      sugestao: NON_LIMITATION_REQUEST,
    });
  }

  // 3. Sucessivo da rescisão indireta
  if (opts.hasRescisaoIndireta) {
    const hasSucTopic = /pedido sucessivo.*rescis[aã]o indireta|hip[oó]tese de n[aã]o reconhecimento da rescis[aã]o indireta/i.test(content);
    if (!hasSucTopic) {
      findings.push({
        severidade: "risco_alto",
        topico: "Pedido sucessivo — rescisão indireta",
        motivo: "A peça sustenta rescisão indireta mas não contém o tópico sucessivo para hipótese de não reconhecimento.",
        sugestao: SUCCESSIVE_RESCISAO_INDIRETA_TOPIC,
      });
    }
    if (!/sucessivamente.*n[aã]o reconhecimento da rescis[aã]o indireta/i.test(content)) {
      findings.push({
        severidade: "risco_alto",
        topico: "Pedido final — sucessivo rescisão indireta",
        motivo: "Falta item específico de pedido sucessivo no pedido final para a hipótese de não reconhecimento da rescisão indireta.",
        sugestao: SUCCESSIVE_RESCISAO_INDIRETA_REQUEST,
      });
    }
  }

  // 4. Exibição ampliada motorista
  if (opts.isMotorista) {
    const canonical = MOTORISTA_EXHIBITION_LIST.map((d) =>
      d.toLowerCase().replace(/\([^)]*\)/g, "").trim().split(/[\s/,]+/)[0]
    );
    const present = canonical.filter((k) => k.length >= 3 && lower.includes(k)).length;
    if (present < 10) {
      findings.push({
        severidade: "atencao",
        topico: "Exibição de documentos — motorista profissional",
        motivo: `A peça cita apenas ${present} itens da lista canônica ampliada de documentos do motorista (mínimo esperado: 10).`,
        sugestao:
          "Requer-se, sob pena das consequências do art. 400 do CPC e da Súmula 338, I, do TST, a exibição pela Reclamada dos seguintes documentos: " +
          MOTORISTA_EXHIBITION_LIST.join("; ") + ".",
      });
    }
  }

  // 5. Insalubridade — evitar analogia com Súmula 448/TST
  if (/s[uú]mula\s*448/i.test(content) && /analogi[ac]/i.test(content)) {
    const hasCLT = /art(?:s|igos)?\.?\s*18[9-9]|art(?:s|igos)?\.?\s*19[0-2]/i.test(content);
    const hasNR15 = /nr[- ]?15/i.test(content);
    if (!hasCLT || !hasNR15) {
      findings.push({
        severidade: "atencao",
        topico: "Insalubridade — fundamentação frágil",
        motivo: "A peça invoca Súmula 448/TST por analogia sem fundamentar simultaneamente em arts. 189/192 CLT e NR-15.",
        sugestao:
          "Substituir a analogia à Súmula 448/TST por fundamentação direta: arts. 189, 190, 191 e 192 da CLT c/c NR-15 (agentes químicos, ruído, vibração, calor), com pedido de perícia técnica (art. 195 CLT) e nomeação de perito. Base de cálculo: [REVISAR SV 4/STF e entendimento atual do TST].",
      });
    }
  }

  // 6. Intrajornada pós-Reforma
  if (opts.contractCrossesReform || /(ap[oó]s|posterior).*11\/11\/2017|(ap[oó]s|posterior).*reforma trabalhista/i.test(content)) {
    if (/pagamento integral do intervalo|pagamento integral do per[ií]odo (intra|de intervalo)/i.test(content) &&
        !/revisar aplica[cç][aã]o temporal|art\.?\s*71,?\s*§4/i.test(content)) {
      findings.push({
        severidade: "atencao",
        topico: "Intervalo intrajornada — pós-Reforma",
        motivo: "A peça afirma pagamento integral do intervalo intrajornada para contratos pós-Reforma sem marcar revisão do art. 71, §4º, CLT.",
        sugestao:
          "Substituir por: 'Indenização pela supressão do INTERVALO INTRAJORNADA (art. 71, §4º, CLT). Para períodos contratuais posteriores a 11/11/2017: apenas o tempo SUPRIMIDO, natureza indenizatória. Para períodos anteriores: aplicar Súmula 437/TST (pagamento integral com natureza salarial e reflexos). Segmentar por período — [REVISAR APLICAÇÃO TEMPORAL — art. 71, §4º, CLT pós-Reforma].'",
      });
    }
  }

  return findings;
}


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MIN_ACCEPTABLE_CONTENT_CHARS = 3500;

const QUALITY_GATE_SYSTEM = `Você é um revisor sênior. Avalie a MINUTA fornecida contra o CLAIM_MAP e o TEMPLATE_BLUEPRINT.
Regras:
- Não reescreva; apenas avalie.
- Considere "weak_topic" um tópico presente mas raso (menos de ~4 parágrafos ou sem fundamento legal específico ou sem pedido correspondente).
- Considere "missing_topic" um topic com include=true no claim_map que não está desenvolvido na minuta.
- needs_rewrite=true quando: is_too_short=true, OU matches_template_depth=false, OU há missing_topics/weak_topics relevantes, OU pedido final é raso, OU faltam reflexos/sucessivos aplicáveis.

REGRA CRÍTICA para o array "findings":
- NÃO dizer apenas "tópico frouxo" ou "faltou pedido". EXPLIQUE o motivo em uma frase objetiva.
- Sempre apresentar em "sugestao" um TEXTO PRONTO PARA COPIAR (parágrafo/tópico redigido em português jurídico), não uma orientação genérica.
- CLASSIFIQUE como "risco_alto" e sugira substituição pelo marcador "[CALCULAR VALOR — revisar memória de cálculo]" SEMPRE que a minuta transcrever valores monetários, número de dias, meses ou frações (ex.: "14 dias", "17 dias", "11/12 avos", "33 dias", "R$ ...") que não conferem com a memória de cálculo ou que representem cálculo parcial/incerto/inconsistente.
- Classifique cada finding em severidade:
  * "risco_alto": omissão que pode causar improcedência ou prescrição, OU valor/cálculo inconsistente transcrito na peça.
  * "atencao": lacuna relevante mas com margem de correção.
  * "pendencia_documental": falta de documento cuja exibição a peça deveria requerer.
  * "sugestao_estrategica": melhoria de tese/estrutura.

Retorne APENAS JSON:
{
  "is_too_short": bool,
  "matches_template_depth": bool,
  "has_preliminaries": bool,
  "has_factual_section": bool,
  "has_legal_basis_per_topic": bool,
  "has_detailed_requests": bool,
  "has_reflexes": bool,
  "has_successive_requests_when_applicable": bool,
  "has_burden_of_proof_when_applicable": bool,
  "has_points_to_confirm": bool,
  "avoids_copying_template_facts": bool,
  "missing_topics": string[],
  "weak_topics": string[],
  "quality_alerts": string[],
  "needs_rewrite": bool,
  "findings": [
    { "severidade": "risco_alto"|"atencao"|"pendencia_documental"|"sugestao_estrategica",
      "topico": string, "motivo": string, "sugestao": string }
  ]
}`;

const REWRITE_SYSTEM = `Você é assistente jurídico redator sênior. Reescreva a minuta aprofundando os tópicos apontados. NÃO reduza a peça. Nunca copie fatos do modelo. Responda SOMENTE JSON:
{ "title": string, "content": string, "warnings": string[], "missing_information": string[] }`;

interface LlmResult {
  raw: string;
  parsed: Record<string, unknown> | null;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  http_status: number;
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fallback */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function stringifyList(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map((x) => `- ${String(x)}`).join("\n");
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return ""; }
}

async function callLlm(
  apiKey: string,
  model: string,
  system: string,
  userPrompt: string,
): Promise<LlmResult> {
  const start = Date.now();
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const ms = Date.now() - start;
  if (!res.ok) {
    const detail = await res.text();
    console.error("review-legal-draft:llm_error", res.status, detail.slice(0, 200));
    return { raw: "", parsed: null, input_tokens: 0, output_tokens: 0, ms, http_status: res.status };
  }
  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  const input_tokens = data?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
  const output_tokens = data?.usage?.completion_tokens ?? Math.ceil(raw.length / 4);
  return { raw, parsed: extractJson(raw), input_tokens, output_tokens, ms, http_status: res.status };
}

function buildTemplateBlueprint(template: Record<string, unknown> | null) {
  if (!template) {
    return {
      has_template: false,
      minimum_depth: "complete_professional_petition",
      expected_section_count: 10,
    };
  }
  const sections = Array.isArray(template.standard_sections) ? template.standard_sections as unknown[] : [];
  const topics = Array.isArray(template.topic_structure) ? template.topic_structure as unknown[] : [];
  return {
    has_template: true,
    minimum_depth: "complete_professional_petition",
    expected_section_count: Math.max(sections.length, topics.length, 10),
    structure_summary: template.structure_summary ?? "",
    style_summary: template.style_summary ?? "",
    standard_sections: sections,
    topic_structure: topics,
    request_patterns: template.request_patterns ?? [],
  };
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
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile } = await admin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return json({ error: "no_organization" }, 403);

  let body: { draft_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const draftId = body.draft_id;
  if (!draftId) return json({ error: "draft_id_required" }, 400);

  // Carrega draft
  const { data: draft, error: draftErr } = await admin
    .from("case_drafts").select("*").eq("id", draftId).maybeSingle();
  if (draftErr) return json({ error: "draft_lookup_failed", detail: draftErr.message }, 500);
  if (!draft) return json({ error: "draft_not_found" }, 404);
  if (draft.organization_id !== profile.organization_id) return json({ error: "forbidden" }, 403);

  // Idempotência + guarda por status
  if (draft.quality_status === "running") {
    return json({ status: "already_running" }, 200);
  }
  if (draft.quality_status === "done") {
    return json({ status: "already_done" }, 200);
  }
  if (draft.quality_status !== "pending" && draft.quality_status !== "failed") {
    return json({ status: "not_applicable", quality_status: draft.quality_status }, 200);
  }

  // Update condicional (evita corrida entre invocações simultâneas)
  const { data: claimed, error: claimErr } = await admin
    .from("case_drafts")
    .update({ quality_status: "running" })
    .eq("id", draftId)
    .in("quality_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (claimErr) return json({ error: "claim_failed", detail: claimErr.message }, 500);
  if (!claimed) return json({ status: "already_claimed" }, 200);

  const originalContent: string = String(draft.content ?? "");
  const originalContentLen = originalContent.length;
  const originalUpdatedAt = draft.updated_at as string;

  // Template opcional para blueprint
  let template: Record<string, unknown> | null = null;
  if (draft.template_id) {
    const { data } = await admin
      .from("legal_templates")
      .select("id,organization_id,structure_summary,style_summary,standard_sections,topic_structure,request_patterns")
      .eq("id", draft.template_id).maybeSingle();
    if (data && (data as Record<string, unknown>).organization_id === profile.organization_id) {
      template = data;
    }
  }
  const templateBlueprint = buildTemplateBlueprint(template);
  const claimMap = (draft.claim_map ?? { topics: [] }) as Record<string, unknown>;
  const claimMapForPrompt = JSON.stringify(claimMap).slice(0, 8000);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    await admin.from("case_drafts").update({
      quality_status: "failed",
      warnings: [
        ...(Array.isArray(draft.warnings) ? draft.warnings : []),
        "Revisão automática indisponível: chave LOVABLE_API_KEY não configurada.",
      ].slice(0, 50),
    }).eq("id", draftId);
    return json({ error: "missing_api_key" }, 500);
  }

  const taskChoice = selectAIModelForTask("legal_draft_generation");
  const totalTokens = { input: 0, output: 0 };

  try {
    // -----------------------------------------------------------------------
    // QUALITY_GATE
    // -----------------------------------------------------------------------
    const qgPrompt = `# CLAIM_MAP
${claimMapForPrompt}

# TEMPLATE_BLUEPRINT
${JSON.stringify(templateBlueprint)}

# MINUTA
${originalContent.slice(0, 24000)}`;
    const qgRes = await callLlm(apiKey, taskChoice.model, QUALITY_GATE_SYSTEM, qgPrompt);
    totalTokens.input += qgRes.input_tokens;
    totalTokens.output += qgRes.output_tokens;

    let qualityReport: Record<string, unknown> | null = qgRes.parsed;
    if (!qualityReport) {
      qualityReport = {
        is_too_short: originalContentLen < MIN_ACCEPTABLE_CONTENT_CHARS,
        matches_template_depth: false,
        needs_rewrite: false,
        missing_topics: [],
        weak_topics: [],
        quality_alerts: ["Revisão automática de qualidade indisponível — revisar manualmente."],
      };
    }
    if (originalContentLen < MIN_ACCEPTABLE_CONTENT_CHARS) {
      (qualityReport as Record<string, unknown>).is_too_short = true;
      (qualityReport as Record<string, unknown>).needs_rewrite = true;
    }

    const missingTopics = (qualityReport as { missing_topics?: unknown[] }).missing_topics ?? [];
    const weakTopics = (qualityReport as { weak_topics?: unknown[] }).weak_topics ?? [];
    const qaAlerts = (qualityReport as { quality_alerts?: unknown[] }).quality_alerts ?? [];
    const needsRewrite = (qualityReport as { needs_rewrite?: boolean }).needs_rewrite === true;

    // -----------------------------------------------------------------------
    // REWRITE (só se necessário, 1x)
    // -----------------------------------------------------------------------
    let finalContent = originalContent;
    let finalTitle: string | null = null;
    let rewriteWarnings: string[] = [];
    let rewriteMissing: string[] = [];
    let rewriteApplied = false;
    let rewriteSkippedDueToEdit = false;

    if (needsRewrite) {
      // Checa se draft foi editado durante a revisão
      const { data: fresh } = await admin
        .from("case_drafts").select("content,updated_at").eq("id", draftId).maybeSingle();
      const edited = fresh && (fresh.updated_at !== originalUpdatedAt || fresh.content !== originalContent);

      if (edited) {
        rewriteSkippedDueToEdit = true;
      } else {
        const rewritePrompt = `# CLAIM_MAP
${claimMapForPrompt}

# TEMPLATE_BLUEPRINT
${JSON.stringify(templateBlueprint)}

# MINUTA ATUAL (aprofundar, não reduzir)
${originalContent}

# CORRIGIR OBRIGATORIAMENTE
Tópicos ausentes: ${stringifyList(missingTopics)}
Tópicos fracos: ${stringifyList(weakTopics)}
Alertas: ${stringifyList(qaAlerts)}

Reescreva a peça expandindo/aprofundando tudo. NÃO reduza. Continue proibida a cópia de fatos do modelo.`;
        const rwRes = await callLlm(apiKey, taskChoice.model, REWRITE_SYSTEM, rewritePrompt);
        totalTokens.input += rwRes.input_tokens;
        totalTokens.output += rwRes.output_tokens;

        if (rwRes.parsed && typeof rwRes.parsed.content === "string" &&
            (rwRes.parsed.content as string).length >= originalContentLen * 0.9) {
          finalContent = String(rwRes.parsed.content).trim();
          finalTitle = String(rwRes.parsed.title ?? draft.title ?? "").slice(0, 200) || null;
          if (Array.isArray(rwRes.parsed.warnings)) {
            rewriteWarnings = (rwRes.parsed.warnings as unknown[]).map(String).slice(0, 30);
          }
          if (Array.isArray(rwRes.parsed.missing_information)) {
            rewriteMissing = (rwRes.parsed.missing_information as unknown[]).map(String).slice(0, 30);
          }
          rewriteApplied = true;
        }
      }
    }

    (qualityReport as Record<string, unknown>).rewrite_applied = rewriteApplied;
    if (rewriteSkippedDueToEdit) {
      (qualityReport as Record<string, unknown>).rewrite_skipped_reason = "draft_edited_during_review";
    }

    // -----------------------------------------------------------------------
    // Validação de jurisprudência + alertas sensíveis (SEM apagar fundamentação)
    // -----------------------------------------------------------------------
    const jurisValidation = validateJurisprudence(finalContent);
    finalContent = jurisValidation.content;
    const sensitiveAlerts = detectSensitiveAlerts(finalContent);
    (qualityReport as Record<string, unknown>).jurisprudence_replacements = jurisValidation.replacements;
    (qualityReport as Record<string, unknown>).jurisprudence_vague_expressions = jurisValidation.vague_expressions;
    (qualityReport as Record<string, unknown>).sensitive_alerts = sensitiveAlerts;

    // -----------------------------------------------------------------------
    // Consolida warnings
    // -----------------------------------------------------------------------
    const baseWarnings = Array.isArray(draft.warnings) ? (draft.warnings as string[]) : [];
    const merged = new Set<string>();
    for (const w of baseWarnings) {
      // remove o aviso de "revisão ainda não executada"
      if (!/revisão automática de qualidade ainda não foi executada/i.test(w)) merged.add(w);
    }
    for (const w of rewriteWarnings) merged.add(w);
    for (const t of (missingTopics as unknown[]).map(String)) merged.add(`Tópico ausente/insuficiente: ${t}`);
    for (const t of (weakTopics as unknown[]).map(String)) merged.add(`Tópico frouxo: ${t}`);
    for (const a of (qaAlerts as unknown[]).map(String)) merged.add(a);
    for (const w of jurisValidation.warnings) merged.add(w);
    for (const sa of sensitiveAlerts) {
      merged.add(`[${sa.severity === "high" ? "RISCO ALTO" : sa.severity === "medium" ? "REVISAR" : "ATENÇÃO"}] ${sa.message}`);
    }
    if (rewriteSkippedDueToEdit) {
      merged.add("A reescrita não foi aplicada porque a minuta foi editada durante a revisão.");
    }
    const finalWarnings = Array.from(merged).slice(0, 80);

    const baseMissing = Array.isArray(draft.missing_information) ? (draft.missing_information as string[]) : [];
    const mergedMissing = Array.from(new Set([...(rewriteApplied ? rewriteMissing : baseMissing)])).slice(0, 30);

    // -----------------------------------------------------------------------
    // Persistência final
    // -----------------------------------------------------------------------
    const patch: Record<string, unknown> = {
      quality_status: "done",
      quality_report: qualityReport,
      warnings: finalWarnings,
      missing_information: mergedMissing,
      tokens_input: (draft.tokens_input ?? 0) + totalTokens.input,
      tokens_output: (draft.tokens_output ?? 0) + totalTokens.output,
    };
    // O jurisprudence-validator pode ter alterado finalContent mesmo sem rewrite.
    if (rewriteApplied || jurisValidation.replacements > 0 || jurisValidation.vague_expressions > 0) {
      patch.content = finalContent;
      if (rewriteApplied && finalTitle) patch.title = finalTitle;

    }

    // Update condicional final: se draft foi editado após início da review,
    // NÃO sobrescreve content — salva só quality_report/warnings.
    const { data: freshBeforeSave } = await admin
      .from("case_drafts").select("content,updated_at").eq("id", draftId).maybeSingle();
    if (freshBeforeSave && (freshBeforeSave.updated_at !== originalUpdatedAt || freshBeforeSave.content !== originalContent)) {
      delete patch.content;
      delete patch.title;
      const guarded = new Set(finalWarnings);
      guarded.add("A reescrita não foi aplicada porque a minuta foi editada durante a revisão.");
      patch.warnings = Array.from(guarded).slice(0, 50);
    }

    const { error: upErr } = await admin.from("case_drafts").update(patch).eq("id", draftId);
    if (upErr) throw new Error(upErr.message);

    await logAiUsage(admin, {
      organization_id: profile.organization_id,
      profile_id: user.id,
      operation: "legal_draft_review",
      provider: taskChoice.provider,
      model: taskChoice.model,
      tokens_input: totalTokens.input,
      tokens_output: totalTokens.output,
      cost_estimated: 0,
      processing_time_ms: Date.now() - startedAt,
      case_id: draft.case_id,
      prompt_summary: `review:${draftId.slice(0, 8)}`,
      metadata: {
        needs_rewrite: needsRewrite,
        rewrite_applied: rewriteApplied,
        rewrite_skipped_due_to_edit: rewriteSkippedDueToEdit,
        missing_topics_count: (missingTopics as unknown[]).length,
        weak_topics_count: (weakTopics as unknown[]).length,
        quality_alerts_count: (qaAlerts as unknown[]).length,
        content_chars: (patch.content ? String(patch.content).length : originalContentLen),
      },
    });

    return json({
      status: "done",
      draft_id: draftId,
      quality_report: qualityReport,
      rewrite_applied: rewriteApplied,
      rewrite_skipped_due_to_edit: rewriteSkippedDueToEdit,
    });
  } catch (e) {
    const msg = (e as Error).message || "unknown_error";
    console.error("review-legal-draft:error", msg);
    const baseWarnings = Array.isArray(draft.warnings) ? (draft.warnings as string[]) : [];
    const merged = new Set<string>(baseWarnings);
    merged.add("Não foi possível concluir a revisão automática. A minuta original foi preservada.");
    await admin.from("case_drafts").update({
      quality_status: "failed",
      warnings: Array.from(merged).slice(0, 50),
    }).eq("id", draftId);
    return json({ status: "failed", error: msg }, 200);
  }
});
