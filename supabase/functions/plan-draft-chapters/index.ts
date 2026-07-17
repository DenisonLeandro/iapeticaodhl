// =============================================================================
// PR-2 — plan-draft-chapters
// Gera APENAS o esqueleto (sections) de uma peça por capítulos.
// Não redige conteúdo, não monta case_drafts.content, não altera revisão/versões.
// Suporte real: piece_type_key = 'trabalhista_inicial'.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { selectModelForTask } from "../_shared/model-router.ts";
import { getEconomyMode } from "../_shared/economy-mode.ts";
import { logAiUsage, summaryTag } from "../_shared/usage-log.ts";
import { estimateCost } from "../_shared/pricing.ts";
import {
  STRUCTURE_VERSION,
  baseSections,
  closingSections,
  meritCatalogForPlan,
  defaultMeritKeys,
  canonicalOrderIndex,
  MAX_MERITO_CHAPTERS,
  type StructureMarker,
} from "../_shared/structure/trabalhista-inicial.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Stage =
  | "auth" | "case_fetch" | "unsupported_type" | "plan" | "insert" | "unknown";

interface Payload {
  case_id?: string;
  draft_id?: string | null;
  piece_type_key?: string;
  legal_area?: string | null;
  template_id?: string | null;
  objective?: string;
  structure_instructions?: string;
  use_intake?: boolean;
  use_analysis?: boolean;
  use_documents?: boolean;
  use_template?: boolean;
  /** Fase 2 · Bloco 1 — força modelo forte para esta chamada. */
  high_precision?: boolean;
}

interface SectionPlan {
  section_key: string;
  section_label: string;
  order_index: number;
  quality_notes?: Record<string, unknown> | null;
}

// ---------- Estrutura canônica (fonte única compartilhada) ----------
// Abertura e fechamento vêm do módulo _shared/structure (mesmas section_keys,
// labels e order_index anteriores — sem drift no assemble/UI).
const BASE_SECTIONS: SectionPlan[] = baseSections();
const CLOSING_SECTIONS: SectionPlan[] = closingSections();

// Universo canônico de capítulos de mérito oferecidos ao LLM (exclui aliases
// legados; a ORDEM final vem sempre do rank canônico, não do LLM).
const MERITO_CATALOG: Record<string, string> = meritCatalogForPlan();

const FRIENDLY_UNSUPPORTED =
  "O modo por capítulos ainda está disponível apenas para petição inicial trabalhista. Para esta peça, use o modo rápido.";

// ---------- Helpers ----------
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(stage: Stage, message: string, code = "plan_failed", status = 500, details = "") {
  console.error(`plan-draft-chapters:${stage}`, { code, status, message, details: String(details).slice(0, 240) });
  return json({ success: false, code, stage, message }, status);
}
function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fallback */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callLlm(apiKey: string, model: string, system: string, user: string, timeoutMs = 45000) {
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
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("plan-draft-chapters:llm_http", res.status);
      return { parsed: null as Record<string, unknown> | null, usage: null as { input: number; output: number } | null };
    }
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const usage = data?.usage
      ? { input: data.usage.prompt_tokens ?? 0, output: data.usage.completion_tokens ?? 0 }
      : null;
    return { parsed: extractJson(raw), usage };
  } catch (e) {
    console.warn("plan-draft-chapters:llm_exception", (e as Error).message);
    return { parsed: null, usage: null };
  } finally {
    clearTimeout(timer);
  }
}

