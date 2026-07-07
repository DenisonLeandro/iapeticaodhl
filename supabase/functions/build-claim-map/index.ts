// =============================================================================
// PR-6A — build-claim-map
// Gera o Mapa de Pedidos e Riscos (case_claim_maps) para um caso.
// - Somente leitura sobre case_drafts (não modifica).
// - Aplica guardas determinísticas pós-LLM (ex.: férias em dobro/Súmula 450).
// - Marca versões anteriores como is_current=false e insere a nova como
//   is_current=true, com lawyer_decision='pending' em todas as claims.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { logAiUsage } from "../_shared/usage-log.ts";
import { selectAIModelForTask } from "../_shared/model-router.ts";
import { estimateCost } from "../_shared/pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ---------------------------------------------------------------------------
// Catálogo obrigatório de grupos de claims para trabalhista_inicial.
// ---------------------------------------------------------------------------
const TRABALHISTA_INICIAL_REQUIRED_CLAIMS: Array<{ id: string; title: string; category: string }> = [
  { id: "rescisao_indireta", title: "Rescisão indireta / reversão do pedido de demissão", category: "rescisao" },
  { id: "verbas_rescisorias", title: "Verbas rescisórias", category: "rescisao" },
  { id: "horas_extras", title: "Horas extras", category: "jornada" },
  { id: "intervalo_intrajornada", title: "Intervalo intrajornada", category: "jornada" },
  { id: "intervalo_interjornada", title: "Intervalo interjornada", category: "jornada" },
  { id: "domingos_feriados_dsr", title: "Domingos, feriados e DSR", category: "jornada" },
  { id: "fgts_irregular", title: "FGTS irregular", category: "fgts" },
  { id: "multa_40_fgts", title: "Multa de 40% do FGTS", category: "fgts" },
  { id: "multa_467_477_clt", title: "Multas dos arts. 467 e 477 da CLT", category: "multas" },
  { id: "insalubridade", title: "Adicional de insalubridade", category: "adicionais" },
  { id: "periculosidade", title: "Adicional de periculosidade", category: "adicionais" },
  { id: "ferias", title: "Férias", category: "ferias" },
  { id: "ferias_em_dobro", title: "Férias em dobro", category: "ferias" },
  { id: "adicional_noturno", title: "Adicional noturno", category: "adicionais" },
  { id: "integracao_verbas_variaveis", title: "Integração de verbas variáveis (comissões, prêmios, pagamentos por fora)", category: "salario" },
  { id: "diferencas_salariais", title: "Diferenças salariais", category: "salario" },
  { id: "acumulo_desvio_funcao", title: "Acúmulo/desvio de função", category: "salario" },
  { id: "dano_moral", title: "Dano moral", category: "danos" },
  { id: "estabilidade", title: "Estabilidade", category: "estabilidade" },
  { id: "acidente_doenca_ocupacional", title: "Acidente/doença ocupacional", category: "saude" },
  { id: "exibicao_documentos_onus_prova", title: "Exibição de documentos / ônus da prova", category: "processual" },
  { id: "honorarios_sucumbenciais", title: "Honorários sucumbenciais", category: "processual" },
  { id: "justica_gratuita", title: "Justiça gratuita", category: "processual" },
];

// ---------------------------------------------------------------------------
// Prompt do LLM
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Você é um advogado sênior trabalhista brasileiro. Sua tarefa é montar um MAPA DE PEDIDOS E RISCOS estruturado para o caso.

