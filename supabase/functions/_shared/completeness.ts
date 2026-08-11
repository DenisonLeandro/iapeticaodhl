// =============================================================================
// PR-COMPLETUDE 1 — Auditoria determinística de completude (sem IA).
//
// FONTE ÚNICA de padrões de placeholder e de derivação de status de cálculo.
// Este arquivo é consumido por:
//   - Edge Functions (Deno): import "../_shared/completeness.ts"
//   - Frontend (Vite/Vitest): import "@shared/completeness.ts" (alias)
// Não pode importar nada de Deno nem do browser.
// =============================================================================

import { analyzeJornadaFromText, type JornadaAnalysis, fmtHm } from "./jornada-engine.ts";

export const COMPLETENESS_AUDIT_VERSION = "1.1.0";

// ---------------------------------------------------------------------------
// 1. Placeholders
// ---------------------------------------------------------------------------

export type PlaceholderCategory =
  | "legal_review"
  | "qualification"
  | "instruction"
  | "calculation"
  | "other";

export interface PlaceholderOccurrence {
  marker: string;
  category: PlaceholderCategory;
  section_key: string;
  excerpt: string;
  occurrence_index: number; // 1-based, por marcador normalizado
  index: number;            // posição absoluta no texto
  length: number;
}

/** Marcadores entre colchetes: [CALCULAR VALOR], [INFORMAR VARA], etc. */
export const PLACEHOLDER_BRACKET_REGEX = /\[[^\]\n]{2,400}\]/g;

/**
 * Placeholders sem colchetes usados em modelos de escritório
 * (qualificação/fecho). Mantidos como fonte única, sem duplicação.
 */
export const PLACEHOLDER_BARE_PATTERNS: RegExp[] = [
  /\bNOME\s+D[OAE]\s+ADVOGAD[OA]\b/gi,
  /\bNOME\s+D[OA]\s+(?:PARTE|CLIENTE|AUTOR[A]?|R[EÉ]U)\b/gi,
  /\bN[ÚU]MERO\s+D[AO]\s+(?:OAB|PROCESSO|CPF|CNPJ)\b/gi,
  /\bOAB\s*n?[º°]?\s*(?:X{2,}|_{3,})/gi,
  /\bXX+\.?X*\b/g,
  /_{4,}/g,
];

/** Marcadores que representam valor monetário/quantitativo a calcular. */
const CALCULATION_TOKENS = /CALCULAR|VALOR A APURAR|A LIQUIDAR|LIQUIDA[ÇC][ÃA]O|VALOR ESTIMADO A/i;
/** Marcadores de qualificação/identificação de partes, advogado, juízo. */
const QUALIFICATION_TOKENS =
  /NOME|QUALIFICA|ENDERE[ÇC]O|CPF|CNPJ|RG\b|OAB|VARA|COMARCA|JU[ÍI]ZO|N[ÚU]MERO D[OA] PROCESSO|ESTADO CIVIL|PROFISS[ÃA]O|NACIONALIDADE|X{2,}|_{3,}/i;
/** Marcadores que pedem pesquisa/atualização jurídica ao advogado. */
const LEGAL_REVIEW_TOKENS =
  /REVISAR|REVER\b|ATUALIZAR|CONFERIR JURISPRUD|VERIFICAR ENTENDIMENTO|JURISPRUD[ÊE]NCIA A INSERIR|CONFIRMAR TESE|CHECAR S[ÚU]MULA/i;
/** Marcadores que pedem juntada/produção de prova (pendência do escritório). */
const INSTRUCTION_TOKENS =
  /ANEXAR|JUNTAR|DOCUMENTO A|COMPROVANTE|APRESENTAR C[ÓO]PIA|PROTOCOLAR C[ÓO]PIA|INSTRUIR COM/i;

export function classifyPlaceholder(marker: string): PlaceholderCategory {
  const u = marker.toUpperCase();
  if (LEGAL_REVIEW_TOKENS.test(u)) return "legal_review";
  if (INSTRUCTION_TOKENS.test(u)) return "instruction";
  if (CALCULATION_TOKENS.test(u)) return "calculation";
  if (QUALIFICATION_TOKENS.test(u)) return "qualification";
  return "other";
}

