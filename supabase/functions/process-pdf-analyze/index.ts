// =============================================================================
// Edge Function: process-pdf-analyze
// Extrai texto de PDFs em client_files e gera análise jurídica via Lovable AI,
// sempre sob a perspectiva da parte representada pelo escritório.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-2.5-flash";
const MAX_CHARS_TOTAL = 1_500_000;
const SINGLE_PASS_MAX_CHARS = 250_000;
const CHUNK_SIZE = 200_000;
const EXTRACTED_TEXT_STORE_LIMIT = 200_000;
const SCANNED_TEXT_THRESHOLD = 200;

const SCANNED_MSG =
  "Este PDF parece estar escaneado e não possui texto extraível. Para análise com IA, envie uma versão pesquisável/OCR ou divida os documentos principais.";

const ALLOWED_PARTIES = [
  "autor",
  "reu",
  "recorrente",
  "recorrido",
  "exequente",
  "executado",
  "terceiro",
  "outro",
] as const;
type RepresentedParty = (typeof ALLOWED_PARTIES)[number];

const PARTY_LABEL: Record<RepresentedParty, string> = {
  autor: "Autor / Requerente / Reclamante",
  reu: "Réu / Requerido / Reclamada",
  recorrente: "Recorrente",
  recorrido: "Recorrido",
  exequente: "Exequente",
  executado: "Executado",
  terceiro: "Terceiro interessado",
  outro: "Parte representada (não classificada)",
};

const OPPOSING_HINT: Record<RepresentedParty, string> = {
  autor: "Réu / Requerido / Reclamada",
  reu: "Autor / Requerente / Reclamante",
  recorrente: "Recorrido",
  recorrido: "Recorrente",
  exequente: "Executado",
  executado: "Exequente",
  terceiro: "Demais partes do processo",
  outro: "Polo contrário ao representado",
};

function normalizeParty(v: unknown): RepresentedParty {
  return typeof v === "string" && (ALLOWED_PARTIES as readonly string[]).includes(v)
    ? (v as RepresentedParty)
    : "autor";
}

interface AnalysisJson {
  parte_representada: RepresentedParty;
  parte_contraria: string;
  perspectiva_da_analise: string;
  resumo_geral: string;
  partes_identificadas: string[];
  fase_processual: string;
  pedidos_principais: string[];
  teses_da_parte_contraria: string[];
  documentos_relevantes: string[];
  decisoes_despachos: string[];
  provas_identificadas: string[];
  pontos_favoraveis_a_parte_representada: string[];
  pontos_de_risco_para_parte_representada: string[];
  estrategia_recomendada_para_parte_representada: string;
  sugestao_de_peticao_cabivel: string;
  informacoes_nao_encontradas: string[];
  observacoes: string;
  resumo_advogado?: string;
}

function buildAnalysisTool(party: RepresentedParty) {
  return {
    type: "function",
    function: {
      name: "save_analysis",
      description: "Salva a análise estruturada do processo judicial sob a perspectiva da parte representada.",
      parameters: {
        type: "object",
        properties: {
          parte_representada: {
            type: "string",
            enum: [...ALLOWED_PARTIES],
            description: `Parte representada pelo escritório. Use exatamente "${party}".`,
          },
          parte_contraria: {
            type: "string",
            description: "Polo contrário identificado no processo (nome/identificação quando possível).",
          },
          perspectiva_da_analise: {
            type: "string",
            description: `Frase curta deixando explícito que a análise foi feita sob a perspectiva de ${PARTY_LABEL[party]}.`,
          },
          resumo_geral: { type: "string", description: "Resumo geral do processo (3-6 parágrafos)." },
          partes_identificadas: { type: "array", items: { type: "string" } },
          fase_processual: { type: "string" },
          pedidos_principais: { type: "array", items: { type: "string" } },
          teses_da_parte_contraria: {
            type: "array",
            items: { type: "string" },
            description: "Argumentos/teses do polo contrário ao representado.",
          },
          documentos_relevantes: { type: "array", items: { type: "string" } },
          decisoes_despachos: { type: "array", items: { type: "string" } },
          provas_identificadas: { type: "array", items: { type: "string" } },
          pontos_favoraveis_a_parte_representada: {
            type: "array",
            items: { type: "string" },
            description: `Fatos, provas, precedentes ou aspectos processuais favoráveis a ${PARTY_LABEL[party]}.`,
          },
          pontos_de_risco_para_parte_representada: {
            type: "array",
            items: { type: "string" },
            description: `Fragilidades, riscos ou pontos de ataque contra ${PARTY_LABEL[party]}.`,
          },
          estrategia_recomendada_para_parte_representada: {
            type: "string",
            description: `Estratégia processual recomendada para defender os interesses de ${PARTY_LABEL[party]}.`,
          },
          sugestao_de_peticao_cabivel: {
            type: "string",
            description: `Tipo de peça mais adequado neste momento, sempre no interesse de ${PARTY_LABEL[party]}.`,
          },
          informacoes_nao_encontradas: { type: "array", items: { type: "string" } },
          observacoes: { type: "string" },
          resumo_advogado: {
            type: "string",
            description:
              "Resumo executivo em markdown para o advogado. DEVE começar exatamente com a linha: **Análise realizada sob a perspectiva de: " +
              PARTY_LABEL[party] +
              ".**",
          },
        },
        required: [
          "parte_representada",
          "parte_contraria",
          "perspectiva_da_analise",
          "resumo_geral",
          "partes_identificadas",
          "fase_processual",
          "pedidos_principais",
          "teses_da_parte_contraria",
          "documentos_relevantes",
          "decisoes_despachos",
          "provas_identificadas",
          "pontos_favoraveis_a_parte_representada",
          "pontos_de_risco_para_parte_representada",
          "estrategia_recomendada_para_parte_representada",
          "sugestao_de_peticao_cabivel",
          "informacoes_nao_encontradas",
          "observacoes",
          "resumo_advogado",
        ],
        additionalProperties: false,
      },
    },
  };
}