// Fallback conservador quando não temos sinal claro para escolher méritos.
const DEFAULT_MERITO_KEYS = defaultMeritKeys();

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("unknown", "Método não suportado.", "method_not_allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return err("auth", "Sessão expirada. Faça login novamente.", "unauthorized", 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return err("auth", "Sessão expirada. Faça login novamente.", "unauthorized", 401);

    const { data: profile } = await admin
      .from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
    if (!profile?.organization_id) return err("auth", "Usuário sem organização vinculada.", "no_organization", 403);

    let body: Payload;
    try { body = await req.json(); } catch { return err("unknown", "Requisição inválida.", "invalid_body", 400); }

    const caseId = body.case_id;
    const pieceTypeKey = body.piece_type_key ?? "trabalhista_inicial";
    if (!caseId) return err("case_fetch", "Caso não informado.", "case_id_required", 400);

    // Suporte real apenas a trabalhista_inicial neste PR.
    if (pieceTypeKey !== "trabalhista_inicial") {
      return json({
        success: false,
        code: "unsupported_piece_type",
        stage: "unsupported_type",
        message: FRIENDLY_UNSUPPORTED,
      }, 200);
    }

    // --- Contexto do caso ---
    const { data: caseRow, error: caseErr } = await admin
      .from("cases").select("*").eq("id", caseId).maybeSingle();
    if (caseErr) return err("case_fetch", "Não foi possível carregar o caso.", "case_lookup_failed", 500);
    if (!caseRow) return err("case_fetch", "Caso não encontrado.", "case_not_found", 404);
    if (caseRow.organization_id !== profile.organization_id) {
      return err("case_fetch", "Acesso negado ao caso.", "forbidden", 403);
    }

    let intake: Record<string, unknown> | null = null;
    if (body.use_intake !== false) {
      const { data } = await admin
        .from("case_intake_forms").select("*").eq("case_id", caseId).maybeSingle();
      intake = data ?? null;
    }
    let analysis: Record<string, unknown> | null = null;
    if (body.use_analysis !== false) {
      const { data } = await admin
        .from("case_analyses").select("*").eq("case_id", caseId).eq("status", "done")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      analysis = data ?? null;
    }

    // --- LLM: seleciona quais méritos incluir + notas curtas ---
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const economyMode = await getEconomyMode(admin, profile.organization_id);
    const highPrecision = body.high_precision === true;
    const meritoChoiceModel = selectModelForTask("plan_draft_chapters", { economyMode, highPrecision });
    let chosenMeritoKeys: string[] = [];
    let meritoNotes: Record<string, string> = {};
    let llmUsage: { input: number; output: number } | null = null;
    const llmStartAt = Date.now();
    let llmStatus: "success" | "error" | "skipped" = "skipped";

    if (apiKey) {
      const catalogList = Object.entries(MERITO_CATALOG)
        .map(([k, v]) => `- ${k}: ${v}`).join("\n");
      const sys = `Você é um advogado trabalhista sênior. Sua tarefa é escolher QUAIS capítulos de mérito devem existir no ESQUELETO de uma petição inicial trabalhista, com base nos fatos do caso. NÃO redija o mérito, apenas escolha as chaves. Responda APENAS JSON válido.`;
      const usr = `# CATÁLOGO DE CAPÍTULOS DE MÉRITO PERMITIDOS (use SOMENTE estas chaves; não invente novas):
${catalogList}

# CONTEXTO DO CASO
Área jurídica: ${caseRow.legal_area ?? intake?.legal_area ?? "trabalhista"}
Assunto: ${caseRow.subject ?? ""}
Parte representada: ${caseRow.represented_party ?? intake?.represented_party ?? ""}
Resumo do problema: ${truncate(intake?.problem_summary as string, 1500)}
História do cliente: ${truncate(intake?.client_story as string, 3000)}
Objetivo do advogado: ${body.objective ?? ""}
Orientações do advogado para a estrutura: ${body.structure_instructions ?? ""}
Resumo da análise: ${truncate((analysis as { content_json?: { summary?: string } } | null)?.content_json?.summary, 1500)}

# REGRAS
- Escolha apenas as chaves com base fática mínima no material acima.
- Se em dúvida entre incluir/excluir, INCLUA e adicione uma nota curta.
- Máximo ${MAX_MERITO_CHAPTERS} capítulos de mérito.
- Escolha apenas QUAIS capítulos entram; a ORDEM final é definida pelo sistema (não precisa ordenar).
- NÃO invente chaves fora do catálogo.
- NÃO use chave genérica "merito_pedido".

Retorne JSON:
{ "merito_keys": string[], "notes": { "<merito_key>": "<nota curta em uma linha>" } }`;
      const { parsed, usage } = await callLlm(apiKey, meritoChoiceModel.model, sys, usr, 45000);
      llmUsage = usage;
      llmStatus = parsed ? "success" : "error";
      if (parsed && Array.isArray((parsed as { merito_keys?: unknown }).merito_keys)) {
        const arr = ((parsed as { merito_keys: unknown[] }).merito_keys)
          .filter((x): x is string => typeof x === "string")
          .filter((k) => k in MERITO_CATALOG);
        // dedupe preservando ordem
        chosenMeritoKeys = Array.from(new Set(arr)).slice(0, MAX_MERITO_CHAPTERS);
        const rawNotes = (parsed as { notes?: Record<string, string> }).notes;
        if (rawNotes && typeof rawNotes === "object") {
          for (const k of chosenMeritoKeys) {
            if (typeof rawNotes[k] === "string") meritoNotes[k] = rawNotes[k];
          }
        }
      }
    }

    // Telemetria da chamada LLM do plan (best-effort).
    try {
      const tIn = llmUsage?.input ?? 0;
      const tOut = llmUsage?.output ?? 0;
      const cost = estimateCost(meritoChoiceModel.model, tIn, tOut);
      await logAiUsage(admin, {
        organization_id: profile.organization_id,
        profile_id: user.id,
        operation: "legal_draft_generation",
        provider: meritoChoiceModel.provider,
        model: meritoChoiceModel.model,
        tokens_input: tIn,
        tokens_output: tOut,
        cost_estimated: cost,
        processing_time_ms: Date.now() - llmStartAt,
        case_id: caseId,
        prompt_summary: summaryTag("legal_draft_generation", caseId),
        metadata: {
          edge_function: "plan-draft-chapters",
          source: "plan-draft-chapters",
          status: llmStatus,
          high_precision: highPrecision,
          economy_mode: economyMode,
          chosen_merito_count: chosenMeritoKeys.length,
        },
      });
    } catch { /* best-effort */ }

    if (chosenMeritoKeys.length === 0) {
      chosenMeritoKeys = [...DEFAULT_MERITO_KEYS];
    }

    // --- Monta lista final de sections ---
    // A ORDEM dos méritos vem SEMPRE do rank canônico (não da ordem em que o LLM
    // os listou). Se, por qualquer motivo, o rank não resolver, cai no fluxo
    // legado (100 + (i+1)*10) e registra warning — sem quebrar a geração.
    const structureWarnings: string[] = [];
    let canonicalOrderApplied = true;
    let fallbackReason: string | null = null;

    const sections: SectionPlan[] = [];
    sections.push(...BASE_SECTIONS);
    try {
      chosenMeritoKeys.forEach((k, i) => {
        const rank = canonicalOrderIndex(k);
        if (rank == null) {
          // Chave sem rank canônico: fallback legado só para este item.
          canonicalOrderApplied = false;
          fallbackReason = fallbackReason ?? `sem rank canônico para "${k}"`;
        }
        sections.push({
          section_key: k,
          section_label: MERITO_CATALOG[k] ?? k,
          order_index: rank ?? (100 + (i + 1) * 10),
          quality_notes: meritoNotes[k] ? { hint: meritoNotes[k] } : null,
        });
      });
    } catch (e) {
      // Fallback total: reconstrói méritos pela ordem legada.
      canonicalOrderApplied = false;
      fallbackReason = `exceção ao aplicar ordem canônica: ${(e as Error).message}`;
      sections.length = BASE_SECTIONS.length;
      chosenMeritoKeys.forEach((k, i) => {
        sections.push({
          section_key: k,
          section_label: MERITO_CATALOG[k] ?? k,
          order_index: 100 + (i + 1) * 10,
          quality_notes: meritoNotes[k] ? { hint: meritoNotes[k] } : null,
        });
      });
    }
    sections.push(...CLOSING_SECTIONS);

    if (!canonicalOrderApplied) {
      structureWarnings.push(
        "Ordem canônica de capítulos não aplicada integralmente; usando fluxo legado. Revisar estrutura.",
      );
    }

    // Marcador de versão estrutural (gravado em sources_used.structure — sem migration).
    const structureMarker: StructureMarker = {
      version: STRUCTURE_VERSION,
      canonical_order_applied: canonicalOrderApplied,
      fallback_reason: fallbackReason,
    };

    // --- Cria/atualiza draft ---
    let draftId = body.draft_id ?? null;
    const derivedTitle = `Petição inicial (por capítulos) — ${caseRow.subject ?? caseRow.case_number ?? "caso"}`;

    if (!draftId) {
      const { data: newDraft, error: insErr } = await admin
        .from("case_drafts")
        .insert({
          organization_id: profile.organization_id,
          case_id: caseId,
          created_by: user.id,
          updated_by: user.id,
          title: derivedTitle,
          draft_type: "initial_petition",
          status: "draft",
          content: "",
          objective: body.objective ?? null,
          tone: null,
          template_id: body.template_id ?? null,
          additional_instructions: body.structure_instructions ?? null,
          // Draft novo: sources_used é construído aqui; acrescentamos `structure`
          // preservando todas as demais chaves (intake/analysis/documents/template).
          sources_used: {
            intake: !!intake,
            analysis: !!analysis,
            documents: body.use_documents !== false,
            template: !!body.template_id && body.use_template !== false,
            structure: structureMarker,
          },
          warnings: structureWarnings.length ? structureWarnings : null,
          generation_mode: "chapters",
          assembly_status: "stale",
          piece_type_key: pieceTypeKey,
        })
        .select("id")
        .single();
      if (insErr || !newDraft) {
        return err("insert", "Não foi possível criar a minuta por capítulos.", "draft_insert_failed", 500, insErr?.message);
      }
      draftId = newDraft.id;
    } else {
      // Garante que o draft existe, é da org e é do modo chapters.
      // Lê sources_used/warnings existentes para MESCLAR (nunca substituir o JSONB
      // inteiro nem apagar referências documentais/fontes/RAG já gravadas).
      const { data: existing } = await admin
        .from("case_drafts")
        .select("id,organization_id,generation_mode,sources_used,warnings")
        .eq("id", draftId).maybeSingle();
      if (!existing || existing.organization_id !== profile.organization_id) {
        return err("insert", "Minuta não encontrada.", "draft_not_found", 404);
      }
      const priorSources = (existing.sources_used && typeof existing.sources_used === "object")
        ? existing.sources_used as Record<string, unknown>
        : {};
      const mergedSources = { ...priorSources, structure: structureMarker };
      const priorWarnings = Array.isArray(existing.warnings) ? existing.warnings as unknown[] : [];
      const mergedWarnings = Array.from(new Set([...priorWarnings.map(String), ...structureWarnings]));
      await admin
        .from("case_drafts")
        .update({
          generation_mode: "chapters",
          assembly_status: "stale",
          piece_type_key: pieceTypeKey,
          updated_by: user.id,
          objective: body.objective ?? null,
          additional_instructions: body.structure_instructions ?? null,
          template_id: body.template_id ?? null,
          sources_used: mergedSources,
          warnings: mergedWarnings.length ? mergedWarnings : null,
        })
        .eq("id", draftId);
    }

    // --- Idempotência: apaga sections do draft e reinsere ---
    const { error: delErr } = await admin
      .from("case_draft_sections").delete().eq("draft_id", draftId);
    if (delErr) return err("insert", "Falha ao redefinir capítulos.", "sections_delete_failed", 500, delErr.message);

    const rows = sections.map((s) => ({
      organization_id: profile.organization_id,
      case_id: caseId,
      draft_id: draftId,
      section_key: s.section_key,
      section_label: s.section_label,
      order_index: s.order_index,
      content: "",
      status: "pending",
      quality_notes: s.quality_notes ?? null,
      created_by: user.id,
      updated_by: user.id,
    }));
    const { error: insSecErr } = await admin.from("case_draft_sections").insert(rows);
    if (insSecErr) return err("insert", "Falha ao criar capítulos.", "sections_insert_failed", 500, insSecErr.message);

    return json({
      success: true,
      draft_id: draftId,
      piece_type_key: pieceTypeKey,
      sections_count: rows.length,
    });
  } catch (e) {
    return err("unknown", "Falha inesperada ao planejar capítulos.", "unexpected", 500, (e as Error).message);
  }
});
