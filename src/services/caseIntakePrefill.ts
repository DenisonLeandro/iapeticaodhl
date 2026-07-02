// =============================================================================
// PR-4.3A.1 (correção) — Pré-preenchimento profundo da Ficha Inteligente
// =============================================================================
// Regras:
// - Sem IA, sem save automático, sem sobrescrever campos manuais.
// - Não inventa dados. Rotula tudo que vier de documento/análise/IA.
// - subject genérico (ex.: "RT") NÃO vira problem_summary isoladamente.
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { REPRESENTED_PARTY_OPTIONS, type CaseIntakeFormValues } from "@/types/caseIntake";

export interface IntakePrefillDiagnostics {
  hasExistingIntake: boolean;
  hasCase: boolean;
  hasClientNotes: boolean;
  hasInteractions: boolean;
  hasFiles: boolean;
  hasChunks: boolean;
  chunksCount: number;
  chunksChars: number;
  priorityFilesCount: number;
  filledFields: string[];
}

export interface IntakePrefillResult {
  values: Partial<CaseIntakeFormValues>;
  filledFields: (keyof CaseIntakeFormValues)[];
  /** Campos vindos de heurística regex (parte contrária, valor, data, cidade). */
  heuristicFields: (keyof CaseIntakeFormValues)[];
  /** Campos preenchidos a partir de texto de documento/chunk. */
  documentSourcedFields: (keyof CaseIntakeFormValues)[];
  /** true quando não havia texto processado suficiente para produzir relato. */
  insufficientText: boolean;
  /** Rótulos de fontes efetivamente usadas (para toast). */
  sourcesUsed: string[];
  diagnostics: IntakePrefillDiagnostics;
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

const GENERIC_SUBJECTS = new Set([
  "rt",
  "trab",
  "trabalhista",
  "acao trabalhista",
  "ação trabalhista",
  "caso novo",
  "caso sem processo",
  "inicial",
  "peticao inicial",
  "petição inicial",
  "teste",
  "novo",
  "-",
  "n/a",
  "na",
  "sem assunto",
  "sem titulo",
  "sem título",
]);

function isGenericSubject(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  if (!t) return true;
  if (t.length <= 4) return true;
  if (!/\s/.test(t) && t.length <= 6) return true;
  return GENERIC_SUBJECTS.has(t);
}

function guessAreaFromSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const s = subject.toLowerCase();
  if (/\brt\b|trab/.test(s)) return "trabalhista";
  if (/previd/.test(s)) return "previdenciária";
  if (/consumid/.test(s)) return "de consumo";
  if (/fam[íi]lia|div[óo]rcio|alimento|guarda/.test(s)) return "de família";
  if (/penal|criminal/.test(s)) return "criminal";
  if (/tribut/.test(s)) return "tributária";
  if (/c[íi]vel|indeniza/.test(s)) return "cível";
  if (/empresarial|societ/.test(s)) return "empresarial";
  return null;
}

const FILE_PRIORITY_RE =
  /ficha|atendimento|relato|triagem|formul[áa]rio|formulario|inicial|cliente/i;

function isPriorityFile(row: {
  file_name?: string | null;
  classification?: string | null;
  document_kind?: string | null;
}): boolean {
  const hay = [row.file_name, row.classification, row.document_kind]
    .filter(Boolean)
    .join(" ");
  return FILE_PRIORITY_RE.test(hay);
}

// -----------------------------------------------------------------------------
// Heurísticas regex
// -----------------------------------------------------------------------------
interface HeuristicHits {
  opposingParty?: string;
  amount?: string;
  factsPeriod?: string;
  factsLocation?: string;
}

function extractFromText(text: string): HeuristicHits {
  const hits: HeuristicHits = {};
  const t = text.replace(/\s+/g, " ").slice(0, 40000);

  const money = t.match(/R\$\s?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?/);
  if (money) hits.amount = money[0].replace(/\s+/g, " ").trim();

  const date = t.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d{4}\b/);
  if (date) hits.factsPeriod = date[0];

  const loc =
    t.match(/\b[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú]+(?:\s[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú]+){0,3}\/[A-Z]{2}\b/) ||
    t.match(/na\s+cidade\s+de\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-Za-zÁ-ú\s]{2,40})/);
  if (loc) hits.factsLocation = (loc[1] ?? loc[0]).trim();

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