/** Numeração estrutural romana usada nos pedidos: [I], [II], [XIV], [iii]. */
const ROMAN_NUMERAL_ONLY = /^[IVXLCDM]{1,7}$/i;

/** Falsos positivos comuns: notas de rodapé [1], referências [n], [sic], [II]. */
function isIgnorableBracket(raw: string): boolean {
  const inner = raw.slice(1, -1).trim();
  if (!inner) return true;
  if (/^\d{1,3}$/.test(inner)) return true;
  if (/^sic\.?$/i.test(inner)) return true;
  if (/^\.\.\.$/.test(inner)) return true;
  // Numeração estrutural de pedidos não é pendência.
  if (ROMAN_NUMERAL_ONLY.test(inner.replace(/[.)\-\s]+$/, ""))) return true;
  return false;
}


const SECTION_RULES: Array<{ key: string; re: RegExp }> = [
  { key: "valor_da_causa", re: /VALOR\s+D[AE]\s+CAUSA/i },
  { key: "pedidos", re: /\bPEDIDOS?\b|REQUERIMENTOS?|DOS?\s+REQUERIMENTOS?/i },
  { key: "provas", re: /\bPROVAS?\b/i },
  { key: "fundamentos", re: /DO\s+DIREITO|FUNDAMENTA|M[ÉE]RITO|PRELIMINAR/i },
  { key: "fatos", re: /DOS?\s+FATOS|BREVE\s+RELATO|S[ÍI]NTESE\s+F[ÁA]TICA/i },
  { key: "qualificacao", re: /EXCELENT[ÍI]SSIM|MM\.?\s*JU[ÍI]Z|VARA\s+DO\s+TRABALHO|RECLAMANTE\s*:|QUALIFICA/i },
];

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return false;
  const upperRatio = letters.split("").filter((c) => c === c.toUpperCase()).length / letters.length;
  return upperRatio > 0.7 || /^\s*\d+(\.\d+)*[\.\)\s-]/.test(t);
}

export function sectionKeyAt(text: string, index: number): string {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!looksLikeHeading(line)) continue;
    for (const r of SECTION_RULES) if (r.re.test(line)) return r.key;
  }
  for (const r of SECTION_RULES) if (r.re.test(before.slice(-2000))) return r.key;
  return "outros";
}

function excerptAt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/** Detecta TODAS as ocorrências, sem consolidar repetições. */
export function detectPlaceholders(text: string): PlaceholderOccurrence[] {
  if (!text) return [];
  const raw: Array<{ index: number; length: number; marker: string }> = [];

  const reBracket = new RegExp(PLACEHOLDER_BRACKET_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = reBracket.exec(text)) !== null) {
    if (isIgnorableBracket(m[0])) continue;
    raw.push({ index: m.index, length: m[0].length, marker: m[0] });
  }

  for (const p of PLACEHOLDER_BARE_PATTERNS) {
    const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlap = raw.some((f) => !(end <= f.index || start >= f.index + f.length));
      if (overlap) continue;
      raw.push({ index: start, length: m[0].length, marker: m[0] });
    }
  }

  raw.sort((a, b) => a.index - b.index);

  const seen = new Map<string, number>();
  return raw.map((f) => {
    const key = f.marker.toUpperCase().replace(/\s+/g, " ").trim();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return {
      marker: f.marker,
      category: classifyPlaceholder(f.marker),
      section_key: sectionKeyAt(text, f.index),
      excerpt: excerptAt(text, f.index, f.length),
      occurrence_index: n,
      index: f.index,
      length: f.length,
    };
  });
}

export interface PlaceholderSummary {
  placeholder_count: number;
  calculation_placeholder_count: number;
  qualification_placeholder_count: number;
  legal_review_placeholder_count: number;
  instruction_placeholder_count: number;
  other_placeholder_count: number;
}

export const PLACEHOLDER_CATEGORY_LABELS: Record<PlaceholderCategory, string> = {
  legal_review: "Revisão jurídica",
  qualification: "Qualificação",
  instruction: "Instrução / documentos",
  calculation: "Cálculo",
  other: "Outros",
};