REGRAS OBRIGATÓRIAS:
- NÃO redija peça. Não escreva parágrafos discursivos, jurisprudência longa nem fundamentos extensos.
- Baseie-se SOMENTE nas fontes do caso atual (ficha inteligente, análise, documentos e instruções). Não invente fatos.
- Para cada grupo de claim do catálogo obrigatório, você DEVE retornar uma entrada — mesmo quando concluir que não se aplica.
- Se não houver suporte fático mínimo: applicability="not_applicable", confidence="low", recommended_action="exclude", should_generate_merit_section=false, should_include_in_prayer_list=false, should_include_in_final_requests=false.
- Se houver dúvida: applicability="uncertain", recommended_action="confirm", requires_lawyer_confirmation=true.
- Se aplicável: applicability="applicable" e defina confidence/risk_level de forma calibrada.
- Marque documents_supporting apenas com documentos que APARECEM no contexto. missing_documents = documentos esperados que NÃO aparecem.
- warnings deve ser um array curto de alertas específicos por claim.
- Para "férias em dobro" quando baseada em pagamento intempestivo/atraso das férias ou Súmula 450/TST: risk_level="high", recommended_action="confirm", requires_lawyer_confirmation=true, e inclua warning citando ADPF 501/STF.
- Para "insalubridade" e "periculosidade": tipicamente uncertain (dependem de perícia).
- Para "dano moral": geralmente exige confirmação do advogado (risk_level >= medium, requires_lawyer_confirmation=true).
- lawyer_decision deve ser sempre "pending" nesta primeira versão.
- Quando existir um CATÁLOGO OBRIGATÓRIO na entrada, o campo "id" DEVE ser EXATAMENTE um dos ids listados (em snake_case português, sem tradução para inglês). NÃO invente ids novos, NÃO traduza. Os títulos podem ser reescritos, mas o id precisa bater com o catálogo.

