// =============================================================================
// PR-4.4B — generate-legal-draft
// Gera minuta de peça jurídica combinando Ficha + Análise + Documentos + Modelo.
//
// Regras críticas:
//   - Modelo do escritório é APENAS referência de estrutura/estilo/pedidos.
//   - Nunca copiar fatos/nomes/CPFs/valores/datas do modelo.
//   - Fatos vêm SOMENTE de ficha/análise/documentos do caso atual.
//   - Marcar lacunas com [CONFIRMAR ...] quando faltar informação.
//   - Multi-tenant estrito via organization_id.
//   - Nunca gravar conteúdo da minuta em telemetria.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_CHUNK_SNIPPET_CHARS = 900;
const MAX_CHUNKS = 8;
const MAX_INTAKE_STORY_CHARS = 6000;
const MAX_ANALYSIS_CHARS = 6000;

const DRAFT_TYPE_LABELS: Record<string, string> = {
  initial_petition: "Petição inicial",
  manifestation: "Manifestação simples",
  extrajudicial_notice: "Notificação extrajudicial",
  opinion: "Parecer/nota técnica",
  other: "Peça jurídica",
};

const SYSTEM_PROMPT = `Você é assistente jurídico redator de peças no Brasil.
Sua tarefa é gerar MINUTA REVISÁVEL, não peça final protocolável.

REGRAS OBRIGATÓRIAS:
- Você produz uma MINUTA de trabalho para o advogado revisar antes do protocolo.
- Nunca prometa êxito nem garanta resultado.
- Nunca invente fatos, datas, valores, nomes de partes ou documentos.
- Se o MODELO DO ESCRITÓRIO for fornecido, use-o APENAS como referência de estrutura, estilo, ordem dos tópicos, forma de narrar, padrão de pedidos e forma de fechamento. NUNCA copie fatos, nomes, CPFs/CNPJs, endereços, valores, datas ou fundamentos específicos do modelo — esses dados pertencem a outro caso.
- Os FATOS da peça devem vir SOMENTE da Ficha Inteligente, Análise Inicial, Documentos do caso atual e Instruções do advogado.
- Diferencie: fatos relatados pelo cliente, fatos documentados, inferências da análise, pontos a confirmar.
- Se um documento foi apenas mencionado (não anexado), use "[ANEXAR DOCUMENTO]" em vez de afirmar que existe.
- Marque lacunas usando exatamente estes marcadores quando faltar informação:
  [CONFIRMAR COM O CLIENTE], [INFORMAR DATA], [INFORMAR VALOR], [ANEXAR DOCUMENTO], [REVISAR FUNDAMENTO]
- Inclua pedidos SOMENTE quando houver base fática mínima nas fontes. Sem base: "[CONFIRMAR COM O CLIENTE A BASE FÁTICA DESTE PEDIDO]".
- Ao final, inclua a seção "PONTOS A CONFIRMAR ANTES DO PROTOCOLO" listando lacunas identificadas.

FORMATO DA RESPOSTA:
Retorne EXCLUSIVAMENTE um JSON válido com este schema:
{
  "title": "Título curto da minuta",
  "content": "Conteúdo da minuta em texto corrido, com quebras de linha e cabeçalhos de seção em MAIÚSCULAS. Sem markdown de código.",
  "warnings": ["alerta 1", "alerta 2"],
  "missing_information": ["item pendente 1", "item pendente 2"]
}`;