export function summarizePlaceholders(list: PlaceholderOccurrence[]): PlaceholderSummary {
  const s: PlaceholderSummary = {
    placeholder_count: list.length,
    calculation_placeholder_count: 0,
    qualification_placeholder_count: 0,
    legal_review_placeholder_count: 0,
    instruction_placeholder_count: 0,
    other_placeholder_count: 0,
  };
  for (const p of list) {
    if (p.category === "calculation") s.calculation_placeholder_count += 1;
    else if (p.category === "qualification") s.qualification_placeholder_count += 1;
    else if (p.category === "legal_review") s.legal_review_placeholder_count += 1;
    else if (p.category === "instruction") s.instruction_placeholder_count += 1;
    else s.other_placeholder_count += 1;
  }
  return s;
}


// ---------------------------------------------------------------------------
// 2. Status de cálculo (DERIVADO em runtime — nunca persistido)
// ---------------------------------------------------------------------------

export type CalculationStatus = "calculated" | "estimated" | "manual" | "pending";

export interface CalcItemLike {
  request_label?: string | null;
  estimated_value?: number | null;
  confidence?: string | null;
  missing_fields?: string[] | null;
  assumptions?: Record<string, unknown> | null;
  manual_value?: number | null;
  manual_value_confirmed?: boolean | null;
  system_value_confirmed?: boolean | null;
}

export function isDraftInjectableItem(item: CalcItemLike): boolean {
  const a = (item.assumptions ?? {}) as Record<string, unknown>;
  return a._draft_injectable === true && item.estimated_value != null;
}

/**
 * Status determinístico. Ordem de precedência:
 *   manual (advogado confirmou) > calculated (motor confiável ou confirmado)
 *   > estimated (há base matemática, falta confirmação) > pending.
 */
export function deriveCalculationStatus(item: CalcItemLike): CalculationStatus {
  if (item.manual_value != null && item.manual_value_confirmed === true) return "manual";
  if (item.estimated_value == null) return "pending";
  if (isDraftInjectableItem(item) || item.system_value_confirmed === true) return "calculated";
  return "estimated";
}

/** Valor efetivamente utilizável do item (respeita o valor manual confirmado). */
export function effectiveItemValue(item: CalcItemLike): number | null {
  const status = deriveCalculationStatus(item);
  if (status === "pending") return null;
  if (status === "manual") return item.manual_value ?? null;
  return item.estimated_value ?? null;
}

export const CALCULATION_STATUS_LABEL: Record<CalculationStatus, string> = {
  calculated: "Calculado pelo sistema",
  estimated: "Estimado — aguardando confirmação",
  manual: "Valor definido pelo advogado",
  pending: "Pendente — faltam dados",
};

// ---------------------------------------------------------------------------
// 3. Valor da causa
// ---------------------------------------------------------------------------

export type CaseValueStatus = "complete" | "partial" | "pending" | "manual";

export interface CaseValueResult {
  claim_value_sum: number;
  case_value_status: CaseValueStatus;
  included_claims: Array<{ label: string; status: CalculationStatus; value: number }>;
  pending_claims: Array<{ label: string; missing_fields: string[] }>;
}

export function computeCaseValue(
  items: CalcItemLike[],
  opts?: { lawyerConfirmedCaseValue?: boolean },
): CaseValueResult {
  const included: CaseValueResult["included_claims"] = [];
  const pending: CaseValueResult["pending_claims"] = [];

  for (const it of items) {
    const status = deriveCalculationStatus(it);
    const value = effectiveItemValue(it);
    const label = it.request_label ?? "(sem rótulo)";
    if (status === "pending" || value == null) {
      pending.push({ label, missing_fields: it.missing_fields ?? [] });
    } else {
      included.push({ label, status, value });
    }
  }

  const sum = Math.round(included.reduce((a, i) => a + i.value, 0) * 100) / 100;

  let status: CaseValueStatus;
  if (opts?.lawyerConfirmedCaseValue) status = "manual";
  else if (included.length === 0) status = "pending";
  else if (pending.length > 0) status = "partial";
  else status = "complete";

  return { claim_value_sum: sum, case_value_status: status, included_claims: included, pending_claims: pending };
}

