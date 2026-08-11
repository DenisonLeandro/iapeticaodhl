// =============================================================================
// PR-JORNADA 1 — Motor determinístico de jornada (sem IA, sem I/O).
//
// Lê a jornada narrada (texto do caso ou da minuta) e/ou os campos estruturados
// já normalizados, e apura em código:
//   - horas trabalhadas por dia e por semana;
//   - excedente da 8ª diária e da 44ª semanal;
//   - intervalo DEVIDO pela faixa correta do art. 71 da CLT e o suprimido;
//   - regime aplicável do art. 71 (antes/depois de 11/11/2017).
//
// Consumido por Edge Functions (Deno) e pelo frontend via alias "@shared".
// Não pode importar nada de Deno nem do browser.
// =============================================================================

export const JORNADA_ENGINE_VERSION = "1.0.0";

/** Marco da Lei 13.467/2017 (Reforma Trabalhista). */
export const REFORMA_TRABALHISTA = "2017-11-11";

export type DayGroup = "weekdays" | "saturday" | "sunday_holiday" | "unspecified";

export const DAY_GROUP_LABEL: Record<DayGroup, string> = {
  weekdays: "segunda a sexta",
  saturday: "sábados",
  sunday_holiday: "domingos/feriados",
  unspecified: "dias não especificados",
};

export interface JornadaSegmentInput {
  day_group: DayGroup;
  /** Minutos desde 00:00. */
  start_minutes: number;
  end_minutes: number;
  /** Intervalo efetivamente concedido, em minutos. null = não narrado. */
  interval_minutes: number | null;
  /** Dias por semana cobertos pelo segmento. */
  days_per_week: number;
  /** Trecho literal que originou o segmento (auditabilidade). */
  excerpt: string;
}

export interface JornadaSegmentResult extends JornadaSegmentInput {
  span_minutes: number;
  worked_minutes: number;
  /** Intervalo mínimo devido pelo art. 71 da CLT para esta jornada. */
  required_interval_minutes: number;
  /** max(0, devido − concedido). Zero significa intervalo REGULAR. */
  suppressed_interval_minutes: number;
  /** Excedente da 8ª hora diária, em minutos. */
  daily_overtime_minutes: number;
}