interface Payload {
  case_id?: string;
  draft_type?: string;
  objective?: string;
  tone?: string;
  template_id?: string | null;
  use_intake?: boolean;
  use_analysis?: boolean;
  use_documents?: boolean;
  use_template?: boolean;
  use_chat_history?: boolean;
  additional_instructions?: string;
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch { /* try fenced */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function stringifyList(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map((x) => `- ${String(x)}`).join("\n");
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
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
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return json({ error: "no_organization" }, 403);

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const caseId = body.case_id;
  const draftType = body.draft_type ?? "other";
  if (!caseId) return json({ error: "case_id_required" }, 400);

  // Caso + org check
  const { data: caseRow, error: caseErr } = await admin
    .from("cases")
    .select("*, clients(id,name,document_number)")
    .eq("id", caseId)
    .maybeSingle();
  if (caseErr || !caseRow) return json({ error: "case_not_found" }, 404);
  if (caseRow.organization_id !== profile.organization_id) {
    return json({ error: "forbidden" }, 403);
  }

  // Fontes
  const sourcesUsed: Record<string, boolean> = {
    intake: false,
    analysis: false,
    documents: false,
    template: false,
    chat_history: false,
  };

  // Ficha
  let intake: Record<string, unknown> | null = null;
  if (body.use_intake !== false) {
    const { data } = await admin
      .from("case_intake_forms")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();
    if (data) {
      intake = data;
      sourcesUsed.intake = true;
    }
  }

  // Análise
  let analysis: Record<string, unknown> | null = null;
  if (body.use_analysis !== false) {
    const { data } = await admin
      .from("case_analyses")
      .select("*")
      .eq("case_id", caseId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      analysis = data;
      sourcesUsed.analysis = true;
    }
  }

  // Documentos
  let docsSummary = "";
  if (body.use_documents !== false) {
    const { data: files } = await admin
      .from("client_files")
      .select("id,file_name,classification,analysis_summary,processing_status")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (files && files.length > 0) {
      sourcesUsed.documents = true;
      const lines: string[] = [];
      for (const f of files) {
        lines.push(
          `- ${f.file_name}${f.classification ? ` [${f.classification}]` : ""}${
            f.analysis_summary ? `: ${truncate(f.analysis_summary, 400)}` : ""
          }`,
        );
      }
      docsSummary = lines.join("\n");

      // Snippets de chunks (contexto textual leve)
      const fileIds = files.map((f) => f.id);
      const { data: chunks } = await admin
        .from("document_chunks")
        .select("file_id,content,page_from,page_to")
        .in("file_id", fileIds)
        .limit(MAX_CHUNKS);
      if (chunks && chunks.length > 0) {
        docsSummary += "\n\nTRECHOS DOS DOCUMENTOS:\n";
        for (const c of chunks) {
          docsSummary += `\n[arquivo ${c.file_id.slice(0, 8)} p.${c.page_from ?? "?"}-${c.page_to ?? "?"}] ${truncate(c.content, MAX_CHUNK_SNIPPET_CHARS)}\n`;
        }
      }
    }
  }

  // Modelo
  let template: Record<string, unknown> | null = null;
  if (body.use_template !== false && body.template_id) {
    const { data } = await admin
      .from("legal_templates")
      .select(
        "id,name,legal_area,piece_type,structure_summary,style_summary,standard_sections,topic_structure,writing_patterns,request_patterns,risk_notes,usage_guidelines",
      )
      .eq("id", body.template_id)
      .maybeSingle();
    if (data && data.organization_id !== undefined) {
      // check org (fetch again for safety)
    }
    if (data) {
      // Re-check org
      const { data: tOrg } = await admin
        .from("legal_templates")
        .select("organization_id")
        .eq("id", body.template_id)
        .maybeSingle();
      if (tOrg?.organization_id === profile.organization_id) {
        template = data;
        sourcesUsed.template = true;
      }
    }
  }

  // Histórico do chat (opcional, curto)
  let chatContext = "";
  if (body.use_chat_history === true) {
    const { data: msgs } = await admin
      .from("case_chat_messages")
      .select("role,content,created_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (msgs && msgs.length > 0) {
      sourcesUsed.chat_history = true;
      chatContext = msgs
        .reverse()
        .map((m) => `${m.role}: ${truncate(m.content, 500)}`)
        .join("\n");
    }
  }

  // Monta prompt
  const draftLabel = DRAFT_TYPE_LABELS[draftType] ?? "Peça jurídica";
  const client = (caseRow as { clients?: { name?: string } }).clients;
  const parts: string[] = [];

  parts.push(`# TAREFA
Gerar minuta de "${draftLabel}" para o caso abaixo. Objetivo: ${body.objective || "(não informado)"}
Tom desejado: ${body.tone || "template_default"}`);

  parts.push(`# CASO
- ID interno: ${caseRow.id}
- Cliente: ${client?.name ?? "[CONFIRMAR COM O CLIENTE]"}
- Parte contrária: ${caseRow.opposing_party ?? "[CONFIRMAR COM O CLIENTE]"}
- Assunto: ${caseRow.subject ?? "(não informado)"}
- Número do processo: ${caseRow.case_number || "(caso em preparação — sem processo)"}
- Órgão/Tribunal: ${caseRow.court || "[INFORMAR TRIBUNAL/VARA]"}
- Vara/Comarca: ${caseRow.branch || "[INFORMAR VARA/COMARCA]"}
- Parte representada: ${caseRow.represented_party ?? "(não informado)"}`);

  if (intake) {
    parts.push(`# [FICHA INTELIGENTE — fatos e contexto do cliente]
Área jurídica: ${intake.legal_area ?? ""} ${intake.legal_area_other ?? ""}
Parte representada: ${intake.represented_party ?? ""}
Parte contrária: ${intake.opposing_party ?? ""}
Resumo do problema: ${truncate(intake.problem_summary as string, 2000)}
História do cliente: ${truncate(intake.client_story as string, MAX_INTAKE_STORY_CHARS)}
Objetivo do cliente: ${intake.client_goal ?? ""} ${intake.client_goal_other ?? ""}
Urgência: ${intake.urgency ?? ""} | Prazo: ${intake.deadline_date ?? ""}
Período dos fatos: ${intake.facts_period ?? ""}
Local dos fatos: ${intake.facts_location ?? ""}
Valor envolvido: ${intake.amount_involved ?? ""}
Documentos existentes: ${intake.existing_documents ?? ""}
Notas sobre docs enviados: ${intake.uploaded_documents_notes ?? ""}
Documentos faltantes: ${intake.missing_documents ?? ""}
Testemunhas: ${intake.witnesses ?? ""}
Outras provas: ${intake.other_evidence ?? ""}
Notas internas: ${intake.internal_notes ?? ""}
Sugestões IA (área/subtipo): ${intake.ai_suggested_area ?? ""} / ${intake.ai_suggested_subtype ?? ""}
Perguntas complementares: ${stringifyList(intake.ai_complementary_questions)}
Documentos recomendados: ${stringifyList(intake.ai_recommended_documents)}
Riscos iniciais: ${stringifyList(intake.ai_initial_risks)}
Próximos passos: ${stringifyList(intake.ai_next_steps)}`);
  }

  if (analysis) {
    const c = (analysis as { content_json?: Record<string, unknown> }).content_json ?? {};
    parts.push(`# [ANÁLISE INICIAL DO CASO]
Resumo: ${truncate(c.summary as string, 2000)}
Tipo de caso: ${c.case_type ?? ""}
Parte representada: ${c.represented_party ?? ""}
Fatos-chave: ${stringifyList(c.facts)}
Pontos fortes: ${stringifyList(c.strengths)}
Riscos: ${stringifyList(c.risks)}
Documentos relevantes: ${stringifyList(c.relevant_documents)}
Documentos faltantes: ${stringifyList(c.missing_documents)}
Teses jurídicas: ${stringifyList(c.legal_theories)}
Próxima providência: ${c.next_action ?? ""}
Peça recomendada: ${c.recommended_piece ?? ""}
Nível de confiança: ${c.confidence_level ?? ""}`.slice(0, MAX_ANALYSIS_CHARS));
  }

  if (docsSummary) {
    parts.push(`# [DOCUMENTOS DO CASO]
${docsSummary}`);
  }

  if (template) {
    parts.push(`# [MODELO DO ESCRITÓRIO — usar APENAS como referência estrutural e estilística]
Nome interno (não citar na minuta): ${template.name}
Área: ${template.legal_area ?? ""} | Tipo: ${template.piece_type ?? ""}
Resumo de estrutura: ${template.structure_summary ?? ""}
Resumo de estilo: ${template.style_summary ?? ""}
Seções padrão: ${stringifyList(template.standard_sections)}
Estrutura de tópicos: ${stringifyList(template.topic_structure)}
Padrões de redação: ${JSON.stringify(template.writing_patterns ?? {})}
Padrões de pedidos: ${stringifyList(template.request_patterns)}
Cuidados: ${stringifyList(template.risk_notes)}
Diretrizes de uso: ${template.usage_guidelines ?? ""}

LEMBRE: use este modelo apenas como referência de estrutura, ordem de tópicos, estilo e forma de escrever pedidos. NÃO copie fatos, partes, valores, datas ou fundamentos do modelo — esses dados pertencem a outro caso.`);
  } else {
    parts.push(`# [MODELO DO ESCRITÓRIO]
Nenhum modelo compatível foi selecionado. Use estrutura jurídica padrão brasileira para "${draftLabel}".`);
  }

  if (chatContext) {
    parts.push(`# [HISTÓRICO DO CHAT — contexto opcional; não usar como fonte de fatos definitiva]
${chatContext}`);
  }

  if (body.additional_instructions) {
    parts.push(`# [INSTRUÇÕES ADICIONAIS DO ADVOGADO]
${body.additional_instructions}`);
  }

  parts.push(`# INSTRUÇÕES FINAIS
- Gere a MINUTA no campo "content" já com quebras de linha e seções em MAIÚSCULAS.
- Se for "${draftLabel}" e área trabalhista, use estrutura próxima a: endereçamento; qualificação/menção às partes; nome da ação; I—DOS FATOS; II—DO CONTRATO/RELAÇÃO; III—FUNÇÃO; IV—JORNADA/HORAS EXTRAS (se aplicável); V—VERBAS RESCISÓRIAS (se aplicável); VI—PAGAMENTOS POR FORA (se aplicável); VII—FGTS (se aplicável); VIII—OUTROS DIREITOS; IX—DOCUMENTOS E PROVAS; X—DOS PEDIDOS; XI—DO VALOR DA CAUSA; XII—REQUERIMENTOS FINAIS.
- Termine com "PONTOS A CONFIRMAR ANTES DO PROTOCOLO" listando lacunas.
- Preencha "warnings" e "missing_information" com itens curtos e acionáveis.
- Responda APENAS o JSON solicitado, sem cercas de código.`);

  const userPrompt = parts.join("\n\n");

  const taskChoice = selectAIModelForTask("legal_draft_generation");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  const llmStart = Date.now();
  const llmRes = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: taskChoice.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (llmRes.status === 429) {
    return json({ error: "rate_limit", message: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
  }
  if (llmRes.status === 402) {
    return json({ error: "payment_required", message: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
  }
  if (!llmRes.ok) {
    const detail = await llmRes.text();
    console.error("generate-legal-draft:llm_error", llmRes.status, detail);
    return json({ error: `llm_${llmRes.status}` }, 500);
  }

  const llmData = await llmRes.json();
  const llmMs = Date.now() - llmStart;
  const rawText: string = llmData?.choices?.[0]?.message?.content ?? "";
  const inputTokens = llmData?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
  const outputTokens = llmData?.usage?.completion_tokens ?? Math.ceil(rawText.length / 4);

  const parsed = extractJson(rawText);
  if (!parsed) {
    console.error("generate-legal-draft:invalid_json", rawText.slice(0, 300));
    return json({ error: "invalid_llm_json" }, 500);
  }

  const title = String(parsed.title ?? `${draftLabel} — minuta`).slice(0, 200);
  const content = String(parsed.content ?? "").trim();
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.map(String).slice(0, 30)
    : [];
  const missing = Array.isArray(parsed.missing_information)
    ? parsed.missing_information.map(String).slice(0, 30)
    : [];

  if (!content || content.length < 100) {
    return json({ error: "empty_draft" }, 500);
  }

  // Persiste
  const { data: inserted, error: insErr } = await admin
    .from("case_drafts")
    .insert({
      organization_id: profile.organization_id,
      case_id: caseId,
      created_by: user.id,
      updated_by: user.id,
      title,
      draft_type: draftType,
      status: "draft",
      content,
      objective: body.objective ?? null,
      tone: body.tone ?? null,
      additional_instructions: body.additional_instructions ?? null,
      template_id: sourcesUsed.template ? body.template_id : null,
      sources_used: sourcesUsed,
      missing_information: missing,
      warnings,
      model_used: taskChoice.model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
    })
    .select("id,title,draft_type,created_at")
    .single();

  if (insErr || !inserted) {
    console.error("generate-legal-draft:persist_error", insErr?.message);
    return json({ error: "persist_failed" }, 500);
  }

  // Telemetria (sem conteúdo)
  await logAiUsage(admin, {
    organization_id: profile.organization_id,
    profile_id: user.id,
    operation: "legal_draft_generation",
    provider: taskChoice.provider,
    model: taskChoice.model,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    cost_estimated: 0,
    processing_time_ms: Date.now() - startedAt,
    case_id: caseId,
    prompt_summary: `draft:${inserted.id.slice(0, 8)}`,
    metadata: {
      draft_type: draftType,
      template_id: sourcesUsed.template ? body.template_id : null,
      legal_area: (intake?.legal_area as string) ?? null,
      use_intake: sourcesUsed.intake,
      use_analysis: sourcesUsed.analysis,
      use_documents: sourcesUsed.documents,
      use_template: sourcesUsed.template,
      use_chat_history: sourcesUsed.chat_history,
      has_additional_instructions: !!body.additional_instructions,
      llm_ms: llmMs,
    },
  });

  return json({
    draft_id: inserted.id,
    title: inserted.title,
    draft_type: inserted.draft_type,
    content,
    warnings,
    missing_information: missing,
    sources_used: sourcesUsed,
    created_at: inserted.created_at,
  });
});