// ---------------------------------------------------------------------------
// 3.1 PR-JORNADA 1 — Guarda de coerência fato ↔ pedido (determinística)
// ---------------------------------------------------------------------------

export type IncoherenceCode =
  | "interval_request_without_suppression"
  | "interval_threshold_misstated"
  | "holiday_request_without_fact"
  | "night_shift_request_without_fact"
  | "sumula_340_vs_integration"
  | "multiple_salary_bases";

export type IncoherenceSeverity = "high" | "medium";

export interface IncoherenceFinding {
  code: IncoherenceCode;
  label: string;
  detail: string;
  severity: IncoherenceSeverity;
  excerpt?: string;
}

export const INCOHERENCE_LABELS: Record<IncoherenceCode, string> = {
  interval_request_without_suppression: "Pedido de intervalo sem supressão apurada",
  interval_threshold_misstated: "Faixa do art. 71 da CLT enunciada incorretamente",
  holiday_request_without_fact: "Adicional de feriado sem fato narrado",
  night_shift_request_without_fact: "Adicional noturno sem fato narrado",
  sumula_340_vs_integration: "Súmula 340 do TST x integração da parte variável",
  multiple_salary_bases: "Mais de uma base remuneratória na mesma peça",
};

function snippet(text: string, index: number, len = 140): string {
  const start = Math.max(0, index - 40);
  return text.slice(start, start + len).replace(/\s+/g, " ").trim();
}

/** Bases remuneratórias distintas citadas como salário/remuneração do autor. */
export function extractSalaryBases(text: string): number[] {
  const re =
    /(?:remunera[çc][ãa]o|sal[áa]rio)[^.\n]{0,80}?R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi;
  const found = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(v) && v >= 500 && v <= 200_000) found.add(Math.round(v * 100) / 100);
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Detecta incoerências internas entre os FATOS narrados e os PEDIDOS
 * formulados. Sem IA; usa o motor de jornada como fonte dos fatos apurados.
 */
