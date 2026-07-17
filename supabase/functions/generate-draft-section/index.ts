// =============================================================================
// PR-3 — generate-draft-section
// Gera o conteúdo de UMA seção da minuta por capítulos e salva em
// case_draft_sections.content. NÃO altera case_drafts.content.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { selectModelForTask } from "../_shared/model-router.ts";
import { getEconomyMode } from "../_shared/economy-mode.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { estimateCost } from "../_shared/pricing.ts";
import { getChapter } from "../_shared/structure/trabalhista-inicial.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Stage = "auth" | "load" | "llm" | "save" | "unknown";

interface Payload {
  draft_id?: string;
  section_id?: string;
  force_regenerate?: boolean;
  /** Fase 2 · Bloco 1 — força modelo forte para esta seção. */
  high_precision?: boolean;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(stage: Stage, message: string, code = "section_failed", status = 500, details = "") {
  console.error(`generate-draft-section:${stage}`, { code, status, message, details: String(details).slice(0, 240) });
  return json({ success: false, code, stage, message }, status);
}
function truncate(s: unknown, n: number): string {
  if (typeof s !== "string") return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// -----------------------------------------------------------------------------
// Instruções por tipo de seção — mantidas curtas; o LLM recebe também o contexto.
// -----------------------------------------------------------------------------
const SECTION_INSTRUCTIONS: Record<string, string> = {
  enderecamento:
    "Redija APENAS o endereçamento da petição inicial trabalhista, respeitando a Vara/Comarca informada. Se a Vara/Comarca não estiver clara, use marcador [COMPLETAR VARA/COMARCA]. Não escreva qualificação nem fatos.",
  qualificacao:
    "Redija APENAS a qualificação das partes (autor e ré) usando os dados existentes. Para campos ausentes use marcadores como [COMPLETAR CPF], [COMPLETAR ENDEREÇO], [COMPLETAR CNPJ]. NÃO invente dados. Não redija fatos.",
  dados_funcionais:
    "Redija APENAS a seção de dados contratuais e funcionais (admissão, demissão, função, salário, jornada, contrato). Use somente informações presentes; para lacunas use marcadores como [COMPLETAR DATA ADMISSÃO], [COMPLETAR SALÁRIO]. Não invente.",
  sintese_fatos:
    "Redija a Síntese dos fatos em linguagem natural, objetiva, humana e cronológica. Não repita a qualificação. Não inicie análise jurídica. Use marcadores para lacunas relevantes.",
  justica_gratuita:
    "Redija o pedido de gratuidade da justiça no padrão trabalhista (art. 790, §§3º e 4º da CLT / declaração de hipossuficiência). Curto e objetivo.",
  preliminares:
    "Analise se há fundamento para preliminares (ex.: incompetência, ilegitimidade, conexão, prescrição alegada pela ré em contestação futura NÃO aplicável aqui). Se NÃO houver preliminar cabível, responda EXATAMENTE com a string: SKIP_SECTION. Caso contrário, redija apenas as preliminares cabíveis.",
  rol_pedidos_valores:
    "Redija o ROL objetivo de pedidos com valores individualizados por pedido, baseado exclusivamente nos capítulos de mérito já gerados e nos dados do caso. Onde não houver base de cálculo segura, use [CALCULAR VALOR] ou a expressão 'valor meramente estimativo, a apurar em liquidação'. NÃO repita fundamentação. NÃO inclua requerimentos finais (citação, produção de provas, etc.).",
  valor_causa:
    "Redija a atribuição do Valor da Causa. Some os valores dos pedidos, se seguros. Caso contrário, use [CALCULAR VALOR DA CAUSA].",
  pedido_final:
    "Redija os REQUERIMENTOS FINAIS da petição (citação da ré, produção de provas, procedência dos pedidos, condenação em honorários, benefícios da justiça gratuita já pleiteados etc.) conforme padrão do escritório, se houver modelo. NÃO inclua o rol de pedidos com valores — esse já foi redigido separadamente. Não repita fundamentação.",
  fechamento:
    "Redija o fechamento padrão da petição (local, data, assinatura do advogado, OAB). Use marcadores [LOCAL], [DATA], [ADVOGADO], [OAB] quando não houver dado.",
};

function instructionForSection(key: string): string {
  if (SECTION_INSTRUCTIONS[key]) return SECTION_INSTRUCTIONS[key];
  if (key.startsWith("merito_")) {
    return `Redija o capítulo de MÉRITO "${key}" da petição inicial trabalhista, contendo:
- breve exposição fática pertinente ao pedido (sem repetir toda a síntese dos fatos);
- fundamento jurídico com base legal atual (CLT, CF, súmulas/OJs vigentes; NÃO cite tese superada);
- conexão com documentos disponíveis, quando houver (referenciar tipo de documento, sem inventar);
- ressalvas explícitas se faltar prova/documento essencial;
- pedido específico deste capítulo (SEM valor — o valor vai no rol de pedidos).
Linguagem jurídica objetiva. NÃO inventar fatos, datas, documentos ou valores.`;
  }
  return `Redija o conteúdo da seção "${key}" da petição inicial trabalhista, no padrão do escritório. Não invente dados.`;
}

async function callLlm(apiKey: string, model: string, system: string, user: string, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false as const, status: res.status, text };
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage ?? {};
    return {
      ok: true as const,
      content,
      tokens_input: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
      tokens_output: typeof usage.completion_tokens === "number" ? usage.completion_tokens : null,
    };
  } catch (e) {
    return { ok: false as const, status: 0, text: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("unknown", "Método não suportado.", "method_not_allowed", 405);

  let admin: ReturnType<typeof createClient> | null = null;
  let sectionId: string | undefined;
  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return err("auth", "Sessão expirada. Faça login novamente.", "unauthorized", 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return err("auth", "Sessão expirada. Faça login novamente.", "unauthorized", 401);

    const { data: profile } = await admin
      .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (!profile?.organization_id) return err("auth", "Usuário sem organização vinculada.", "no_organization", 403);

    let body: Payload;
    try { body = await req.json(); } catch { return err("unknown", "Requisição inválida.", "invalid_body", 400); }

    const draftId = body.draft_id;
    sectionId = body.section_id;
    if (!draftId || !sectionId) {
      return err("load", "draft_id e section_id são obrigatórios.", "missing_ids", 400);
    }

    // --- Carrega section ---
    const { data: section, error: secErr } = await admin
      .from("case_draft_sections").select("*").eq("id", sectionId).maybeSingle();
    if (secErr || !section) return err("load", "Capítulo não encontrado.", "section_not_found", 404);
    if (section.organization_id !== profile.organization_id) {
      return err("load", "Acesso negado ao capítulo.", "forbidden", 403);
    }
    if (section.draft_id !== draftId) {
      return err("load", "Capítulo não pertence a esta minuta.", "section_draft_mismatch", 400);
    }
    if (
      !body.force_regenerate &&
      (section.status === "generated" || section.status === "approved" || section.status === "edited")
    ) {
      return json({ success: true, section_id: sectionId, skipped: true, reason: "already_generated" });
    }

    // Marca "generating"
    await admin
      .from("case_draft_sections")
      .update({ status: "generating", last_error: null, updated_by: user.id })
      .eq("id", sectionId);

    // --- Carrega draft ---
    const { data: draft, error: drErr } = await admin
      .from("case_drafts").select("*").eq("id", draftId).maybeSingle();
    if (drErr || !draft) throw new Error("draft_not_found");
    if (draft.organization_id !== profile.organization_id) throw new Error("forbidden");

    // --- Carrega caso ---
    const { data: caseRow } = await admin
      .from("cases").select("*").eq("id", draft.case_id).maybeSingle();

    // --- Carrega intake, análise, sections geradas ---
    const [{ data: intake }, { data: analysis }, { data: sisters }] = await Promise.all([
      admin.from("case_intake_forms").select("*").eq("case_id", draft.case_id).maybeSingle(),
      admin.from("case_analyses").select("*").eq("case_id", draft.case_id).eq("status", "done")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("case_draft_sections").select("section_key,section_label,order_index,content,status")
        .eq("draft_id", draftId).order("order_index", { ascending: true }),
    ]);

    // Template do escritório (se apontado no draft)
    let templateContent: string | null = null;
    if (draft.template_id) {
      const { data: tmpl } = await admin
        .from("legal_templates").select("content,title").eq("id", draft.template_id).maybeSingle();
      templateContent = (tmpl?.content as string | null) ?? null;
    }

    // Playbook (se houver)
    let playbookSummary: string | null = null;
    if (draft.playbook_snapshot) {
      try {
        playbookSummary = truncate(JSON.stringify(draft.playbook_snapshot), 2500);
      } catch { /* noop */ }
    }

    // Contexto das outras seções (resumo curto para evitar tokens explosivos)
    const otherSectionsSummary = (sisters ?? [])
      .filter((s: { id?: string }) => (s as { section_key: string }).section_key !== section.section_key)
      .map((s) => {
        const row = s as { section_key: string; section_label: string; status: string; content: string | null };
        const snippet = row.content ? truncate(row.content, 400) : "(ainda não gerado)";
        return `## ${row.section_label} [${row.section_key}] — status: ${row.status}\n${snippet}`;
      })
      .join("\n\n");

    // Ordem canônica do ROL: fornecida ANTES da geração (não há reordenação de
    // texto). Só se aplica quando a seção é o rol de pedidos. Deriva das seções
    // irmãs (já ordenadas por order_index canônico), consolidando jornada +
    // intervalo numa única alínea via grouping_key.
    let rolOrderGuidance = "";
    if (section.section_key === "rol_pedidos_valores") {
      const seenGroups = new Set<string>();
      const orderedItems: string[] = [];
      for (const s of (sisters ?? [])) {
        const row = s as { section_key: string; section_label: string };
        const spec = getChapter(row.section_key);
        if (!spec || !spec.requires_final_request) continue;
        const groupId = spec.grouping_key ?? spec.section_key;
        if (seenGroups.has(groupId)) continue;
        seenGroups.add(groupId);
        orderedItems.push(row.section_label);
      }
      if (orderedItems.length > 0) {
        rolOrderGuidance = `# ORDEM DO ROL (obrigatória — mesma ordem dos capítulos)
Redija as alíneas do rol NESTA ordem, incluindo apenas as que tiverem capítulo/base correspondente e omitindo as demais sem alterar a posição relativa:
${orderedItems.map((t, i) => `${i + 1}. ${t}`).join("\n")}
Observação: jornada, horas extras e intervalo intrajornada devem constar em UMA ÚNICA alínea consolidada.`;
      }
    }

    const hint = (section.quality_notes as { hint?: string } | null)?.hint ?? "";

    const system = `Você é um advogado trabalhista sênior brasileiro, redigindo UMA seção específica de uma petição inicial trabalhista. Regras invioláveis:
- NÃO invente fatos, datas, documentos, valores ou jurisprudência.
- Use marcadores explícitos (ex.: [COMPLETAR CPF]) quando faltar informação relevante.
- Preserve o estilo do modelo do escritório quando fornecido.
- Não repita conteúdo que já pertence claramente a outra seção.
- Retorne APENAS o texto da seção (sem preâmbulo, sem markdown de título grande, sem "aqui está").
- Nunca cite tese jurídica superada. Se em dúvida, prefira omitir ou sinalizar em [ALERTA:...].`;

    const specific = instructionForSection(section.section_key);

    const userMsg = `# SEÇÃO A REDIGIR
Chave: ${section.section_key}
Rótulo: ${section.section_label}
Nota do planejamento: ${hint || "(sem nota específica)"}

# INSTRUÇÃO ESPECÍFICA
${specific}
${rolOrderGuidance ? `\n${rolOrderGuidance}\n` : ""}
# CONTEXTO DO CASO
Área jurídica: ${caseRow?.legal_area ?? "trabalhista"}
Assunto: ${caseRow?.subject ?? ""}
Parte representada: ${caseRow?.represented_party ?? ""}
Nº processo: ${caseRow?.case_number ?? "(sem número)"}
Objetivo do advogado: ${draft.objective ?? ""}
Instruções extras: ${draft.additional_instructions ?? ""}

# INTAKE (resumo)
Resumo do problema: ${truncate((intake as { problem_summary?: string } | null)?.problem_summary, 2000)}
História do cliente: ${truncate((intake as { client_story?: string } | null)?.client_story, 3000)}

# ANÁLISE DO CASO (resumo)
${truncate((analysis as { content_json?: { summary?: string } } | null)?.content_json?.summary, 1500)}

# MODELO DO ESCRITÓRIO
${templateContent ? truncate(templateContent, 4000) : "(sem modelo específico)"}

# PLAYBOOK
${playbookSummary ?? "(sem playbook)"}

# OUTRAS SEÇÕES (resumo para evitar repetição)
${otherSectionsSummary || "(sem outras seções ainda)"}

Agora redija SOMENTE o texto da seção "${section.section_label}".`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      await admin.from("case_draft_sections").update({
        status: "failed",
        last_error: "LOVABLE_API_KEY ausente",
        updated_by: user.id,
      }).eq("id", sectionId);
      return err("llm", "Configuração de IA indisponível.", "no_api_key", 500);
    }

    const economyMode = await getEconomyMode(admin, profile.organization_id);
    const highPrecision = body.high_precision === true;
    const modelChoice = selectModelForTask("generate_draft_section", { economyMode, highPrecision });
    const result = await callLlm(apiKey, modelChoice.model, system, userMsg, 90000);

    if (!result.ok) {
      const httpStatus = result.status;
      const friendly =
        httpStatus === 429 ? "Limite de requisições da IA atingido. Tente novamente em instantes."
        : httpStatus === 402 ? "Créditos de IA esgotados. Adicione créditos para continuar."
        : "Falha ao chamar a IA para gerar o capítulo.";
      await admin.from("case_draft_sections").update({
        status: "failed",
        last_error: `llm_http_${httpStatus}: ${truncate(result.text, 300)}`,
        updated_by: user.id,
      }).eq("id", sectionId);
      // Telemetria de falha (não bloqueia resposta)
      try {
        await logAiUsage(admin, {
          organization_id: profile.organization_id,
          profile_id: user.id,
          operation: "legal_draft_generation",
          provider: modelChoice.provider,
          model: modelChoice.model,
          tokens_input: 0,
          tokens_output: 0,
          cost_estimated: 0,
          processing_time_ms: Date.now() - startedAt,
          case_id: draft.case_id,
          prompt_summary: `draft_section:${sectionId.slice(0, 8)}`,
          metadata: {
            edge_function: "generate-draft-section",
            source: "generate_draft_section",
            draft_id: draftId,
            section_id: sectionId,
            section_key: section.section_key,
            status: "error",
            http_status: httpStatus,
            force_regenerate: !!body.force_regenerate,
            high_precision: highPrecision,
            economy_mode: economyMode,
          },
        });
      } catch { /* noop */ }
      // Retorna 200 para 5xx/timeout/rede a fim de evitar blank screen no cliente
      // (o service layer trata success:false e exibe mensagem amigável).
      // 429 e 402 seguem com seu status original para sinalizar billing/rate-limit.
      const httpOut = httpStatus === 429 || httpStatus === 402 ? httpStatus : 200;
      return json({ success: false, code: "llm_http", stage: "llm", message: friendly, status: httpStatus, fallback: httpOut === 200 }, httpOut);
    }

    const rawText = (result.content ?? "").trim();

    // Suporte a preliminares vazias.
    const isSkip = rawText === "SKIP_SECTION" || /^SKIP_SECTION\b/.test(rawText);
    const finalContent = isSkip ? "" : rawText;
    const finalStatus = isSkip ? "skipped" : "generated";

    // quality_notes: preservar hint anterior + alertas detectados
    const alerts: string[] = [];
    const alertRegex = /\[ALERTA:[^\]]+\]/g;
    const matches = rawText.match(alertRegex);
    if (matches) alerts.push(...matches.slice(0, 20));
    const priorNotes = (section.quality_notes as Record<string, unknown> | null) ?? {};
    const nextNotes: Record<string, unknown> = { ...priorNotes };
    if (alerts.length > 0) nextNotes.alerts = alerts;
    if (finalContent.includes("[COMPLETAR") || finalContent.includes("[CALCULAR")) {
      nextNotes.has_placeholders = true;
    }

    // Custo estimado (USD) — usa tabela central de preços. Se modelo não estiver
    // catalogado, estimateCost retorna 0; nesse caso persistimos null.
    const tIn = result.tokens_input ?? 0;
    const tOut = result.tokens_output ?? 0;
    const costUsd = estimateCost(modelChoice.model, tIn, tOut);
    const costForSection = costUsd > 0 ? costUsd : null;

    // Prompt auditável (resumido)
    const auditPrompt = {
      section_key: section.section_key,
      model: modelChoice.model,
      objective: draft.objective ?? null,
      used_template: !!templateContent,
      used_playbook: !!playbookSummary,
      used_intake: !!intake,
      used_analysis: !!analysis,
      force_regenerate: !!body.force_regenerate,
      generated_at: new Date().toISOString(),
    };

    const { error: saveErr } = await admin.from("case_draft_sections").update({
      content: finalContent,
      status: finalStatus,
      model_used: modelChoice.model,
      tokens_input: result.tokens_input,
      tokens_output: result.tokens_output,
      cost_estimate: costForSection,
      generation_prompt: auditPrompt,
      quality_notes: Object.keys(nextNotes).length > 0 ? nextNotes : null,
      last_error: null,
      updated_by: user.id,
    }).eq("id", sectionId);

    if (saveErr) return err("save", "Falha ao salvar capítulo gerado.", "save_failed", 500, saveErr.message);

    // Telemetria de sucesso (metadados apenas — sem conteúdo jurídico)
    try {
      await logAiUsage(admin, {
        organization_id: profile.organization_id,
        profile_id: user.id,
        operation: "legal_draft_generation",
        provider: modelChoice.provider,
        model: modelChoice.model,
        tokens_input: tIn,
        tokens_output: tOut,
        cost_estimated: costUsd,
        processing_time_ms: Date.now() - startedAt,
        case_id: draft.case_id,
        prompt_summary: `draft_section:${sectionId.slice(0, 8)}`,
        metadata: {
          edge_function: "generate-draft-section",
          source: "generate_draft_section",
          draft_id: draftId,
          section_id: sectionId,
          section_key: section.section_key,
          section_status: finalStatus,
          status: "success",
          used_template: !!templateContent,
          used_playbook: !!playbookSummary,
          used_intake: !!intake,
          used_analysis: !!analysis,
          force_regenerate: !!body.force_regenerate,
          high_precision: highPrecision,
          economy_mode: economyMode,
          content_chars: finalContent.length,
          alerts: alerts.length,
          has_placeholders: !!nextNotes.has_placeholders,
        },
      });
    } catch { /* noop */ }

    return json({
      success: true,
      section_id: sectionId,
      status: finalStatus,
      chars: finalContent.length,
      alerts: alerts.length,
    });
  } catch (e) {
    const msg = (e as Error).message || "unexpected";
    if (admin && sectionId) {
      try {
        await admin.from("case_draft_sections").update({
          status: "failed",
          last_error: truncate(msg, 500),
        }).eq("id", sectionId);
      } catch { /* noop */ }
    }
    return err("unknown", "Falha inesperada ao gerar o capítulo.", "unexpected", 500, msg);
  }
});