/** Escolhe um trecho narrativo do texto agregado, evitando cabeçalhos curtos. */
function pickNarrativeExcerpt(text: string, maxChars: number): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\r/g, "");
  // divide em parágrafos por linha em branco ou por . seguido de espaço + maiúscula
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 200 && !/^p[áa]gina\s+\d+/i.test(p));
  if (paragraphs.length === 0) {
    const flat = cleaned.replace(/\s+/g, " ").trim();
    if (flat.length < 200) return null;
    return trunc(flat, maxChars);
  }
  const joined = paragraphs.slice(0, 3).join("\n\n");
  return trunc(joined, maxChars);
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
export async function buildIntakePrefill(
  caseId: string,
  clientId: string | null,
): Promise<IntakePrefillResult> {
  const [
    caseResp,
    intakeResp,
    analysisResp,
    interactionsResp,
    filesResp,
    clientResp,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("subject, opposing_party, case_number, represented_party")
      .eq("id", caseId)
      .maybeSingle(),
    supabase
      .from("case_intake_forms")
      .select("problem_summary, client_story")
      .eq("case_id", caseId)
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
      .select("id, file_name, classification, document_kind")
      .eq("case_id", caseId)
      .is("parent_file_id", null)
      .limit(50),
    clientId
      ? supabase.from("clients").select("notes").eq("id", clientId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
  ]);

  const caseRow = (caseResp as { data: Record<string, unknown> | null }).data ?? null;
  const existingIntake =
    (intakeResp as { data: Record<string, unknown> | null }).data ?? null;
  const analysis = (analysisResp as { data: Record<string, unknown> | null }).data ?? null;
  const interactions =
    ((interactionsResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const files =
    ((filesResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const client = (clientResp as { data: Record<string, unknown> | null }).data ?? null;

  // ---- chunks: priorizar arquivos "ficha/atendimento/..." --------------------
  const priorityFileIds = files
    .filter((f) =>
      isPriorityFile({
        file_name: f.file_name as string | null,
        classification: f.classification as string | null,
        document_kind: f.document_kind as string | null,
      }),
    )
    .map((f) => f.id as string)
    .filter(Boolean);

  const chunkQueries: Promise<{ data: Array<Record<string, unknown>> | null }>[] = [];
  if (priorityFileIds.length > 0) {
    chunkQueries.push(
      supabase
        .from("document_chunks")
        .select("id, file_id, content, page_from, chunk_index")
        .in("file_id", priorityFileIds)
        .order("page_from", { ascending: true, nullsFirst: false })
        .order("chunk_index", { ascending: true })
        .limit(40) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
    );
  }
  chunkQueries.push(
    supabase
      .from("document_chunks")
      .select("id, file_id, content, page_from, chunk_index")
      .eq("case_id", caseId)
      .order("page_from", { ascending: true, nullsFirst: false })
      .order("chunk_index", { ascending: true })
      .limit(30) as unknown as Promise<{ data: Array<Record<string, unknown>> | null }>,
  );
  const chunkResps = await Promise.all(chunkQueries);
  const seen = new Set<string>();
  const priorityChunks: Array<Record<string, unknown>> = [];
  const fallbackChunks: Array<Record<string, unknown>> = [];
  chunkResps.forEach((resp, idx) => {
    const rows = resp.data ?? [];
    for (const r of rows) {
      const id = r.id as string;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (idx === 0 && priorityFileIds.length > 0) priorityChunks.push(r);
      else fallbackChunks.push(r);
    }
  });
  const allChunks = [...priorityChunks, ...fallbackChunks];

  const priorityText = priorityChunks
    .map((c) => (c.content as string | null) ?? "")
    .join("\n\n")
    .slice(0, 40000);
  const aggregateText = allChunks
    .map((c) => (c.content as string | null) ?? "")
    .join("\n\n")
    .slice(0, 40000);

  // ---- resultado ------------------------------------------------------------
  const values: Partial<CaseIntakeFormValues> = {};
  const filled: (keyof CaseIntakeFormValues)[] = [];
  const heuristic: (keyof CaseIntakeFormValues)[] = [];
  const documentSourced: (keyof CaseIntakeFormValues)[] = [];
  const sourcesUsed = new Set<string>();

  const set = <K extends keyof CaseIntakeFormValues>(
    k: K,
    v: CaseIntakeFormValues[K],
    opts: { fromHeuristic?: boolean; fromDocument?: boolean; source?: string } = {},
  ) => {
    if (values[k] !== undefined) return;
    values[k] = v;
    filled.push(k);
    if (opts.fromHeuristic) heuristic.push(k);
    if (opts.fromDocument) documentSourced.push(k);
    if (opts.source) sourcesUsed.add(opts.source);
  };

  // 1) cases (sem problem_summary — subject genérico é evitado abaixo)
  if (caseRow) {
    const opposing = trunc(caseRow.opposing_party as string | null, 500);
    if (opposing) set("opposing_party", opposing, { source: "caso" });
    const rp = normalizeRepresentedParty(caseRow.represented_party as string | null);
    if (rp) set("represented_party", rp, { source: "caso" });
    const cn = trunc(caseRow.case_number as string | null, 60);
    if (cn) {
      set("existing_case_number", cn, { source: "caso" });
      set("has_existing_lawsuit", true);
    }
  }

  // 2) interações do cliente → client_story
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
    const isFromClient =
      /in|inbound|recebid|entrada|cliente/.test(direction) ||
      /whatsapp|email|telefone|presencial|reuniao|reunião/.test(channel);
    if (isFromClient) storyParts.push(body);
    else internalParts.push(`[Atendimento interno${date ? ` (${date})` : ""}] ${body}`);
  }
  if (storyParts.length > 0) {
    const story = trunc(storyParts.join("\n\n---\n\n"), 20000);
    if (story) set("client_story", story, { source: "interações do cliente" });
  }

  // 3) chunks → heurísticas regex
  if (aggregateText.length > 0) {
    const hits = extractFromText(aggregateText);
    if (hits.opposingParty && !values.opposing_party) {
      set("opposing_party", trunc(hits.opposingParty, 500)!, {
        fromHeuristic: true,
        fromDocument: true,
        source: "documentos processados",
      });
    }
    if (hits.amount && !values.amount_involved) {
      set("amount_involved", trunc(hits.amount, 120)!, {
        fromHeuristic: true,
        fromDocument: true,
        source: "documentos processados",
      });
    }
    if (hits.factsPeriod && !values.facts_period) {
      set("facts_period", trunc(hits.factsPeriod, 500)!, {
        fromHeuristic: true,
        fromDocument: true,
        source: "documentos processados",
      });
    }
    if (hits.factsLocation && !values.facts_location) {
      set("facts_location", trunc(hits.factsLocation, 500)!, {
        fromHeuristic: true,
        fromDocument: true,
        source: "documentos processados",
      });
    }
  }

  // 4) client_story a partir de documentos, se ainda vazio
  if (!values.client_story) {
    const excerptSource = priorityText || aggregateText;
    const excerpt = pickNarrativeExcerpt(excerptSource, 4000);
    if (excerpt) {
      const firstFileName =
        (priorityChunks[0]?.file_id &&
          files.find((f) => f.id === priorityChunks[0].file_id)?.file_name) ||
        (allChunks[0]?.file_id &&
          files.find((f) => f.id === allChunks[0].file_id)?.file_name) ||
        "documento processado";
      const story = `Relato importado de documentos processados — revise antes de salvar.\n\n[Documento: ${firstFileName}]\n${excerpt}`;
      set("client_story", trunc(story, 20000)!, {
        fromDocument: true,
        source: "documentos processados",
      });
    }
  }

  // 5) fallback client_story → clients.notes
  if (!values.client_story && client && typeof client.notes === "string") {
    const notes = trunc(client.notes as string, 5000);
    if (notes) {
      set("client_story", `Notas do cadastro do cliente:\n${notes}`, {
        source: "notas do cliente",
      });
    }
  }

  // 6) problem_summary — ordem de prioridade
  const existingIntakeSummary =
    existingIntake && typeof existingIntake.problem_summary === "string"
      ? (existingIntake.problem_summary as string).trim()
      : "";
  if (existingIntakeSummary) {
    set("problem_summary", trunc(existingIntakeSummary, 2000)!, {
      source: "ficha existente",
    });
  }

  if (!values.problem_summary && priorityText) {
    const excerpt = pickNarrativeExcerpt(priorityText, 800);
    if (excerpt) {
      set(
        "problem_summary",
        trunc(
          `Resumo extraído de documento processado — revisar: ${excerpt}`,
          2000,
        )!,
        { fromDocument: true, source: "documentos processados" },
      );
    }
  }

  if (!values.problem_summary && storyParts.length > 0) {
    const first = storyParts[0].replace(/\s+/g, " ").slice(0, 700);
    set(
      "problem_summary",
      trunc(`Resumo a partir de atendimento — revisar: ${first}`, 2000)!,
      { source: "interações do cliente" },
    );
  }

  if (!values.problem_summary && analysis) {
    const content = (analysis.content_json ?? {}) as Record<string, unknown>;
    const analysisSummary = trunc(
      (content.summary as string | null) ?? (analysis.summary as string | null),
      1200,
    );
    if (analysisSummary) {
      set(
        "problem_summary",
        trunc(`Resumo IA prévio — revisar: ${analysisSummary}`, 2000)!,
        { source: "análise prévia da IA" },
      );
    }
  }

  // Resumo determinístico quando houver sinais mínimos (parte contrária/área)
  if (!values.problem_summary) {
    const op = values.opposing_party;
    const area = guessAreaFromSubject(caseRow?.subject as string | null);
    if (op || area) {
      const parts = ["Cliente relata possível demanda"];
      if (area) parts.push(area);
      if (op) parts.push(`em face de ${op}`);
      const base =
        parts.join(" ") +
        ", conforme ficha/documentos existentes. Revisar e complementar os fatos antes da análise final.";
      set("problem_summary", trunc(base, 2000)!, { source: "resumo determinístico" });
    }
  }

  // Fallback residual: subject NÃO-genérico
  if (!values.problem_summary && caseRow) {
    const subject = caseRow.subject as string | null;
    if (subject && !isGenericSubject(subject)) {
      set("problem_summary", trunc(subject, 2000)!, { source: "assunto do caso" });
    }
  }

  // 7) documentos existentes (nomes dos arquivos)
  if (files.length > 0 && !values.existing_documents) {
    const list = files
      .map((f) => {
        const name = (f.file_name as string | null) ?? "documento";
        const kind =
          (f.classification as string | null) ?? (f.document_kind as string | null) ?? null;
        return kind ? `${name} (${kind})` : name;
      })
      .join("; ");
    const text = trunc(list, 5000);
    if (text) set("existing_documents", text, { source: "arquivos do caso" });
  }

  // 8) análise → observações internas + missing_documents (rotulado)
  if (analysis) {
    const content = (analysis.content_json ?? {}) as Record<string, unknown>;
    const when = (analysis.created_at as string | null)?.slice(0, 10) ?? "";
    const notesParts: string[] = [
      `[Importado da análise prévia${when ? ` (${when})` : ""} — revisar antes de tratar como fato]`,
    ];
    const summary = trunc(
      (content.summary as string | null) ?? (analysis.summary as string | null),
      1200,
    );
    if (summary) notesParts.push(`Resumo IA: ${summary}`);
    const next = trunc(content.next_action as string | null, 400);
    if (next) notesParts.push(`Próxima ação sugerida: ${next}`);
    const piece = trunc(content.recommended_piece as string | null, 200);
    if (piece) notesParts.push(`Peça recomendada: ${piece}`);
    const risks = Array.isArray(content.risks) ? (content.risks as string[]).filter(Boolean) : [];
    if (risks.length) notesParts.push(`Riscos: ${risks.slice(0, 5).join("; ")}`);
    const strengths = Array.isArray(content.strengths)
      ? (content.strengths as string[]).filter(Boolean)
      : [];
    if (strengths.length) notesParts.push(`Pontos fortes: ${strengths.slice(0, 5).join("; ")}`);

    if (!values.represented_party) {
      const rp = normalizeRepresentedParty(content.represented_party as string | null);
      if (rp) set("represented_party", rp, { source: "análise prévia da IA" });
    }

    const missing = Array.isArray(content.missing_documents)
      ? (content.missing_documents as string[]).filter(Boolean)
      : [];
    if (missing.length && !values.missing_documents) {
      const text = trunc("• " + missing.join("\n• "), 5000);
      if (text) set("missing_documents", text, { source: "análise prévia da IA" });
    }

    internalParts.push(...notesParts);
    sourcesUsed.add("análise prévia da IA");
  }

  if (client && typeof client.notes === "string" && (client.notes as string).trim()) {
    internalParts.push(
      `Notas do cadastro do cliente: ${trunc(client.notes as string, 1200)}`,
    );
    sourcesUsed.add("notas do cliente");
  }

  if (internalParts.length) {
    const txt = trunc(internalParts.join("\n\n"), 5000);
    if (txt) {
      values.internal_notes = txt;
      if (!filled.includes("internal_notes")) filled.push("internal_notes");
    }
  }

  // ---- diagnóstico ---------------------------------------------------------
  const insufficientText =
    !values.client_story &&
    storyParts.length === 0 &&
    aggregateText.length < 500 &&
    !(client && typeof client.notes === "string" && (client.notes as string).trim());

  const diagnostics: IntakePrefillDiagnostics = {
    hasExistingIntake: !!existingIntake,
    hasCase: !!caseRow,
    hasClientNotes: !!(
      client &&
      typeof client.notes === "string" &&
      (client.notes as string).trim()
    ),
    hasInteractions: interactions.length > 0,
    hasFiles: files.length > 0,
    hasChunks: allChunks.length > 0,
    chunksCount: allChunks.length,
    chunksChars: aggregateText.length,
    priorityFilesCount: priorityFileIds.length,
    filledFields: filled.map(String),
  };

  return {
    values,
    filledFields: filled,
    heuristicFields: heuristic,
    documentSourcedFields: documentSourced,
    insufficientText,
    sourcesUsed: Array.from(sourcesUsed),
    diagnostics,
  };
}