export function detectIncoherences(
  content: string,
  opts?: { jornada?: JornadaAnalysis | null },
): IncoherenceFinding[] {
  const text = content ?? "";
  if (!text.trim()) return [];
  const out: IncoherenceFinding[] = [];
  const jornada = opts?.jornada ?? analyzeJornadaFromText(text);

  // 1) Pedido de intervalo intrajornada sem supressão apurada.
  const intervalRequest =
    /intervalo\s+intrajornada[^.]{0,200}?(suprimid|supress|indeniza|acrescid[oa]\s+de\s+50)/i.exec(text) ??
    /(suprimid|supress)[^.]{0,120}?intervalo/i.exec(text);
  if (intervalRequest && jornada.detected && !jornada.has_interval_suppression) {
    out.push({
      code: "interval_request_without_suppression",
      label: INCOHERENCE_LABELS.interval_request_without_suppression,
      severity: "high",
      detail:
        "A jornada narrada não apresenta supressão de intervalo pelo art. 71 da CLT — o intervalo concedido atende ao mínimo devido para a duração apurada.",
      excerpt: snippet(text, intervalRequest.index),
    });
  }

  // 2) Faixa do art. 71 enunciada de forma incorreta ("superior a 4 horas → 1 hora").
  const threshold =
    /superior\s+a\s+(?:4|quatro)\s+horas[^.]{0,160}?(?:1\s*\(?uma\)?\s*hora|60\s*minutos|uma\s+hora)/i.exec(text);
  if (threshold) {
    out.push({
      code: "interval_threshold_misstated",
      label: INCOHERENCE_LABELS.interval_threshold_misstated,
      severity: "high",
      detail:
        "O art. 71 da CLT exige 1 hora de intervalo apenas para jornada superior a 6 horas; entre 4 e 6 horas o mínimo é de 15 minutos.",
      excerpt: snippet(text, threshold.index),
    });
  }

  // 3) Adicional de 100% por feriado sem fato de labor em feriado.
  const holidayRequest = /feriado[s]?[^.]{0,120}?100\s*%|100\s*%[^.]{0,120}?feriado/i.exec(text);
  const holidayFact =
    /(labor(?:ava|ou|)|trabalh(?:ava|ou|o)|escala|convocad[oa]|plant[ãa]o)[^.]{0,120}?feriado/i.test(text);
  if (holidayRequest && !holidayFact) {
    out.push({
      code: "holiday_request_without_fact",
      label: INCOHERENCE_LABELS.holiday_request_without_fact,
      severity: "high",
      detail:
        "Há pedido de adicional de 100% por feriados, mas nenhum fato narrado de labor em feriado.",
      excerpt: snippet(text, holidayRequest.index),
    });
  }

  // 4) Adicional noturno sem jornada que avance das 22h.
  const nightRequest = /adicional\s+noturno|hora\s+noturna\s+reduzida/i.exec(text);
  const nightFact =
    /(22|vinte\s+e\s+duas)\s*(?:h|horas|:00)/i.test(text) ||
    jornada.segments.some((s) => s.end_minutes > 22 * 60 || s.end_minutes < s.start_minutes);
  if (nightRequest && !nightFact) {
    out.push({
      code: "night_shift_request_without_fact",
      label: INCOHERENCE_LABELS.night_shift_request_without_fact,
      severity: "high",
      detail: "Há pedido de adicional noturno sem jornada narrada em horário noturno (após as 22h).",
      excerpt: snippet(text, nightRequest.index),
    });
  }

  // 5) Súmula 340 do TST convivendo com integração da variável sem ressalva.
  const s340 = /s[úu]mula\s*(?:n[º°]?\s*)?340/i.exec(text);
  const integration = /integra[çc][ãa]o[^.]{0,120}?(vari[áa]vel|comiss)|m[ée]dia[^.]{0,60}?(vari[áa]vel|comiss)/i.test(text);
  const reconciled = /sem\s+preju[íi]zo[^.]{0,80}?340|compatibiliz|apenas\s+o\s+adicional\s+sobre\s+a\s+parte\s+vari[áa]vel/i.test(text);
  if (s340 && integration && !reconciled) {
    out.push({
      code: "sumula_340_vs_integration",
      label: INCOHERENCE_LABELS.sumula_340_vs_integration,
      severity: "medium",
      detail:
        "A peça manda observar a Súmula 340 do TST (apenas o adicional sobre a parte variável) e, em outro tópico, pede a integração da média variável na base das horas extras. Explicitar a compatibilização.",
      excerpt: snippet(text, s340.index),
    });
  }

  // 6) Mais de uma base remuneratória.
  const bases = extractSalaryBases(text);
  if (bases.length > 1) {
    out.push({
      code: "multiple_salary_bases",
      label: INCOHERENCE_LABELS.multiple_salary_bases,
      severity: "high",
      detail: `A peça cita bases remuneratórias distintas: ${bases
        .map((b) => `R$ ${b.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)
        .join(" e ")}. Unificar a base antes do protocolo.`,
    });
  }

  return out;
}

/** Resumo textual dos fatos de jornada, para exibição na UI. */
export function summarizeJornada(a: JornadaAnalysis): string | null {
  if (!a.detected) return null;
  return `Semana apurada: ${fmtHm(a.weekly_worked_minutes)}${
    a.weekly_overtime_minutes > 0 ? ` · excedente da 44ª: ${fmtHm(a.weekly_overtime_minutes)}` : " · sem excedente semanal"
  }${a.has_interval_suppression ? ` · intervalo suprimido: ${fmtHm(a.weekly_suppressed_interval_minutes)}/semana` : " · intervalo regular"}`;
}


// ---------------------------------------------------------------------------
// 4. Auditoria de completude
// ---------------------------------------------------------------------------

export type ProtocolReadiness = "draft_incomplete" | "ready_for_legal_review" | "lawyer_review_confirmed";

export const PROTOCOL_READINESS_LABEL: Record<ProtocolReadiness, string> = {
  draft_incomplete: "Rascunho incompleto",
  ready_for_legal_review: "Completo para revisão jurídica",
  lawyer_review_confirmed: "Marcado pelo advogado como apto para protocolo",
};

export interface CompletenessAudit extends PlaceholderSummary {
  version: string;
  audited_at: string;
  content_hash: string;
  /** Assinatura do estado material (texto + valores + valor da causa + versão). */
  state_hash: string;
  placeholders: PlaceholderOccurrence[];
  claims: Array<{
    label: string;
    status: CalculationStatus;
    value: number | null;
    missing_fields: string[];
  }>;
  claim_value_sum: number;
  case_value_status: CaseValueStatus;
  case_value_pending_claims: Array<{ label: string; missing_fields: string[] }>;
  /** PR-JORNADA 1 — incoerências internas entre fatos e pedidos. */
  incoherences: IncoherenceFinding[];
  incoherence_count: number;
  high_incoherence_count: number;
  jornada_summary: string | null;
  protocol_readiness: ProtocolReadiness;
}

/** Hash estável e barato (FNV-1a) — usado para invalidar confirmações. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16)}:${text.length}`;
}

/**
 * Assinatura do ESTADO MATERIAL da minuta: conteúdo + valores de cada pedido
 * (sistema, manual e respectivas confirmações) + somatório do valor da causa +
 * versão da auditoria. Qualquer alteração material invalida a revisão humana.
 */
export function reviewedStateHash(content: string, items: CalcItemLike[]): string {
  const caseValue = computeCaseValue(items ?? []);
  const parts = (items ?? [])
    .map((it) =>
      [
        it.request_label ?? "",
        it.estimated_value ?? "",
        it.manual_value ?? "",
        it.manual_value_confirmed === true ? 1 : 0,
        it.system_value_confirmed === true ? 1 : 0,
        deriveCalculationStatus(it),
      ].join("|"),
    )
    .sort()
    .join("\n");
  return contentHash(
    [
      COMPLETENESS_AUDIT_VERSION,
      content ?? "",
      parts,
      caseValue.claim_value_sum.toFixed(2),
      caseValue.case_value_status,
    ].join("\u0001"),
  );
}

export function runCompletenessAudit(input: {
  content: string;
  items?: CalcItemLike[];
  lawyerConfirmedCaseValue?: boolean;
  /** Confirmação explícita do advogado + hash do estado confirmado. */
  lawyerReviewConfirmedHash?: string | null;
}): CompletenessAudit {
  const content = input.content ?? "";
  const placeholders = detectPlaceholders(content);
  const summary = summarizePlaceholders(placeholders);
  const items = input.items ?? [];
  const caseValue = computeCaseValue(items, { lawyerConfirmedCaseValue: input.lawyerConfirmedCaseValue });
  const hash = contentHash(content);
  const stateHash = reviewedStateHash(content, items);

  const clean =
    summary.placeholder_count === 0 &&
    (caseValue.case_value_status === "complete" || caseValue.case_value_status === "manual");

  let readiness: ProtocolReadiness = clean ? "ready_for_legal_review" : "draft_incomplete";
  // Aceita o hash de estado (atual) e, por compatibilidade, o hash textual legado.
  if (
    clean &&
    input.lawyerReviewConfirmedHash &&
    (input.lawyerReviewConfirmedHash === stateHash || input.lawyerReviewConfirmedHash === hash)
  ) {
    readiness = "lawyer_review_confirmed";
  }

  return {
    version: COMPLETENESS_AUDIT_VERSION,
    audited_at: new Date().toISOString(),
    content_hash: hash,
    state_hash: stateHash,
    ...summary,
    placeholders,
    claims: items.map((it) => ({
      label: it.request_label ?? "(sem rótulo)",
      status: deriveCalculationStatus(it),
      value: effectiveItemValue(it),
      missing_fields: it.missing_fields ?? [],
    })),
    claim_value_sum: caseValue.claim_value_sum,
    case_value_status: caseValue.case_value_status,
    case_value_pending_claims: caseValue.pending_claims,
    protocol_readiness: readiness,
  };
}

