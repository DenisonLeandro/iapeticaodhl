// =============================================================================
// PR-4.4B.1 — generate-legal-draft (Profissional completo)
// Pipeline: contexto → claim_map → template_blueprint → draft → quality_gate → rewrite?
//
// Regras críticas mantidas do PR-4.4B:
//   - Modelo do escritório é APENAS referência de estrutura/estilo/pedidos.
//   - Nunca copiar fatos/nomes/CPFs/valores/datas do modelo.
//   - Fatos vêm SOMENTE de ficha/análise/documentos do caso atual.
//   - Multi-tenant estrito via organization_id.
//   - Nunca gravar conteúdo (minuta, relato, docs, modelo, claim_map) em telemetria.
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
const MIN_ACCEPTABLE_CONTENT_CHARS = 3500; // guarda contra minuta curta demais

const DRAFT_TYPE_LABELS: Record<string, string> = {
  initial_petition: "Petição inicial",
  manifestation: "Manifestação simples",
  extrajudicial_notice: "Notificação extrajudicial",
  opinion: "Parecer/nota técnica",
  other: "Peça jurídica",
};

// ---------------------------------------------------------------------------
// PROMPTS
// ---------------------------------------------------------------------------

const CLAIM_MAP_SYSTEM = `Você é um advogado sênior brasileiro. Monte um MAPA RÁPIDO E OBJETIVO de teses, pedidos, riscos, documentos e reflexos aplicáveis ao caso.
Regras:
- NÃO redija fundamentos longos, jurisprudência extensa nem parágrafos discursivos. Seja curto e estruturado — o objetivo é apenas mapear o que existe.
- Baseie-se somente nas fontes do caso atual (ficha, análise, documentos, instruções).
- O modelo do escritório serve apenas de inspiração; não copie fatos/valores/pedidos incompatíveis com o caso.
- Marque include=false quando não houver base fática mínima; status="include_with_confirmation" quando faltar dado essencial.
Retorne APENAS JSON válido no schema:
{ "topics": [ { "topic": string, "include": bool, "factual_basis": string, "documentary_basis": string, "legal_basis": string[], "main_request": string, "alternative_request": string, "reflexes": string[], "evidence_needed": string[], "risk": string, "status": "include" | "include_with_confirmation" | "exclude" } ] }`;

