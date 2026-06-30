// =============================================================================
// PR-4.3A.1 — Pré-preenchimento da Ficha com dados já existentes do caso
// =============================================================================
// Lê fontes já presentes (cases, case_analyses, client_interactions, client_files,
// clients.notes) e monta um conjunto de valores compatíveis com a Ficha.
// Não inventa dados. Não chama IA. Apenas leitura.
// =============================================================================
import { supabase } from "@/lib/backend/client";
import { REPRESENTED_PARTY_OPTIONS, type CaseIntakeFormValues } from "@/types/caseIntake";

export interface IntakePrefillSource {
  hadCase: boolean;
  hadAnalysis: boolean;
  hadInteractions: boolean;
  hadFiles: boolean;
  hadClientNotes: boolean;
}

export interface IntakePrefillResult {
  values: Partial<CaseIntakeFormValues>;
  sources: IntakePrefillSource;
  filledFields: (keyof CaseIntakeFormValues)[];
}

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
  // mapeia rótulos comuns -> enum
  if (/autor|reclamante|requerente|exequente|impetrante/.test(v)) return "autor";
  if (/r[ée]u|reclamad|requerid|executad|impetrad/.test(v)) return "reu";
  if (/empresa|pessoa jur[íi]dica|cnpj/.test(v)) return "empresa";
  if (/pessoa f[íi]sica|cpf/.test(v)) return "pessoa_fisica";
  if (/interessad/.test(v)) return "interessado";
  return null;
}

export async function buildIntakePrefill(
  caseId: string,
  clientId: string | null,
): Promise<IntakePrefillResult> {
  const [caseResp, analysisResp, interactionsResp, filesResp, clientResp] = await Promise.all([
    supabase
      .from("cases")
      .select("subject, opposing_party, case_number")
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
          .select("interaction_date, subject, notes")
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
  ]);

  const caseRow = (caseResp as { data: Record<string, unknown> | null }).data ?? null;
  const analysis = (analysisResp as { data: Record<string, unknown> | null }).data ?? null;
  const interactions =
    ((interactionsResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const files =
    ((filesResp as { data: Array<Record<string, unknown>> | null }).data ?? []) || [];
  const client = (clientResp as { data: Record<string, unknown> | null }).data ?? null;

  const sources: IntakePrefillSource = {
    hadCase: !!caseRow,
    hadAnalysis: !!analysis,
    hadInteractions: interactions.length > 0,
    hadFiles: files.length > 0,
    hadClientNotes: !!(client && typeof client.notes === "string" && (client.notes as string).trim()),
  };

  const values: Partial<CaseIntakeFormValues> = {};
  const filled: (keyof CaseIntakeFormValues)[] = [];

  // 1) Dados básicos do caso
  if (caseRow) {
    const subject = trunc(caseRow.subject as string | null, 2000);
    if (subject) {
      values.problem_summary = subject;
      filled.push("problem_summary");
    }
    const opposing = trunc(caseRow.opposing_party as string | null, 500);
    if (opposing) {
      values.opposing_party = opposing;
      filled.push("opposing_party");
    }
  }

  // 2) Relato a partir de interações com o cliente
  if (interactions.length > 0) {
    const parts: string[] = [];
    for (const it of interactions) {
      const date = (it.interaction_date as string | null) ?? "";
      const subj = (it.subject as string | null) ?? "";
      const notes = (it.notes as string | null) ?? "";
      const header = [date, subj].filter(Boolean).join(" — ");
      const body = [header, notes].filter(Boolean).join("\n");
      if (body.trim()) parts.push(body.trim());
    }
    const story = trunc(parts.join("\n\n---\n\n"), 20000);
    if (story) {
      values.client_story = story;
      filled.push("client_story");
    }
  }

  // 3) Documentos já enviados
  if (files.length > 0) {
    const list = files
      .map((f) => {
        const name = (f.file_name as string | null) ?? "documento";
        const kind = (f.classification as string | null) ?? (f.document_kind as string | null) ?? null;
        return kind ? `${name} (${kind})` : name;
      })
      .join("; ");
    const text = trunc(list, 5000);
    if (text) {
      values.existing_documents = text;
      filled.push("existing_documents");
    }
  }

  // 4) Análise anterior → observações internas (rotulada)
  const internalParts: string[] = [];
  if (analysis) {
    const content = (analysis.content_json ?? {}) as Record<string, unknown>;
    const when = (analysis.created_at as string | null)?.slice(0, 10) ?? "";
    internalParts.push(`[Importado da análise prévia${when ? ` (${when})` : ""} — revisar antes de tratar como fato]`);
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

    // represented_party — só preenche se for mapeável ao enum
    const rp = normalizeRepresentedParty(content.represented_party as string | null);
    if (rp) {
      values.represented_party = rp;
      filled.push("represented_party");
    }

    // missing_documents — direto da análise (rotulado é desnecessário, é um campo factual da ficha)
    const missing = Array.isArray(content.missing_documents)
      ? (content.missing_documents as string[]).filter(Boolean)
      : [];
    if (missing.length) {
      const text = trunc(missing.join("\n• ").replace(/^/, "• "), 5000);
      if (text) {
        values.missing_documents = text;
        filled.push("missing_documents");
      }
    }
  }

  if (sources.hadClientNotes) {
    internalParts.push(`Notas do cadastro do cliente: ${trunc(client!.notes as string, 1200)}`);
  }

  if (internalParts.length) {
    const txt = trunc(internalParts.join("\n\n"), 5000);
    if (txt) {
      values.internal_notes = txt;
      filled.push("internal_notes");
    }
  }

  return { values, sources, filledFields: filled };
}