FORMATO DA RESPOSTA — retorne EXCLUSIVAMENTE JSON válido:
{
  "claims": [
    {
      "id": "<id_do_catalogo>",
      "title": "<título>",
      "category": "<categoria>",
      "applicability": "applicable" | "not_applicable" | "uncertain",
      "confidence": "low" | "medium" | "high",
      "risk_level": "low" | "medium" | "high" | "critical",
      "recommended_action": "include" | "exclude" | "confirm" | "warn_only",
      "requires_lawyer_confirmation": bool,
      "facts_supporting": string[],
      "documents_supporting": string[],
      "missing_documents": string[],
      "legal_basis": string[],
      "warnings": string[],
      "should_generate_merit_section": bool,
      "should_include_in_prayer_list": bool,
      "should_include_in_final_requests": bool,
      "lawyer_notes": ""
    }
  ],
  "global_warnings": string[],
  "missing_case_data": string[]
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ success: true, ...body }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(stage: string, message: string, status = 500, code = "build_claim_map_failed", details = "") {
  const safeDetails = String(details || "").slice(0, 240);
  console.error(`build-claim-map:${stage}`, { code, status, msg: message, details: safeDetails });
  return new Response(JSON.stringify({ success: false, code, stage, message, details: safeDetails }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
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

// ---------------------------------------------------------------------------
// Guardas determinísticas
// ---------------------------------------------------------------------------
const FERIAS_DOBRO_WARNING =
  "Tese de férias em dobro por pagamento intempestivo exige revisão em razão da ADPF 501/STF e da invalidade da Súmula 450/TST.";

// deno-lint-ignore no-explicit-any
function applyDeterministicGuards(claims: any[]): any[] {
  return claims.map((c) => {
    const claim = { ...c };
    const idStr = String(claim.id ?? "").toLowerCase();
    const title = String(claim.title ?? "").toLowerCase();
    const factsAndWarnings = [
      ...(Array.isArray(claim.facts_supporting) ? claim.facts_supporting : []),
      ...(Array.isArray(claim.legal_basis) ? claim.legal_basis : []),
      ...(Array.isArray(claim.warnings) ? claim.warnings : []),
    ].join(" ").toLowerCase();

    const isFeriasDobro =
      idStr === "ferias_em_dobro" ||
      title.includes("férias em dobro") ||
      title.includes("ferias em dobro") ||
      /súmula\s*450|sumula\s*450/.test(factsAndWarnings) ||
      /pagamento\s+intempestiv|pag(amento)?\s+em\s+atraso|atraso\s+no\s+pagamento\s+das\s+f[eé]rias/.test(factsAndWarnings);

    if (isFeriasDobro && claim.applicability !== "not_applicable") {
      // Nunca permitir uma configuração perigosa neste tema.
      const currentRisk = String(claim.risk_level ?? "low");
      if (!["high", "critical"].includes(currentRisk)) claim.risk_level = "high";
      const currentAction = String(claim.recommended_action ?? "include");
      if (!["confirm", "warn_only"].includes(currentAction)) claim.recommended_action = "confirm";
      claim.requires_lawyer_confirmation = true;
      const warnings = Array.isArray(claim.warnings) ? [...claim.warnings] : [];
      if (!warnings.some((w: unknown) => typeof w === "string" && w.toLowerCase().includes("adpf 501"))) {
        warnings.push(FERIAS_DOBRO_WARNING);
      }
      claim.warnings = warnings;
    }

    // Guardas conservadoras genéricas
    const applic = String(claim.applicability ?? "");
    const risk = String(claim.risk_level ?? "");
    const action = String(claim.recommended_action ?? "");
    if (applic === "uncertain" && (action === "include" || action === "exclude")) {
      claim.recommended_action = "confirm";
      claim.requires_lawyer_confirmation = true;
    }
    if ((risk === "high" || risk === "critical") && applic !== "not_applicable") {
      claim.requires_lawyer_confirmation = true;
    }

    // lawyer_decision sempre pending na primeira versão
    claim.lawyer_decision = "pending";
    claim.lawyer_decision_by = null;
    claim.lawyer_decision_at = null;
    if (typeof claim.lawyer_notes !== "string") claim.lawyer_notes = "";

    return claim;
  });
}


// Normaliza IDs quando o LLM inventar variações (ex.: em inglês) mapeando
// para os ids canônicos por título/palavra-chave.
const CLAIM_ALIASES: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "rescisao_indireta", patterns: [/rescis[aã]o\s+indireta/i, /revers[aã]o.*(pedido\s+de\s+)?demiss[aã]o/i, /indirect\s+rescission/i, /constructive\s+dismissal/i] },
  { id: "verbas_rescisorias", patterns: [/verbas\s+rescis[oó]rias/i, /severance/i] },
  { id: "horas_extras", patterns: [/horas?\s+extras?/i, /overtime/i] },
  { id: "intervalo_intrajornada", patterns: [/intra[- ]?jornada/i, /intra[_ ]?journey/i, /intervalo.*intra/i] },
  { id: "intervalo_interjornada", patterns: [/inter[- ]?jornada/i, /inter[_ ]?journey/i] },
  { id: "domingos_feriados_dsr", patterns: [/domingos?\s+e?\s*feriados?/i, /\bdsr\b/i, /dsr[_ ]?holidays/i, /repouso\s+semanal/i] },
  { id: "fgts_irregular", patterns: [/fgts.*(irregular|dep[oó]sito|diferen)/i, /diferen[cç]as?\s+de\s+fgts/i, /fgts\s+differences/i] },
  { id: "multa_40_fgts", patterns: [/multa\s+de?\s*40|multa.*fgts/i, /40%\s+fgts/i, /fgts\s+fine/i] },
  { id: "multa_467_477_clt", patterns: [/(art\.?\s*467|art\.?\s*477)/i, /multa.*(467|477)/i] },
  { id: "insalubridade", patterns: [/insalubridade/i, /insalubrity/i] },
  { id: "periculosidade", patterns: [/periculosidade/i, /hazard/i] },
  { id: "ferias_em_dobro", patterns: [/f[eé]rias\s+em\s+dobro/i, /pagamento\s+em\s+dobro.*f[eé]rias/i, /vacation\s+double/i, /s[uú]mula\s*450/i] },
  { id: "ferias", patterns: [/^f[eé]rias($|\s+vencidas|\s+proporcionais)/i, /vacation(?!\s+double)/i] },
  { id: "adicional_noturno", patterns: [/adicional\s+noturno/i, /night\s+shift/i] },
  { id: "integracao_verbas_variaveis", patterns: [/integra[cç][aã]o.*(vari[aá]v|comiss|pr[eê]mi)/i, /pagamento\s+por\s+fora/i, /variable\s+pay/i] },
  { id: "diferencas_salariais", patterns: [/diferen[cç]as?\s+salariais/i, /salary\s+differences/i] },
  { id: "acumulo_desvio_funcao", patterns: [/ac[uú]mulo|desvio.*fun[cç][aã]o/i, /role\s+accumulation/i] },
  { id: "dano_moral", patterns: [/dano\s+moral/i, /moral\s+damage/i] },
  { id: "estabilidade", patterns: [/estabilidade/i, /job\s+stability/i] },
  { id: "acidente_doenca_ocupacional", patterns: [/acidente\s+de?\s*trabalho|doen[cç]a\s+ocupacional/i, /occupational\s+(disease|accident)/i] },
  { id: "exibicao_documentos_onus_prova", patterns: [/exibi[cç][aã]o.*documentos?/i, /[oó]nus.*prova/i, /burden\s+of\s+proof/i, /document\s+exhibition/i] },
  { id: "honorarios_sucumbenciais", patterns: [/honor[aá]rios?\s+(sucumbenciais|advocat)/i, /attorney\s+fees/i] },
  { id: "justica_gratuita", patterns: [/justi[cç]a\s+gratuita/i, /free\s+justice/i, /gratuidade/i] },
];

function normalizeClaimIds(
  // deno-lint-ignore no-explicit-any
  claims: any[],
  required: typeof TRABALHISTA_INICIAL_REQUIRED_CLAIMS,
  // deno-lint-ignore no-explicit-any
): any[] {
  const requiredIds = new Set(required.map((r) => r.id));
  return claims.map((c) => {
    const claim = { ...c };
    const idStr = String(claim.id ?? "").toLowerCase();
    if (requiredIds.has(idStr)) return claim;
    const haystack = `${claim.id ?? ""} ${claim.title ?? ""}`;
    for (const alias of CLAIM_ALIASES) {
      if (alias.patterns.some((p) => p.test(haystack))) {
        claim.id = alias.id;
        // Preserve título e categoria oficiais do catálogo
        const canonical = required.find((r) => r.id === alias.id);
        if (canonical) claim.category = claim.category ?? canonical.category;
        break;
      }
    }
    return claim;
  });
}

// Descarta claims não-canônicas (após normalização por alias) para evitar que
// entradas inventadas pelo LLM substituam claims obrigatórias do catálogo.
// deno-lint-ignore no-explicit-any
function dropNonCanonicalClaims(claims: any[], required: typeof TRABALHISTA_INICIAL_REQUIRED_CLAIMS): any[] {
  const requiredIds = new Set(required.map((r) => r.id));
  return claims.filter((c) => c && typeof c.id === "string" && requiredIds.has(String(c.id).toLowerCase()));
}

// Constrói uma claim obrigatória no formato fallback padronizado.
function buildFallbackClaim(req: { id: string; title: string; category: string }) {
  return {
    id: req.id,
    title: req.title,
    category: req.category,
    applicability: "uncertain" as const,
    confidence: "low" as const,
    risk_level: "medium" as const,
    recommended_action: "confirm" as const,
    requires_lawyer_confirmation: true,
    facts_supporting: [] as string[],
    documents_supporting: [] as string[],
    missing_documents: ["Contexto insuficiente para avaliar esta tese com segurança."],
    legal_basis: [] as string[],
    warnings: [
      "Claim obrigatória não retornada pelo modelo; incluída por guarda determinística para revisão do advogado.",
    ],
    should_generate_merit_section: false,
    should_include_in_prayer_list: false,
    should_include_in_final_requests: false,
    lawyer_decision: "pending" as const,
    lawyer_decision_by: null,
    lawyer_decision_at: null,
    lawyer_notes: "",
  };
}

// Completa claims obrigatórias que o LLM não retornou.
// deno-lint-ignore no-explicit-any
function ensureRequiredClaims(claims: any[], required: typeof TRABALHISTA_INICIAL_REQUIRED_CLAIMS): any[] {
  const byId = new Map<string, unknown>();
  for (const c of claims) {
    if (c && typeof c.id === "string") byId.set(String(c.id).toLowerCase(), c);
  }
  const merged = [...claims];
  for (const req of required) {
    if (!byId.has(req.id)) merged.push(buildFallbackClaim(req));
  }
  return merged;
}

// Mapa mínimo estruturado para contexto insuficiente ou falha do LLM.
function buildMinimalMap(required: typeof TRABALHISTA_INICIAL_REQUIRED_CLAIMS, extraMissing: string[] = []) {
  const baseMissing = [
    "Ficha de atendimento (intake) ausente ou incompleta.",
    "Análise jurídica ainda não realizada.",
    "Documentos processados insuficientes.",
    "Função, datas de admissão/rescisão, remuneração e modalidade de rescisão não identificadas.",
  ];
  return {
    claims: required.map(buildFallbackClaim),
    global_warnings: [
      "Mapa gerado em modo mínimo por contexto insuficiente. Todas as teses exigem revisão do advogado.",
    ],
    missing_case_data: [...baseMissing, ...extraMissing],
  };
}


// ---------------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("unknown", "Método não suportado.", 405, "method_not_allowed");

  const startedAt = Date.now();
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return err("auth", "Sessão expirada. Faça login novamente.", 401, "unauthorized");
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return err("auth", "Sessão expirada. Faça login novamente.", 401, "unauthorized");

    const { data: profile } = await admin
      .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (!profile?.organization_id) return err("auth", "Usuário sem organização vinculada.", 403, "no_organization");

    let body: { case_id?: string; force_regenerate?: boolean };
    try { body = await req.json(); } catch { return err("input", "Requisição inválida.", 400, "invalid_body"); }
    const caseId = body.case_id;
    if (!caseId) return err("input", "case_id é obrigatório.", 400, "case_id_required");

    // -----------------------------------------------------------------------
    // Contexto do caso
    // -----------------------------------------------------------------------
    const { data: caseRow, error: caseErr } = await admin
      .from("cases").select("*").eq("id", caseId).maybeSingle();
    if (caseErr) return err("case_fetch", "Não foi possível carregar o caso.", 500);
    if (!caseRow) return err("case_fetch", "Caso não encontrado.", 404, "case_not_found");
    if (caseRow.organization_id !== profile.organization_id) {
      return err("case_fetch", "Acesso negado ao caso.", 403, "forbidden");
    }

    let client: { name?: string } | null = null;
    if (caseRow.client_id) {
      const { data: c } = await admin
        .from("clients").select("id,name,document_number").eq("id", caseRow.client_id).maybeSingle();
      if (c) client = c as { name?: string };
    }

    const { data: intake } = await admin
      .from("case_intake_forms").select("*").eq("case_id", caseId).maybeSingle();

    const { data: analysis } = await admin
      .from("case_analyses").select("*").eq("case_id", caseId).eq("status", "done")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const { data: files } = await admin
      .from("client_files")
      .select("id,file_name,classification,analysis_summary,processing_status")
      .eq("case_id", caseId).order("created_at", { ascending: false }).limit(20);

    let docChunks: Array<{ file_id: string; content: string; page_from: number | null; page_to: number | null }> = [];
    if (files && files.length > 0) {
      const fileIds = files.map((f) => f.id);
      const { data: chunks } = await admin
        .from("document_chunks")
        .select("file_id,content,page_from,page_to")
        .in("file_id", fileIds).limit(8);
      if (chunks) docChunks = chunks as typeof docChunks;
    }

    // -----------------------------------------------------------------------
    // Monta contexto textual (compacto — o objetivo é mapear, não redigir)
    // -----------------------------------------------------------------------
    const parts: string[] = [];
    parts.push(`# CASO
- Cliente: ${client?.name ?? "[não informado]"}
- Parte contrária: ${caseRow.opposing_party ?? "[não informado]"}
- Assunto: ${caseRow.subject ?? "(não informado)"}
- Área jurídica: ${caseRow.legal_area ?? "(não informado)"}
- Parte representada: ${caseRow.represented_party ?? "(não informado)"}`);

    if (intake) {
      parts.push(`# FICHA INTELIGENTE
Área: ${intake.legal_area ?? ""} ${intake.legal_area_other ?? ""}
Parte representada: ${intake.represented_party ?? ""}
Parte contrária: ${intake.opposing_party ?? ""}
Resumo do problema: ${truncate(intake.problem_summary as string, 2000)}
História: ${truncate(intake.client_story as string, 5000)}
Objetivo: ${intake.client_goal ?? ""} ${intake.client_goal_other ?? ""}
Período dos fatos: ${intake.facts_period ?? ""}
Valor envolvido: ${intake.amount_involved ?? ""}
Documentos existentes: ${intake.existing_documents ?? ""}
Notas sobre docs enviados: ${intake.uploaded_documents_notes ?? ""}
Documentos faltantes: ${intake.missing_documents ?? ""}
Testemunhas: ${intake.witnesses ?? ""}
Outras provas: ${intake.other_evidence ?? ""}
Sugestões IA (área/subtipo): ${intake.ai_suggested_area ?? ""} / ${intake.ai_suggested_subtype ?? ""}
Documentos recomendados: ${stringifyList(intake.ai_recommended_documents)}
Riscos iniciais: ${stringifyList(intake.ai_initial_risks)}`);
    }

    if (analysis) {
      // deno-lint-ignore no-explicit-any
      const c = ((analysis as any).content_json ?? {}) as Record<string, unknown>;
      parts.push(`# ANÁLISE INICIAL
Resumo: ${truncate(c.summary as string, 2000)}
Tipo de caso: ${c.case_type ?? ""}
Fatos-chave: ${stringifyList(c.facts)}
Pontos fortes: ${stringifyList(c.strengths)}
Riscos: ${stringifyList(c.risks)}
Documentos relevantes: ${stringifyList(c.relevant_documents)}
Documentos faltantes: ${stringifyList(c.missing_documents)}
Teses jurídicas: ${stringifyList(c.legal_theories)}
Peça recomendada: ${c.recommended_piece ?? ""}`);
    }

    if (files && files.length > 0) {
      const lines: string[] = [];
      for (const f of files) {
        lines.push(`- ${f.file_name}${f.classification ? ` [${f.classification}]` : ""}${
          f.analysis_summary ? `: ${truncate(f.analysis_summary, 400)}` : ""
        }`);
      }
      parts.push(`# DOCUMENTOS DO CASO
${lines.join("\n")}`);
      if (docChunks.length > 0) {
        parts.push(`# TRECHOS RELEVANTES
${docChunks.map((c) => `[${c.file_id.slice(0, 8)} p.${c.page_from ?? "?"}-${c.page_to ?? "?"}] ${truncate(c.content, 700)}`).join("\n---\n")}`);
      }
    }

    // deno-lint-ignore no-explicit-any
    const analysisCaseType = String(((analysis as any)?.content_json ?? {}).case_type ?? "").toLowerCase();
    const legalArea = String(intake?.legal_area ?? caseRow.legal_area ?? "").toLowerCase();
    const areaSignals = [
      legalArea,
      analysisCaseType,
      String(intake?.legal_area_other ?? "").toLowerCase(),
      String(intake?.ai_suggested_area ?? "").toLowerCase(),
      String(caseRow.subject ?? "").toLowerCase(),
    ].join(" ");
    const isTrabalhistaInicial = /trabalh|\brt\b|reclama[cç][aã]o\s+trabalhista/.test(areaSignals);

    const requiredClaims = isTrabalhistaInicial ? TRABALHISTA_INICIAL_REQUIRED_CLAIMS : [];
    if (requiredClaims.length > 0) {
      parts.push(`# CATÁLOGO OBRIGATÓRIO DE CLAIMS (trabalhista_inicial)
Você DEVE retornar uma entrada para CADA id abaixo, mesmo quando concluir que não se aplica:
${requiredClaims.map((c) => `- ${c.id} — ${c.title} [categoria: ${c.category}]`).join("\n")}`);
    } else {
      parts.push(`# CATÁLOGO OBRIGATÓRIO
Nenhum catálogo obrigatório para esta área. Gere claims relevantes para a área identificada, mantendo o mesmo schema.`);
    }

    const userPrompt = parts.join("\n\n");

    // Detecta contexto pobre: sem intake, sem análise e no máximo 1 documento.
    const filesCount = files?.length ?? 0;
    const contextIsPoor = !intake && !analysis && filesCount <= 1;

    // -----------------------------------------------------------------------
    // Chamada LLM (pulada se contexto pobre em área trabalhista → fallback direto)
    // -----------------------------------------------------------------------
    const modelChoice = selectAIModelForTask("legal_draft_generation");
    const model = modelChoice.model;
    const llmStart = Date.now();
    let raw = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let httpStatus = 0;
    let usedFallback = false;
    let fallbackReason = "";

    if (contextIsPoor && isTrabalhistaInicial) {
      usedFallback = true;
      fallbackReason = "contexto insuficiente antes da chamada LLM";
    } else {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        httpStatus = res.status;
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.error("build-claim-map:llm_error", res.status, detail.slice(0, 200));
          // 402/429 são falhas operacionais reais — mantém erro cru.
          if (res.status === 402) return err("llm", "Créditos da IA esgotados.", 402, "ai_credits_exhausted");
          if (res.status === 429) return err("llm", "Limite de requisições atingido. Tente novamente em instantes.", 429, "ai_rate_limited");
          if (isTrabalhistaInicial) {
            usedFallback = true;
            fallbackReason = `llm_http_${res.status}`;
          } else {
            return err("llm", "Falha ao gerar o mapa. Tente novamente.", 502, "ai_call_failed");
          }
        } else {
          const data = await res.json();
          raw = data?.choices?.[0]?.message?.content ?? "";
          inputTokens = data?.usage?.prompt_tokens ?? Math.ceil(userPrompt.length / 4);
          outputTokens = data?.usage?.completion_tokens ?? Math.ceil(raw.length / 4);
        }
      } catch (e) {
        const aborted = (e as Error).name === "AbortError";
        console.error("build-claim-map:llm_exception", aborted ? "timeout" : (e as Error).message?.slice(0, 120));
        if (isTrabalhistaInicial) {
          usedFallback = true;
          fallbackReason = aborted ? "llm_timeout" : "llm_exception";
        } else {
          return err("llm", aborted ? "Tempo esgotado ao gerar o mapa." : "Falha ao gerar o mapa.", 504, "ai_timeout");
        }
      }
    }
    const llmMs = Date.now() - llmStart;

    // deno-lint-ignore no-explicit-any
    let claims: any[] = [];
    let globalWarnings: unknown[] = [];
    let missingCaseData: unknown[] = [];

    if (!usedFallback) {
      const parsed = extractJson(raw);
      if (!parsed || !Array.isArray((parsed as { claims?: unknown }).claims)) {
        if (isTrabalhistaInicial) {
          usedFallback = true;
          fallbackReason = "ai_invalid_response";
        } else {
          return err("parse", "Resposta da IA inválida.", 502, "ai_invalid_response");
        }
      } else {
        // deno-lint-ignore no-explicit-any
        claims = (parsed as { claims: any[] }).claims;
        globalWarnings = Array.isArray((parsed as { global_warnings?: unknown }).global_warnings)
          ? (parsed as { global_warnings: unknown[] }).global_warnings
          : [];
        missingCaseData = Array.isArray((parsed as { missing_case_data?: unknown }).missing_case_data)
          ? (parsed as { missing_case_data: unknown[] }).missing_case_data
          : [];
      }
    }

    if (usedFallback) {
      const minimal = buildMinimalMap(TRABALHISTA_INICIAL_REQUIRED_CLAIMS);
      claims = minimal.claims;
      globalWarnings = [
        ...minimal.global_warnings,
        `Motivo do fallback: ${fallbackReason}.`,
      ];
      missingCaseData = minimal.missing_case_data;
    } else if (requiredClaims.length > 0) {
      claims = normalizeClaimIds(claims, requiredClaims);
      claims = dropNonCanonicalClaims(claims, requiredClaims);
      claims = ensureRequiredClaims(claims, requiredClaims);
    }
    claims = applyDeterministicGuards(claims);

    const costEstimate = usedFallback ? 0 : estimateCost(model, inputTokens, outputTokens);


    // -----------------------------------------------------------------------
    // Persiste: nova versão, marca anteriores como not current.
    // -----------------------------------------------------------------------
    const { data: prev } = await admin
      .from("case_claim_maps")
      .select("id,version")
      .eq("case_id", caseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (prev?.version ?? 0) + 1;

    // Passo 1: desmarcar is_current antes de inserir o novo (índice único parcial)
    const { error: unsetErr } = await admin
      .from("case_claim_maps")
      .update({ is_current: false })
      .eq("case_id", caseId)
      .eq("is_current", true);
    if (unsetErr) {
      console.error("build-claim-map:unset_current_error", unsetErr.message);
      return err("persist", "Falha ao atualizar mapas anteriores.", 500, "unset_current_failed");
    }

    const { data: inserted, error: insErr } = await admin
      .from("case_claim_maps")
      .insert({
        organization_id: profile.organization_id,
        case_id: caseId,
        version: nextVersion,
        is_current: true,
        claims,
        global_warnings: globalWarnings,
        missing_case_data: missingCaseData,
        status: "awaiting_lawyer_review",
        model_used: model,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        cost_estimate: costEstimate,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("*")
      .single();
    if (insErr || !inserted) {
      console.error("build-claim-map:insert_error", insErr?.message);
      return err("persist", "Não foi possível salvar o mapa.", 500, "insert_failed");
    }

    // Telemetria — sem conteúdo das claims.
    await logAiUsage(admin, {
      organization_id: profile.organization_id,
      profile_id: user.id,
      // deno-lint-ignore no-explicit-any
      operation: "build_claim_map" as any,
      provider: "lovable-ai",
      model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      cost_estimated: costEstimate,
      processing_time_ms: llmMs,
      case_id: caseId,
      prompt_summary: `build_claim_map:${caseId.slice(0, 8)}`,
      metadata: {
        version: nextVersion,
        claims_count: claims.length,
        http_status: httpStatus,
        area: legalArea || null,
        total_ms: Date.now() - startedAt,
        used_fallback: usedFallback,
        fallback_reason: fallbackReason || null,
      },
    });

    return ok({ claim_map: inserted });
  } catch (e) {
    console.error("build-claim-map:unhandled", (e as Error).message?.slice(0, 200));
    return err("unknown", "Erro inesperado ao gerar o mapa.", 500);
  }
});