function buildSystemPrompt(party: RepresentedParty) {
  return `Você é um advogado brasileiro sênior, com forte atuação em Direito do Trabalho, analisando o PDF de um processo judicial.

PERSPECTIVA OBRIGATÓRIA
- O escritório que solicita a análise representa: ${PARTY_LABEL[party]} (valor técnico: "${party}").
- Polo contrário esperado: ${OPPOSING_HINT[party]}.
- TODA a análise deve ser feita defendendo os interesses de ${PARTY_LABEL[party]}.
- Pontos favoráveis = favoráveis a ${PARTY_LABEL[party]}.
- Pontos de risco = riscos PARA ${PARTY_LABEL[party]}.
- Teses da parte contrária = argumentos do polo oposto a ${PARTY_LABEL[party]}.
- Estratégia e sugestão de petição = para defender ${PARTY_LABEL[party]}.
- NUNCA presuma que representamos a parte contrária.

Regras rígidas:
- NÃO invente fatos, partes, datas ou documentos.
- Diferencie claramente fatos alegados de fatos comprovados.
- Quando uma informação não estiver no texto, liste em "informacoes_nao_encontradas".
- Use linguagem jurídica técnica em português do Brasil, contemplando terminologia trabalhista quando aplicável (reclamante/reclamada).
- Quando possível, indique a origem aproximada (ex.: "fls. 12", "pág. ~34", "decisão de 03/2024").
- O campo "observacoes" deve lembrar que a revisão final é obrigatória pelo advogado responsável.
- Responda SEMPRE chamando a tool save_analysis. Não escreva texto fora da tool.
- O campo resumo_advogado DEVE começar exatamente com:
  "**Análise realizada sob a perspectiva de: ${PARTY_LABEL[party]}.**"`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function corsJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function callAI(messages: unknown[], party: RepresentedParty, apiKey: string) {
  const tool = buildAnalysisTool(party);
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: "save_analysis" } },
    }),
  });

  if (resp.status === 429) throw new Error("RATE_LIMIT");
  if (resp.status === 402) throw new Error("NO_CREDITS");
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway error ${resp.status}: ${t.slice(0, 300)}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI não retornou tool_call save_analysis.");
  }
  const args = JSON.parse(toolCall.function.arguments) as AnalysisJson;
  // Garante perspectiva correta mesmo se a IA divergir
  args.parte_representada = party;
  const usage = {
    input: data.usage?.prompt_tokens ?? 0,
    output: data.usage?.completion_tokens ?? 0,
  };
  return { analysis: args, usage };
}

async function analyzeSinglePass(text: string, party: RepresentedParty, apiKey: string) {
  const userPrompt = `Abaixo está o texto integral (ou consolidado) de um processo judicial.
Analise SOB A PERSPECTIVA de ${PARTY_LABEL[party]} e chame a tool save_analysis preenchendo TODOS os campos.

==== TEXTO DO PROCESSO ====
${text}
==== FIM ====`;

  return callAI(
    [
      { role: "system", content: buildSystemPrompt(party) },
      { role: "user", content: userPrompt },
    ],
    party,
    apiKey,
  );
}