export interface JornadaAnalysis {
  version: string;
  detected: boolean;
  segments: JornadaSegmentResult[];
  weekly_worked_minutes: number;
  /** Excedente da 44ª semanal, em minutos. */
  weekly_overtime_minutes: number;
  /** Soma semanal do intervalo suprimido, em minutos. */
  weekly_suppressed_interval_minutes: number;
  /** true quando nenhum segmento apresenta supressão de intervalo. */
  has_interval_suppression: boolean;
  /** true quando há excedente diário ou semanal. */
  has_overtime: boolean;
  /** Regime do art. 71 aplicável, quando a admissão é conhecida. */
  art71_regime: "pre_reforma" | "pos_reforma" | "misto" | "indefinido";
  /** Observações determinísticas destinadas ao prompt e à auditoria. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Regra do art. 71 da CLT
// ---------------------------------------------------------------------------

/**
 * Intervalo mínimo devido conforme a duração do trabalho no dia:
 *   até 4h .......... nenhum
 *   > 4h e até 6h ... 15 minutos
 *   acima de 6h ..... 60 minutos
 */
export function requiredIntervalMinutes(workedMinutes: number): number {
  if (workedMinutes > 360) return 60;
  if (workedMinutes > 240) return 15;
  return 0;
}

// ---------------------------------------------------------------------------
// Parsing determinístico do texto
// ---------------------------------------------------------------------------

const TIME_RANGE_RE =
  /(\d{1,2})\s*(?:h|:|horas?)\s*(\d{2})?\s*(?:min)?\s*(?:às|as|ate|até|a)\s*(\d{1,2})\s*(?:h|:|horas?)\s*(\d{2})?/gi;

function toMinutes(h: string, m?: string): number | null {
  const hh = parseInt(h, 10);
  const mm = m ? parseInt(m, 10) : 0;
  if (!Number.isFinite(hh) || hh > 24 || mm > 59) return null;
  return hh * 60 + mm;
}

function classifyDayGroup(before: string): DayGroup {
  const b = before.toLowerCase();
  if (/s[áa]bado/.test(b)) return "saturday";
  if (/domingo|feriado/.test(b)) return "sunday_holiday";
  if (/segunda\s*(?:-feira)?\s*(?:a|à|até)\s*sexta|seg\.?\s*a\s*sex|dias?\s+[úu]teis|de\s+segunda/.test(b)) {
    return "weekdays";
  }
  return "unspecified";
}

function defaultDaysPerWeek(group: DayGroup): number {
  if (group === "weekdays") return 5;
  if (group === "saturday") return 1;
  if (group === "sunday_holiday") return 1;
  return 5;
}

/** Extrai o intervalo concedido a partir do trecho que segue o horário. */
export function parseIntervalMinutes(after: string): number | null {
  const a = after.toLowerCase();
  if (/sem\s+(?:qualquer\s+)?intervalo|nenhum\s+intervalo|intervalo\s+n[ãa]o\s+(?:era\s+)?(?:concedido|usufru)/.test(a)) {
    return 0;
  }
  const hAndM = a.match(/(\d{1,2})\s*(?:hora|h)[a-z]*\s*(?:e\s*(\d{1,2})\s*(?:minutos?|min))?[^.]{0,40}?intervalo/);
  if (hAndM) {
    const h = parseInt(hAndM[1], 10);
    const m = hAndM[2] ? parseInt(hAndM[2], 10) : 0;
    if (h <= 6 && m <= 59) return h * 60 + m;
  }
  const onlyMin = a.match(/(\d{1,3})\s*\(?[a-zç ]{0,12}\)?\s*(?:minutos?|min)\b[^.]{0,40}?intervalo/);
  if (onlyMin) {
    const m = parseInt(onlyMin[1], 10);
    if (m <= 240) return m;
  }
  const afterWord = a.match(/intervalo[^.]{0,60}?(\d{1,3})\s*(?:minutos?|min)\b/);
  if (afterWord) {
    const m = parseInt(afterWord[1], 10);
    if (m <= 240) return m;
  }
  const afterWordHour = a.match(/intervalo[^.]{0,60}?(\d{1,2})\s*(?:hora|h)[a-z]*(?:\s*e\s*(\d{1,2})\s*(?:minutos?|min))?/);
  if (afterWordHour) {
    const h = parseInt(afterWordHour[1], 10);
    const m = afterWordHour[2] ? parseInt(afterWordHour[2], 10) : 0;
    if (h <= 6) return h * 60 + m;
  }
  return null;
}

/** Extrai os segmentos de jornada narrados no texto. Determinístico. */
export function parseJornadaSegments(text: string): JornadaSegmentInput[] {
  if (!text) return [];
  const segments: JornadaSegmentInput[] = [];
  const re = new RegExp(TIME_RANGE_RE.source, "gi");
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = re.exec(text)) !== null) {
    const start = toMinutes(m[1], m[2]);
    const end = toMinutes(m[3], m[4]);
    if (start == null || end == null) continue;
    let span = end - start;
    if (span < 0) span += 24 * 60;
    if (span < 60 || span > 20 * 60) continue;

    const before = text.slice(Math.max(0, m.index - 200), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 260);
    const group = classifyDayGroup(before);
    const key = `${group}:${start}:${end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    segments.push({
      day_group: group,
      start_minutes: start,
      end_minutes: end,
      interval_minutes: parseIntervalMinutes(after),
      days_per_week: defaultDaysPerWeek(group),
      excerpt: text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 120).replace(/\s+/g, " ").trim(),
    });
  }

  // Um único segmento "unspecified" convive mal com dias úteis + sábado; se
  // houver segmento de sábado e um genérico, o genérico vira dias úteis.
  if (segments.some((s) => s.day_group === "saturday")) {
    for (const s of segments) {
      if (s.day_group === "unspecified") {
        s.day_group = "weekdays";
        s.days_per_week = 5;
      }
    }
  }
  return segments;
}

function art71Regime(admissionDate?: string | null, terminationDate?: string | null): JornadaAnalysis["art71_regime"] {
  if (!admissionDate) return "indefinido";
  const adm = admissionDate.slice(0, 10);
  if (adm >= REFORMA_TRABALHISTA) return "pos_reforma";
  const end = (terminationDate ?? "").slice(0, 10);
  if (end && end < REFORMA_TRABALHISTA) return "pre_reforma";
  return "misto";
}

export function analyzeJornadaSegments(
  input: JornadaSegmentInput[],
  opts?: { admission_date?: string | null; termination_date?: string | null },
): JornadaAnalysis {
  const segments: JornadaSegmentResult[] = input.map((s) => {
    let span = s.end_minutes - s.start_minutes;
    if (span < 0) span += 24 * 60;
    const taken = s.interval_minutes ?? 0;
    const worked = Math.max(0, span - taken);
    const required = requiredIntervalMinutes(worked);
    const suppressed = s.interval_minutes == null ? 0 : Math.max(0, required - taken);
    return {
      ...s,
      span_minutes: span,
      worked_minutes: worked,
      required_interval_minutes: required,
      suppressed_interval_minutes: suppressed,
      daily_overtime_minutes: Math.max(0, worked - 480),
    };
  });

  const weeklyWorked = segments.reduce((a, s) => a + s.worked_minutes * s.days_per_week, 0);
  const weeklySuppressed = segments.reduce((a, s) => a + s.suppressed_interval_minutes * s.days_per_week, 0);
  const weeklyOvertime = Math.max(0, weeklyWorked - 44 * 60);
  const hasDaily = segments.some((s) => s.daily_overtime_minutes > 0);

  const notes: string[] = [];
  for (const s of segments) {
    const label = DAY_GROUP_LABEL[s.day_group];
    const parts = [
      `${label}: jornada de ${fmtHm(s.span_minutes)} (${fmtClock(s.start_minutes)} às ${fmtClock(s.end_minutes)})`,
      s.interval_minutes == null
        ? "intervalo não narrado"
        : `intervalo concedido de ${fmtHm(s.interval_minutes)}`,
      `intervalo devido pelo art. 71 da CLT: ${s.required_interval_minutes === 0 ? "nenhum" : fmtHm(s.required_interval_minutes)}`,
      `tempo efetivamente trabalhado: ${fmtHm(s.worked_minutes)}`,
    ];
    if (s.interval_minutes != null) {
      parts.push(
        s.suppressed_interval_minutes > 0
          ? `SUPRESSÃO de ${fmtHm(s.suppressed_interval_minutes)} de intervalo`
          : "intervalo REGULAR — NÃO há supressão, é PROIBIDO formular pedido de intervalo intrajornada para estes dias",
      );
    }
    parts.push(
      s.daily_overtime_minutes > 0
        ? `excedente da 8ª diária: ${fmtHm(s.daily_overtime_minutes)} por dia`
        : "sem excedente da 8ª diária",
    );
    notes.push(parts.join("; ") + ".");
  }
  if (segments.length) {
    notes.push(
      `Total semanal apurado: ${fmtHm(weeklyWorked)}. ${
        weeklyOvertime > 0
          ? `Excedente da 44ª semanal: ${fmtHm(weeklyOvertime)} por semana.`
          : "Sem excedente da 44ª semanal."
      }`,
    );
  }

  const regime = art71Regime(opts?.admission_date, opts?.termination_date);
  if (regime === "pos_reforma") {
    notes.push(
      "Contrato integralmente posterior a 11/11/2017: aplicar apenas o art. 71, § 4º, da CLT — pagamento do período suprimido com adicional de 50% e natureza indenizatória.",
    );
  } else if (regime === "pre_reforma") {
    notes.push(
      "Contrato integralmente anterior a 11/11/2017: aplicar a Súmula 437 do TST — pagamento integral do intervalo, com natureza salarial e reflexos.",
    );
  } else if (regime === "misto") {
    notes.push(
      "Contrato a cavaleiro da Reforma: segmentar o pedido de intervalo — Súmula 437 do TST até 10/11/2017 e art. 71, § 4º, da CLT a partir de 11/11/2017.",
    );
  }

  return {
    version: JORNADA_ENGINE_VERSION,
    detected: segments.length > 0,
    segments,
    weekly_worked_minutes: weeklyWorked,
    weekly_overtime_minutes: weeklyOvertime,
    weekly_suppressed_interval_minutes: weeklySuppressed,
    has_interval_suppression: weeklySuppressed > 0,
    has_overtime: hasDaily || weeklyOvertime > 0,
    art71_regime: regime,
    notes,
  };
}

/** Atalho: texto → análise. */
export function analyzeJornadaFromText(
  text: string,
  opts?: { admission_date?: string | null; termination_date?: string | null },
): JornadaAnalysis {
  return analyzeJornadaSegments(parseJornadaSegments(text ?? ""), opts);
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function fmtHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function fmtClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

/** Bloco de FATOS APURADOS de jornada para o prompt. Vazio se nada detectado. */
export function renderJornadaFactsForPrompt(a: JornadaAnalysis): string {
  if (!a.detected) return "";
  return `# JORNADA — FATOS APURADOS PELO SISTEMA (cálculo determinístico, NÃO recalcular, NÃO contrariar)

${a.notes.map((n) => `- ${n}`).join("\n")}

REGRAS DURAS DE JORNADA:
- Estes números são fatos fechados. É PROIBIDO afirmar duração de jornada, intervalo devido ou excedente diferente do apurado acima.
- O art. 71 da CLT exige 1 hora de intervalo apenas para jornada SUPERIOR a 6 horas; entre 4 e 6 horas o mínimo é de 15 minutos; até 4 horas não há intervalo obrigatório. NUNCA escrever que jornada "superior a 4 horas" exige 1 hora de intervalo.
- Quando o intervalo estiver REGULAR em um grupo de dias, NÃO formular pedido de intervalo intrajornada para esses dias — nem no mérito, nem no rol final.
- ${a.has_overtime
    ? "Há excedente apurado: o capítulo de horas extras deve narrar a jornada dia a dia, apontar o excedente da 8ª diária e/ou da 44ª semanal e pedir o pagamento com adicional e reflexos — sem depender do intervalo para existir."
    : "Não há excedente apurado a partir da jornada narrada: só formular pedido de horas extras se houver outro fundamento fático expresso (prorrogações, labor em folgas ou supressão de intervalo)."}
- Não pedir adicional de 100% por feriado, adicional noturno ou labor em domingos se não houver fato narrado correspondente.`;
}