const DRAFT_SYSTEM = `Você é assistente jurídico redator de um escritório com mais de 25 anos de atuação.
Sua tarefa é gerar uma MINUTA PROFISSIONAL COMPLETA e revisável, em nível NO MÍNIMO equivalente ao modelo do escritório selecionado.

REGRAS OBRIGATÓRIAS:
- Você produz uma MINUTA de trabalho para o advogado revisar antes do protocolo — mas ela deve ser COMPLETA, não um esqueleto.
- Nunca prometa êxito nem garanta resultado.
- Nunca invente fatos, datas, valores, nomes de partes ou documentos.
- O MODELO DO ESCRITÓRIO é RÉGUA MÍNIMA de estrutura, profundidade, organização, estilo, forma de narrar, padrão de pedidos, reflexos e pedido final. Nunca copie fatos, nomes, CPFs/CNPJs, endereços, valores, datas ou fundamentos específicos do modelo — esses dados pertencem a outro caso.
- Os FATOS da peça devem vir SOMENTE da Ficha Inteligente, Análise Inicial, Documentos do caso atual e Instruções do advogado.
- Diferencie: fatos relatados pelo cliente, fatos documentados, inferências da análise, pontos a confirmar.
- Se um documento foi apenas mencionado (não anexado), use "[ANEXAR DOCUMENTO]" em vez de afirmar que existe.
- Use o CLAIM_MAP fornecido como guia obrigatório: cada topic com include=true (ou include_with_confirmation) DEVE ter seu próprio tópico na peça, com fatos + fundamento jurídico + aplicação ao caso + pedido correspondente.
- Marcadores de lacuna (use exatamente estes):
  [CONFIRMAR COM O CLIENTE], [INFORMAR DATA], [INFORMAR VALOR], [CALCULAR VALOR], [ANEXAR DOCUMENTO], [REVISAR FUNDAMENTO], [REVISAR JURISPRUDÊNCIA ATUALIZADA]
- Alertas específicos quando aplicáveis:
  * Súmula 450/TST (férias pagas em atraso) → sempre marcar [REVISAR ADPF 501/STF E ENTENDIMENTO ATUAL].
  * Sucumbência do beneficiário da justiça gratuita → sempre marcar [REVISAR ENTENDIMENTO ATUAL SOBRE ADI 5.766/STF].

FUNDAMENTAÇÃO JURÍDICA MÍNIMA (áreas trabalhistas — usar quando aplicáveis):
- Justiça gratuita: art. 5º, LXXIV, CF; art. 98 CPC; art. 790, §§3º e 4º, CLT.
- Ônus da prova: art. 818 CLT; art. 373 CPC; aptidão para a prova; art. 400 CPC para exibição.
- Motorista profissional / jornada: Lei 13.103/2015; obrigação de controle (diário de bordo, papeleta, tacógrafo, MDF-e, CTe, rastreador); afastamento do art. 62, I, CLT quando houver meios de controle; inversão do ônus da prova.
- Horas extras: art. 7º, XIII e XVI, CF; arts. 58 e 59 CLT; reflexos em DSR, férias+1/3, 13º, FGTS+40%, aviso-prévio.
- Intervalo intrajornada: art. 71 e §4º CLT; Súmula 437/TST quando aplicável; [REVISAR APLICAÇÃO TEMPORAL / REFORMA TRABALHISTA] se pertinente.
- Intervalo interjornada: art. 66 CLT; art. 67 CLT (DSR); horas suprimidas como extras.
- Domingos e feriados: Lei 605/49; Súmula 146/TST; adicional 100% sem compensação.
- Pagamento por fora / comissões: art. 457 CLT; habitualidade; natureza salarial; integração em férias+1/3, 13º, FGTS, aviso, HE, verbas; exibição de documentos.
- FGTS: Lei 8.036/90; Súmula 461/TST (ônus dos depósitos); multa 40%.
- Verbas rescisórias: arts. 477 e §8º CLT; art. 467 CLT; aviso, 13º, férias+1/3, saldo, FGTS+40%, guias, baixa CTPS, seguro-desemprego.
- Férias: arts. 134, 137, 145 CLT; se citar Súmula 450/TST incluir [REVISAR ADPF 501/STF E ENTENDIMENTO ATUAL].
- Insalubridade/periculosidade: arts. 189-192 CLT; NR-15/16; perícia; reflexos.
- Adicional noturno: art. 73 CLT; hora reduzida; prorrogação; reflexos.
- Honorários: art. 791-A CLT; cuidado com justiça gratuita.

PEDIDO FINAL (obrigatório e robusto):
- Numerado, discriminado, com remissão ao tópico correspondente.
- Reflexos discriminados.
- Pedido principal e sucessivo quando cabível.
- Valor por pedido quando disponível, senão [CALCULAR VALOR].
- Pedido de exibição de documentos (art. 400 CPC).
- Pedido de inversão/redistribuição do ônus da prova quando aplicável.
- Ofícios quando cabível.
- Abatimento de parcelas pagas sob mesmo título.
- Correção monetária e juros.
- Honorários.
- Produção de provas (protesto por todos os meios).
- Notificação/citação da reclamada.
- Valor da causa.

FORMATO DA RESPOSTA:
Retorne EXCLUSIVAMENTE um JSON válido:
{
  "title": "Título curto da minuta",
  "content": "Conteúdo completo em texto corrido com seções em MAIÚSCULAS. Sem markdown de código.",
  "warnings": ["alerta 1"],
  "missing_information": ["item pendente 1"]
}`;

const QUALITY_GATE_SYSTEM = `Você é um revisor sênior. Avalie a MINUTA fornecida contra o CLAIM_MAP e o TEMPLATE_BLUEPRINT.
Regras:
- Não reescreva; apenas avalie.
- Considere "weak_topic" um tópico presente mas raso (menos de ~4 parágrafos ou sem fundamento legal específico ou sem pedido correspondente).
- Considere "missing_topic" um topic com include=true no claim_map que não está desenvolvido na minuta.
- needs_rewrite=true quando: is_too_short=true, OU matches_template_depth=false, OU há missing_topics/weak_topics relevantes, OU pedido final é raso, OU faltam reflexos/sucessivos aplicáveis.
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
  "needs_rewrite": bool
}`;

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

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