async function analyzeChunked(text: string, party: RepresentedParty, apiKey: string) {
  const chunks = chunkText(text, CHUNK_SIZE);
  const partials: string[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prompt = `Você está analisando o BLOCO ${i + 1}/${chunks.length} de um processo judicial extenso, SOB A PERSPECTIVA de ${PARTY_LABEL[party]}.

NESTE BLOCO, extraia em bullets concisos:
- Partes mencionadas
- Pedidos identificados (de qual polo)
- Teses/argumentos do polo contrário a ${PARTY_LABEL[party]}
- Documentos citados
- Decisões/despachos
- Provas mencionadas
- Pontos favoráveis a ${PARTY_LABEL[party]} e pontos de risco para ${PARTY_LABEL[party]}
- Trechos relevantes (com referência aproximada de página, se houver)

Não conclua nada definitivo — outros blocos virão depois.

==== BLOCO ${i + 1}/${chunks.length} ====
${chunk}
==== FIM DO BLOCO ====`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `Você é um advogado brasileiro extraindo bullets factuais de blocos de um processo, sob a perspectiva de ${PARTY_LABEL[party]}. Não invente nada.`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("NO_CREDITS");
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway erro no bloco ${i + 1}: ${t.slice(0, 200)}`);
    }
    const data = await resp.json();
    partials.push(`### Bloco ${i + 1}/${chunks.length}\n${data.choices?.[0]?.message?.content ?? ""}`);
    totalInput += data.usage?.prompt_tokens ?? 0;
    totalOutput += data.usage?.completion_tokens ?? 0;
  }

  const consolidated = partials.join("\n\n");
  const finalRes = await analyzeSinglePass(consolidated, party, apiKey);
  finalRes.usage.input += totalInput;
  finalRes.usage.output += totalOutput;
  return finalRes;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsJson({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return corsJson({ error: "LOVABLE_API_KEY ausente" }, 500);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return corsJson({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  const { data: profile, error: profileErr } = await userClient
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  if (profileErr || !profile?.organization_id) {
    return corsJson({ error: "Perfil/organização não encontrados" }, 403);
  }
  const userOrgId = profile.organization_id as string;

  let body: { file_id?: string; represented_party?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "JSON inválido" }, 400);
  }
  const fileId = body.file_id;
  if (!fileId || typeof fileId !== "string") {
    return corsJson({ error: "file_id obrigatório" }, 400);
  }

  const { data: fileRec, error: fileErr } = await admin
    .from("client_files")
    .select(
      "id, organization_id, client_id, case_id, file_type, file_name, storage_path, represented_party",
    )
    .eq("id", fileId)
    .single();

  if (fileErr || !fileRec) return corsJson({ error: "Arquivo não encontrado" }, 404);
  if (fileRec.organization_id !== userOrgId) {
    return corsJson({ error: "Acesso negado" }, 403);
  }
  if (fileRec.file_type !== "application/pdf") {
    return corsJson({ error: "Apenas arquivos PDF podem ser analisados" }, 400);
  }

  // Resolve perspectiva: case > arquivo > body > default "autor".
  let casePartyRaw: string | null = null;
  if (fileRec.case_id) {
    const { data: caseRow } = await admin
      .from("cases")
      .select("represented_party")
      .eq("id", fileRec.case_id)
      .single();
    casePartyRaw = (caseRow?.represented_party as string | null) ?? null;
  }
  const resolvedParty = normalizeParty(
    casePartyRaw ?? fileRec.represented_party ?? body.represented_party ?? "autor",
  );

  await admin
    .from("client_files")
    .update({
      processing_status: "processing",
      error_message: null,
      represented_party: resolvedParty,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId);

  const markError = async (message: string) => {
    await admin
      .from("client_files")
      .update({
        processing_status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);
  };

  const logUsage = async (params: {
    status: string;
    chars: number;
    tokensIn: number;
    tokensOut: number;
    error?: string;
  }) => {
    try {
      await admin.from("ai_usage_log").insert({
        organization_id: userOrgId,
        profile_id: userId,
        provider: "lovable",
        model: MODEL,
        tokens_input: params.tokensIn,
        tokens_output: params.tokensOut,
        cost_estimated: 0,
        prompt_summary: JSON.stringify({
          kind: "pdf_analyze",
          file_id: fileId,
          client_id: fileRec.client_id,
          case_id: fileRec.case_id,
          represented_party: resolvedParty,
          chars: params.chars,
          status: params.status,
          error: params.error,
        }).slice(0, 2000),
      });
    } catch (e) {
      console.error("ai_usage_log insert failed", e);
    }
  };

  try {
    const { data: blob, error: dlErr } = await admin.storage
      .from("client-documents")
      .download(fileRec.storage_path);
    if (dlErr || !blob) throw new Error(`Falha ao baixar PDF: ${dlErr?.message ?? "desconhecido"}`);

    const buf = new Uint8Array(await blob.arrayBuffer());

    let text = "";
    try {
      const pdf = await getDocumentProxy(buf);
      const { text: pageTexts } = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(pageTexts) ? pageTexts : [String(pageTexts ?? "")];
      text = pages
        .map((t, i) => `\n\n[Página ${i + 1}]\n${(t ?? "").trim()}`)
        .join("");
    } catch (e) {
      console.error("unpdf error", e);
      await markError("Não foi possível ler este PDF. Verifique se o arquivo não está corrompido ou protegido por senha.");
      await logUsage({ status: "error", chars: 0, tokensIn: 0, tokensOut: 0, error: "extract_failed" });
      return corsJson({ status: "error", error: "extract_failed" }, 200);
    }

    const cleanLen = text.replace(/\s+/g, "").length;
    if (cleanLen < SCANNED_TEXT_THRESHOLD) {
      await markError(SCANNED_MSG);
      await logUsage({ status: "error", chars: cleanLen, tokensIn: 0, tokensOut: 0, error: "scanned_pdf" });
      return corsJson({ status: "error", error: "scanned_pdf", message: SCANNED_MSG }, 200);
    }

    if (text.length > MAX_CHARS_TOTAL) {
      const msg =
        "Este processo é muito extenso para análise em uma única operação. Divida em volumes (ex.: inicial + contestação + decisões principais) e envie separadamente.";
      await markError(msg);
      await logUsage({ status: "error", chars: text.length, tokensIn: 0, tokensOut: 0, error: "too_large" });
      return corsJson({ status: "error", error: "too_large", message: msg }, 200);
    }

    const { analysis, usage } =
      text.length <= SINGLE_PASS_MAX_CHARS
        ? await analyzeSinglePass(text, resolvedParty, LOVABLE_API_KEY)
        : await analyzeChunked(text, resolvedParty, LOVABLE_API_KEY);

    // Garante prefixo da perspectiva no summary
    const partyLabel = PARTY_LABEL[resolvedParty];
    const prefix = `**Análise realizada sob a perspectiva de: ${partyLabel}.**`;
    let summary = (analysis.resumo_advogado ?? analysis.resumo_geral ?? "").trim();
    if (!summary.toLowerCase().startsWith("**análise realizada sob a perspectiva")) {
      summary = `${prefix}\n\n${summary}`;
    }

    const truncatedText =
      text.length > EXTRACTED_TEXT_STORE_LIMIT
        ? text.slice(0, EXTRACTED_TEXT_STORE_LIMIT) +
          `\n\n[... texto truncado. Total original: ${text.length} caracteres ...]`
        : text;

    await admin
      .from("client_files")
      .update({
        extracted_text: truncatedText,
        analysis_summary: summary,
        analysis_json: analysis,
        represented_party: resolvedParty,
        processed_at: new Date().toISOString(),
        processing_status: "analyzed",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    await logUsage({
      status: "analyzed",
      chars: text.length,
      tokensIn: usage.input,
      tokensOut: usage.output,
    });

    return corsJson({
      status: "analyzed",
      summary,
      analysis_json: analysis,
      represented_party: resolvedParty,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    let userMsg = "Falha ao analisar o PDF. Tente novamente em alguns instantes.";
    if (raw === "RATE_LIMIT") userMsg = "Limite de requisições à IA excedido. Tente novamente em alguns minutos.";
    else if (raw === "NO_CREDITS") userMsg = "Créditos de IA insuficientes. Adicione créditos em Settings > Workspace > Usage.";
    else if (raw.length < 200) userMsg = raw;

    console.error("process-pdf-analyze error", raw);
    await markError(userMsg);
    await logUsage({ status: "error", chars: 0, tokensIn: 0, tokensOut: 0, error: raw.slice(0, 300) });
    return corsJson({ status: "error", error: userMsg }, 200);
  }
});
