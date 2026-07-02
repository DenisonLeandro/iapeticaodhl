// =============================================================================
// PR-4.3A.1 — Pré-preenchimento profundo da Ficha Inteligente
// =============================================================================
// Lê fontes já presentes (cases, case_analyses, client_interactions,
// client_files, clients.notes, document_chunks) e monta um conjunto de valores
// compatíveis com a Ficha. Não inventa dados. Não chama IA. Apenas leitura.
// Dados extraídos de chunks por regex são SUGESTÕES — o usuário revisa.
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { REPRESENTED_PARTY_OPTIONS, type CaseIntakeFormValues } from "@/types/caseIntake";

export interface IntakePrefillSource {
  hadCase: boolean;
  hadAnalysis: boolean;
  hadInteractions: boolean;
  hadFiles: boolean;
  hadClientNotes: boolean;
  hadChunks: boolean;
}

export interface IntakePrefillResult {
  values: Partial<CaseIntakeFormValues>;
  sources: IntakePrefillSource;
  filledFields: (keyof CaseIntakeFormValues)[];
  /** Campos preenchidos a partir de heurística sobre documentos (precisam de revisão). */
  heuristicFields: (keyof CaseIntakeFormValues)[];
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function trunc(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function normalizeRepresentedParty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  const direct = REPRESENTED_PARTY_OPTIONS.find((o) => o.value === v);
  if (direct) return direct.value;
  if (/autor|reclamante|requerente|exequente|impetrante/.test(v)) return "autor";
  if (/r[ée]u|reclamad|requerid|executad|impetrad/.test(v)) return "reu";
  if (/empresa|pessoa jur[íi]dica|cnpj/.test(v)) return "empresa";
  if (/pessoa f[íi]sica|cpf/.test(v)) return "pessoa_fisica";
  if (/interessad/.test(v)) return "interessado";
  return null;
}

// -----------------------------------------------------------------------------
// Heurísticas sobre texto agregado de documentos
// -----------------------------------------------------------------------------
interface HeuristicHits {
  opposingParty?: string;
  amount?: string;
  factsPeriod?: string;
  factsLocation?: string;
}

function extractFromText(text: string): HeuristicHits {
  const hits: HeuristicHits = {};
  const t = text.replace(/\s+/g, " ").slice(0, 20000);

  // Valor R$ — pega o primeiro razoável
  const money = t.match(/R\$\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?/);
  if (money) hits.amount = money[0].replace(/\s+/g, " ").trim();

  // Data DD/MM/AAAA
  const date = t.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d{4}\b/);
  if (date) hits.factsPeriod = date[0];