interface LlmResult {
  raw: string;
  parsed: Record<string, unknown> | null;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  http_status: number;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

type Stage =
  | "auth"
  | "case_fetch"
  | "client_fetch"
  | "template_fetch"
  | "template_blueprint"
  | "claim_map"
  | "draft"
  | "insert"
  | "telemetry"
  | "unknown";

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(
  stage: Stage,
  message: string,
  details = "",
  status = 500,
  code = "draft_generation_failed",
) {
  // Nunca vazar conteúdo sensível: details deve ser curto/técnico.
  const safeDetails = String(details || "").slice(0, 240);
  console.error(`generate-legal-draft:${stage}`, { code, status, msg: message, details: safeDetails });
  return new Response(
    JSON.stringify({ success: false, code, stage, message, details: safeDetails }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fenced fallback */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
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

async function callLlm(
  apiKey: string,
  model: string,
  system: string,
  userPrompt: string,
  timeoutMs = 120000,
): Promise<LlmResult> {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
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
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("callLlm:error", res.status, detail.slice(0, 200));
      return { raw: "", parsed: null, input_tokens: 0, output_tokens: 0, ms, http_status: res.status };
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const input_tokens = data?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
    const output_tokens = data?.usage?.completion_tokens ?? Math.ceil(raw.length / 4);
    return { raw, parsed: extractJson(raw), input_tokens, output_tokens, ms, http_status: res.status };
  } catch (e) {
    const ms = Date.now() - start;
    const aborted = (e as Error).name === "AbortError";
    console.error("callLlm:exception", aborted ? "timeout" : (e as Error).message?.slice(0, 120));
    return { raw: "", parsed: null, input_tokens: 0, output_tokens: 0, ms, http_status: aborted ? 599 : 0 };
  } finally {
    clearTimeout(timer);
  }
}


// ---------------------------------------------------------------------------
// TEMPLATE BLUEPRINT (derivado dos campos estruturados do template)
// ---------------------------------------------------------------------------

function buildTemplateBlueprint(template: Record<string, unknown> | null) {
  if (!template) {
    return {
      has_template: false,
      minimum_depth: "complete_professional_petition",
      expected_section_count: 10,
      request_style: "pedidos discriminados, numerados e com reflexos",
      has_preliminaries: true,
      has_burden_of_proof: true,
      has_successive_requests: true,
      has_detailed_final_requests: true,
      has_values_per_request: true,
      style_rules: [
        "tópicos numerados",
        "fundamentação específica por pedido",
        "pedido final reiterando os tópicos",
        "reflexos discriminados",
        "pedidos sucessivos quando cabíveis",
        "valores ou marcadores de cálculo",
        "protesto por provas",
        "requerimentos finais completos",
      ],
    };
  }
  const sections = Array.isArray(template.standard_sections) ? template.standard_sections as unknown[] : [];
  const topics = Array.isArray(template.topic_structure) ? template.topic_structure as unknown[] : [];
  const reqs = Array.isArray(template.request_patterns) ? template.request_patterns as unknown[] : [];
  const expectedSections = Math.max(sections.length, topics.length, 10);
  return {
    has_template: true,
    minimum_depth: "complete_professional_petition",
    expected_section_count: expectedSections,
    request_style: reqs.length > 0
      ? "seguir padrões de pedidos do modelo (numerados, discriminados, com reflexos)"
      : "pedidos discriminados, numerados e com reflexos",
    has_preliminaries: true,
    has_burden_of_proof: true,
    has_successive_requests: true,
    has_detailed_final_requests: true,
    has_values_per_request: true,
    style_rules: [
      "tópicos numerados",
      "fundamentação específica por pedido",
      "pedido final reiterando os tópicos",
      "reflexos discriminados",
      "pedidos sucessivos quando cabíveis",
      "valores ou marcadores de cálculo",
      "protesto por provas",
      "requerimentos finais completos",
      "profundidade e organização no mínimo equivalentes ao modelo",
    ],
  };
}

// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return err("unknown", "Método não suportado.", "method_not_allowed", 405);
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return err("auth", "Sessão expirada. Faça login novamente.", "missing_bearer", 401, "unauthorized");
    }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return err("auth", "Sessão expirada. Faça login novamente.", "invalid_user", 401, "unauthorized");
  }

  const { data: profile } = await admin
    .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) {
    return err("auth", "Usuário sem organização vinculada.", "no_organization", 403, "no_organization");
  }

  let body: Payload;
  try { body = await req.json(); } catch { return err("unknown", "Requisição inválida.", "invalid_body", 400, "invalid_body"); }
  const caseId = body.case_id;
  const draftType = body.draft_type ?? "other";
  if (!caseId) return err("case_fetch", "Caso não informado.", "case_id_required", 400, "case_id_required");


  // -------------------------------------------------------------------------
  // ETAPA 1 — Contexto do caso
  // -------------------------------------------------------------------------
  const { data: caseRow, error: caseErr } = await admin
    .from("cases").select("*").eq("id", caseId).maybeSingle();
  if (caseErr) return json({ error: "case_lookup_failed", detail: caseErr.message }, 500);
  if (!caseRow) return json({ error: "case_not_found" }, 404);
  if (caseRow.organization_id !== profile.organization_id) return json({ error: "forbidden" }, 403);

  if (caseRow.client_id) {
    const { data: clientRow } = await admin
      .from("clients").select("id,name,document_number").eq("id", caseRow.client_id).maybeSingle();
    if (clientRow) (caseRow as Record<string, unknown>).clients = clientRow;
  }

  const sourcesUsed: Record<string, boolean> = {
    intake: false, analysis: false, documents: false, template: false, chat_history: false,
  };

  let intake: Record<string, unknown> | null = null;
  if (body.use_intake !== false) {
    const { data } = await admin
      .from("case_intake_forms").select("*").eq("case_id", caseId).maybeSingle();
    if (data) { intake = data; sourcesUsed.intake = true; }
  }

  let analysis: Record<string, unknown> | null = null;
  if (body.use_analysis !== false) {
    const { data } = await admin
      .from("case_analyses").select("*").eq("case_id", caseId).eq("status", "done")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) { analysis = data; sourcesUsed.analysis = true; }
  }

  let docsSummary = "";
  if (body.use_documents !== false) {
    const { data: files } = await admin
      .from("client_files")
      .select("id,file_name,classification,analysis_summary,processing_status")
      .eq("case_id", caseId).order("created_at", { ascending: false }).limit(20);
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
      const fileIds = files.map((f) => f.id);
      const { data: chunks } = await admin
        .from("document_chunks")
        .select("file_id,content,page_from,page_to")
        .in("file_id", fileIds).limit(MAX_CHUNKS);
      if (chunks && chunks.length > 0) {
        docsSummary += "\n\nTRECHOS DOS DOCUMENTOS:\n";
        for (const c of chunks) {
          docsSummary += `\n[arquivo ${c.file_id.slice(0, 8)} p.${c.page_from ?? "?"}-${c.page_to ?? "?"}] ${truncate(c.content, MAX_CHUNK_SNIPPET_CHARS)}\n`;
        }
      }
    }
  }

  let template: Record<string, unknown> | null = null;
  if (body.use_template !== false && body.template_id) {
    const { data } = await admin
      .from("legal_templates")
      .select("id,organization_id,name,legal_area,piece_type,structure_summary,style_summary,standard_sections,topic_structure,writing_patterns,request_patterns,risk_notes,usage_guidelines")
      .eq("id", body.template_id).maybeSingle();
    if (data && (data as Record<string, unknown>).organization_id === profile.organization_id) {
      template = data;
      sourcesUsed.template = true;
    }
  }

  let chatContext = "";
  if (body.use_chat_history === true) {
    const { data: msgs } = await admin
      .from("case_chat_messages")
      .select("role,content,created_at")
      .eq("case_id", caseId).order("created_at", { ascending: false }).limit(10);
    if (msgs && msgs.length > 0) {
      sourcesUsed.chat_history = true;
      chatContext = msgs.reverse().map((m) => `${m.role}: ${truncate(m.content, 500)}`).join("\n");
    }
  }

  // Contexto reutilizável entre etapas
  const draftLabel = DRAFT_TYPE_LABELS[draftType] ?? "Peça jurídica";
  const client = (caseRow as { clients?: { name?: string } }).clients;

  const buildCaseContextBlock = (): string => {
    const parts: string[] = [];
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

    if (docsSummary) parts.push(`# [DOCUMENTOS DO CASO]\n${docsSummary}`);

    if (template) {
      parts.push(`# [MODELO DO ESCRITÓRIO — RÉGUA MÍNIMA de estrutura, profundidade, organização e completude]
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

REGRA: este modelo é RÉGUA MÍNIMA de qualidade/profundidade. NÃO copie fatos, partes, valores, datas ou fundamentos dele — esses dados pertencem a outro caso.`);
    } else {
      parts.push(`# [MODELO DO ESCRITÓRIO]
Nenhum modelo compatível foi selecionado. Use estrutura jurídica padrão brasileira ROBUSTA para "${draftLabel}" — não gere peça curta.`);
    }

    if (chatContext) parts.push(`# [HISTÓRICO DO CHAT — contexto opcional]\n${chatContext}`);
    if (body.additional_instructions) parts.push(`# [INSTRUÇÕES ADICIONAIS DO ADVOGADO]\n${body.additional_instructions}`);
    return parts.join("\n\n");
  };

  const caseContext = buildCaseContextBlock();
  const templateBlueprint = buildTemplateBlueprint(template);

  const taskChoice = selectAIModelForTask("legal_draft_generation");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 500);

  const totalTokens = { input: 0, output: 0 };
  const warnings: string[] = [];

  // -------------------------------------------------------------------------
  // ETAPA 2 — CLAIM_MAP
  // -------------------------------------------------------------------------
  const claimMapPrompt = `${caseContext}

# TAREFA CLAIM_MAP
Monte o mapa de teses/pedidos para uma "${draftLabel}" neste caso. Objetivo do advogado: ${body.objective || "(não informado)"}.
Considere o modelo do escritório APENAS como inspiração de quais teses costumam existir; NÃO copie pedidos incompatíveis com o caso atual.`;

  const claimMapRes = await callLlm(apiKey, taskChoice.model, CLAIM_MAP_SYSTEM, claimMapPrompt);
  totalTokens.input += claimMapRes.input_tokens;
  totalTokens.output += claimMapRes.output_tokens;

  let claimMap: Record<string, unknown> | null = claimMapRes.parsed;
  if (!claimMap || !Array.isArray((claimMap as { topics?: unknown[] }).topics)) {
    warnings.push("Não foi possível montar o mapa de pedidos automaticamente. Revisar manualmente a cobertura de teses.");
    claimMap = { topics: [] };
  }

  const claimMapForPrompt = JSON.stringify(claimMap).slice(0, 8000);

  // -------------------------------------------------------------------------
  // ETAPA 4 — DRAFT PRINCIPAL
  // -------------------------------------------------------------------------
  const draftPrompt = `${caseContext}

# CLAIM_MAP (guia obrigatório — cada topic include=true DEVE virar um tópico completo da peça)
${claimMapForPrompt}

# TEMPLATE_BLUEPRINT (régua mínima estrutural)
${JSON.stringify(templateBlueprint)}

# TAREFA
Gerar minuta PROFISSIONAL COMPLETA de "${draftLabel}". Objetivo: ${body.objective || "(não informado)"}. Tom: ${body.tone || "template_default"}.
Nível de profundidade: professional_full — a peça DEVE ser longa, técnica, completa e no mínimo equivalente ao modelo.

# INSTRUÇÕES FINAIS
- Gere o texto no campo "content" com quebras de linha e seções em MAIÚSCULAS.
- Cada topic include=true do CLAIM_MAP deve virar um tópico numerado com: fatos → fundamento legal específico (artigos/leis/súmulas) → aplicação ao caso → pedido correspondente.
- Estrutura sugerida para "${draftLabel}" trabalhista: endereçamento; qualificação/menção às partes; nome da ação; I—DOS FATOS; II—DA RELAÇÃO DE EMPREGO/CONTRATO; III—DA FUNÇÃO EXERCIDA; IV—DA JORNADA E HORAS EXTRAS; V—DOS INTERVALOS (INTRA E INTERJORNADA); VI—DE DOMINGOS E FERIADOS; VII—DO ADICIONAL NOTURNO (se aplicável); VIII—DAS VERBAS RESCISÓRIAS; IX—DO FGTS; X—DE PAGAMENTOS POR FORA/COMISSÕES (se aplicável); XI—DA INSALUBRIDADE/PERICULOSIDADE (se aplicável); XII—DO ÔNUS DA PROVA E DA EXIBIÇÃO DE DOCUMENTOS; XIII—DA JUSTIÇA GRATUITA; XIV—DOS PEDIDOS (numerados, discriminados, com reflexos, sucessivos quando cabíveis, valores ou [CALCULAR VALOR]); XV—DO VALOR DA CAUSA; XVI—DOS REQUERIMENTOS FINAIS. Adapte para outras áreas mantendo a mesma profundidade.
- Termine com seção "PONTOS A CONFIRMAR ANTES DO PROTOCOLO" listando lacunas.
- Preencha "warnings" com alertas de jurisprudência a revisar e "missing_information" com pendências acionáveis.
- Responda APENAS o JSON solicitado, sem cercas de código.`;

  const draftRes = await callLlm(apiKey, taskChoice.model, DRAFT_SYSTEM, draftPrompt);
  totalTokens.input += draftRes.input_tokens;
  totalTokens.output += draftRes.output_tokens;

  if (draftRes.http_status === 429) {
    return json({ error: "rate_limit", message: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
  }
  if (draftRes.http_status === 402) {
    return json({ error: "payment_required", message: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
  }
  if (!draftRes.parsed) {
    console.error("generate-legal-draft:invalid_json (draft)");
    return json({ error: "invalid_llm_json" }, 500);
  }

  let title = String(draftRes.parsed.title ?? `${draftLabel} — minuta`).slice(0, 200);
  let content = String(draftRes.parsed.content ?? "").trim();
  let draftWarnings = Array.isArray(draftRes.parsed.warnings)
    ? (draftRes.parsed.warnings as unknown[]).map(String).slice(0, 30) : [];
  let missing = Array.isArray(draftRes.parsed.missing_information)
    ? (draftRes.parsed.missing_information as unknown[]).map(String).slice(0, 30) : [];

  if (!content || content.length < 100) return json({ error: "empty_draft" }, 500);

  // -------------------------------------------------------------------------
  // ETAPA 5/6 — Quality gate + rewrite: movidos para review-legal-draft
  // (execução assíncrona para evitar timeout de 150s da Edge Function).
  // -------------------------------------------------------------------------
  warnings.push("A revisão automática de qualidade ainda não foi executada.");

  const qualityReport: Record<string, unknown> | null = null;
  const missingList: string[] = [];
  const weakList: string[] = [];

  // Consolida warnings finais (sem duplicar)
  const mergedWarningsSet = new Set<string>();
  for (const w of warnings) mergedWarningsSet.add(w);
  for (const w of draftWarnings) mergedWarningsSet.add(w);
  const finalWarnings = Array.from(mergedWarningsSet).slice(0, 50);


  // -------------------------------------------------------------------------
  // Persistência
  // -------------------------------------------------------------------------
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
      warnings: finalWarnings,
      model_used: taskChoice.model,
      tokens_input: totalTokens.input,
      tokens_output: totalTokens.output,
      claim_map: claimMap,
      quality_report: qualityReport,
      quality_status: "pending",
      generation_depth: "professional_full",
    })

    .select("id,title,draft_type,created_at")
    .single();

  if (insErr || !inserted) {
    console.error("generate-legal-draft:persist_error", insErr?.message);
    return json({ error: "persist_failed" }, 500);
  }

  // -------------------------------------------------------------------------
  // Telemetria (metadados apenas — sem conteúdo, sem claim_map, sem relato)
  // -------------------------------------------------------------------------
  await logAiUsage(admin, {
    organization_id: profile.organization_id,
    profile_id: user.id,
    operation: "legal_draft_generation",
    provider: taskChoice.provider,
    model: taskChoice.model,
    tokens_input: totalTokens.input,
    tokens_output: totalTokens.output,
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
      generation_depth: "professional_full",
      claim_map_topics: Array.isArray((claimMap as { topics?: unknown[] }).topics) ? (claimMap as { topics: unknown[] }).topics.length : 0,
      quality_status: "pending",
      content_chars: content.length,

    },
  });

  return json({
    draft_id: inserted.id,
    title: inserted.title,
    draft_type: inserted.draft_type,
    content,
    warnings: finalWarnings,
    missing_information: missing,
    sources_used: sourcesUsed,
    quality_report: qualityReport,
    quality_status: "pending",
    generation_depth: "professional_full",
    created_at: inserted.created_at,
  });

});