  // Cidade/UF — "em Cidade/UF" ou "na cidade de Cidade"
  const loc =
    t.match(/\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú]+(?:\s[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú]+){0,3}\/[A-Z]{2}\b/) ||
    t.match(/na\s+cidade\s+de\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú\s]{2,40})/);
  if (loc) hits.factsLocation = (loc[1] ?? loc[0]).trim();

  // Parte contrária — busca por rótulos comuns seguidos de nome próprio (com sufixos empresariais)
  const patterns = [
    /\b(?:reclamad[oa]|requerid[oa]|r[ée]u|executad[oa]|impetrad[oa])\s*:?\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][^.,;\n]{2,80}?(?:Ltda\.?|S\/A|S\.A\.?|ME|EIRELI|EPP|MEI)?)/i,
    /\bcontra\s+(?:a\s+empresa\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú0-9&\s.]{2,80}?(?:Ltda\.?|S\/A|S\.A\.?|ME|EIRELI|EPP))/,
    /\bempresa\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú0-9&\s.]{2,80}?(?:Ltda\.?|S\/A|S\.A\.?|ME|EIRELI|EPP))/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) {
      hits.opposingParty = m[1].trim().replace(/\s{2,}/g, " ");
      break;
    }
  }
  return hits;
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
export async function buildIntakePrefill(
  caseId: string,
  clientId: string | null,
): Promise<IntakePrefillResult> {
  const [caseResp, analysisResp, interactionsResp, filesResp, clientResp, chunksResp] =
    await Promise.all([
      supabase
        .from("cases")
        .select("subject, opposing_party, case_number, represented_party")
        .eq("id", caseId)
        .maybeSingle(),
      supabase
        .from("case_analyses")
        .select("content_json, summary, created_at, status")
        .eq("case_id", caseId)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      clientId
        ? supabase
            .from("client_interactions")
            .select("interaction_date, subject, notes, direction, channel")
            .eq("client_id", clientId)
            .order("interaction_date", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
      supabase
        .from("client_files")
        .select("file_name, classification, document_kind")
        .eq("case_id", caseId)
        .is("parent_file_id", null)
        .limit(50),
      clientId
        ? supabase.from("clients").select("notes").eq("id", clientId).maybeSingle()
        : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
      supabase
        .from("document_chunks")
        .select("content, page_from, chunk_index")
        .eq("case_id", caseId)
        .order("page_from", { ascending: true, nullsFirst: false })
        .order("chunk_index", { ascending: true })
        .limit(12),
    ]);

  const caseRow = (caseResp as { data: Record<string, unknown> | null }).data ?? null;
  const analysis = (analysisResp as { data: Record<string, unknown> | null }).data ?? null;
  const interactions =
    ((interactionsResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const files =
    ((filesResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const client = (clientResp as { data: Record<string, unknown> | null }).data ?? null;
  const chunks =
    ((chunksResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];

  const sources: IntakePrefillSource = {
    hadCase: !!caseRow,
    hadAnalysis: !!analysis,
    hadInteractions: interactions.length > 0,
    hadFiles: files.length > 0,
    hadClientNotes: !!(
      client &&
      typeof client.notes === "string" &&
      (client.notes as string).trim()
    ),
    hadChunks: chunks.length > 0,
  };

  const values: Partial<CaseIntakeFormValues> = {};
  const filled: (keyof CaseIntakeFormValues)[] = [];
  const heuristic: (keyof CaseIntakeFormValues)[] = [];

  const set = <K extends keyof CaseIntakeFormValues>(
    k: K,
    v: CaseIntakeFormValues[K],
    fromHeuristic = false,
  ) => {
    if (values[k] !== undefined) return;
    values[k] = v;
    filled.push(k);
    if (fromHeuristic) heuristic.push(k);
  };

  // 1) cases
  if (caseRow) {
    const subject = trunc(caseRow.subject as string | null, 2000);
    if (subject) set("problem_summary", subject);
    const opposing = trunc(caseRow.opposing_party as string | null, 500);
    if (opposing) set("opposing_party", opposing);
    const rp = normalizeRepresentedParty(caseRow.represented_party as string | null);
    if (rp) set("represented_party", rp);
    const cn = trunc(caseRow.case_number as string | null, 60);
    if (cn) {
      set("existing_case_number", cn);
      set("has_existing_lawsuit", true);
    }
  }

  // 2) interações — separa mensagens do cliente das internas
  if (interactions.length > 0) {
    const storyParts: string[] = [];
    const internalParts: string[] = [];
    for (const it of interactions) {
      const date = (it.interaction_date as string | null) ?? "";
      const subj = (it.subject as string | null) ?? "";
      const notes = (it.notes as string | null) ?? "";
      const direction = ((it.direction as string | null) ?? "").toLowerCase();
      const channel = ((it.channel as string | null) ?? "").toLowerCase();
      const header = [date, subj].filter(Boolean).join(" — ");
      const body = [header, notes].filter(Boolean).join("\n").trim();
      if (!body) continue;

      // Considera "do cliente" quando direction indica entrada ou canal é conversa direta
      const isFromClient =
        /in|inbound|recebid|entrada|cliente/.test(direction) ||
        /whatsapp|email|telefone|presencial|reuniao|reunião/.test(channel);
      if (isFromClient) storyParts.push(body);
      else internalParts.push(`[Atendimento interno${date ? ` (${date})` : ""}] ${body}`);
    }
    const story = trunc(storyParts.join("\n\n---\n\n"), 20000);
    if (story) set("client_story", story);
    if (internalParts.length) {
      const txt = trunc(internalParts.join("\n\n"), 5000);
      if (txt) values.internal_notes = txt; // acumula abaixo
    }
  }

  // 3) client_files → existing_documents
  if (files.length > 0) {
    const list = files
      .map((f) => {
        const name = (f.file_name as string | null) ?? "documento";
        const kind =
          (f.classification as string | null) ?? (f.document_kind as string | null) ?? null;
        return kind ? `${name} (${kind})` : name;
      })
      .join("; ");
    const text = trunc(list, 5000);
    if (text) set("existing_documents", text);
  }

  // 4) Chunks — heurísticas (SUGESTÃO)
  if (chunks.length > 0) {
    const aggregate = chunks
      .map((c) => (c.content as string | null) ?? "")
      .join("\n")
      .slice(0, 20000);
    const hits = extractFromText(aggregate);
    if (hits.opposingParty && !values.opposing_party) {
      set("opposing_party", trunc(hits.opposingParty, 500)!, true);
    }
    if (hits.amount && !values.amount_involved) {
      set("amount_involved", trunc(hits.amount, 120)!, true);
    }
    if (hits.factsPeriod && !values.facts_period) {
      set("facts_period", trunc(hits.factsPeriod, 500)!, true);
    }
    if (hits.factsLocation && !values.facts_location) {
      set("facts_location", trunc(hits.factsLocation, 500)!, true);
    }
  }

  // 5) análise → observações internas + missing_documents
  const internalParts: string[] = [];
  const existingInternal = values.internal_notes;
  if (existingInternal && typeof existingInternal === "string") {
    internalParts.push(existingInternal);
  }
  if (analysis) {
    const content = (analysis.content_json ?? {}) as Record<string, unknown>;
    const when = (analysis.created_at as string | null)?.slice(0, 10) ?? "";
    internalParts.push(
      `[Importado da análise prévia${when ? ` (${when})` : ""} — revisar antes de tratar como fato]`,
    );
    const summary = trunc(
      (content.summary as string | null) ?? (analysis.summary as string | null),
      1200,
    );
    if (summary) internalParts.push(`Resumo IA: ${summary}`);
    const next = trunc(content.next_action as string | null, 400);
    if (next) internalParts.push(`Próxima ação sugerida: ${next}`);
    const piece = trunc(content.recommended_piece as string | null, 200);
    if (piece) internalParts.push(`Peça recomendada: ${piece}`);
    const risks = Array.isArray(content.risks) ? (content.risks as string[]).filter(Boolean) : [];
    if (risks.length) internalParts.push(`Riscos: ${risks.slice(0, 5).join("; ")}`);
    const strengths = Array.isArray(content.strengths)
      ? (content.strengths as string[]).filter(Boolean)
      : [];
    if (strengths.length) internalParts.push(`Pontos fortes: ${strengths.slice(0, 5).join("; ")}`);

    if (!values.represented_party) {
      const rp = normalizeRepresentedParty(content.represented_party as string | null);
      if (rp) set("represented_party", rp);
    }

    const missing = Array.isArray(content.missing_documents)
      ? (content.missing_documents as string[]).filter(Boolean)
      : [];
    if (missing.length && !values.missing_documents) {
      const text = trunc("• " + missing.join("\n• "), 5000);
      if (text) set("missing_documents", text);
    }
  }

  if (sources.hadClientNotes) {
    internalParts.push(
      `Notas do cadastro do cliente: ${trunc(client!.notes as string, 1200)}`,
    );
  }

  if (internalParts.length) {
    const txt = trunc(internalParts.join("\n\n"), 5000);
    if (txt) {
      values.internal_notes = txt;
      if (!filled.includes("internal_notes")) filled.push("internal_notes");
    }
  }

  return { values, sources, filledFields: filled, heuristicFields: heuristic };
}
