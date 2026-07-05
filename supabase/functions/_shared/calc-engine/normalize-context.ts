// =============================================================================
// PR-4.4B.2A — Normalização de contexto para o calc-engine (determinístico).
// =============================================================================

export type Confidence = "high" | "medium" | "low";

export interface WorkSchedule {
  start_time: string | null;
  end_time: string | null;
  interval_minutes: number | null;
  days_per_week: number | null;
  days_off_per_month: number | null;
}

export interface VariablePay {
  km_rate: number | null;
  average_km_per_month: number | null;
  monthly_variable_estimate: number | null;
}

export interface CalculationContext {
  monthly_salary: number | null;
  admission_date: string | null;
  termination_date: string | null;
  termination_day_count: number | null;
  role: string | null;
  work_schedule: WorkSchedule;
  variable_pay: VariablePay;
  confidence_by_field: Record<string, Confidence>;
  sources_by_field: Record<string, string>;
}

type SourceKey = "document" | "intake" | "analysis" | "draft" | "instructions" | "client" | "derived";

const SOURCE_CONFIDENCE: Record<SourceKey, Confidence> = {
  document: "high", intake: "medium", analysis: "medium",
  draft: "medium", instructions: "medium", client: "low", derived: "medium",
};
const SOURCE_LABEL: Record<SourceKey, string> = {
  document: "documento processado", intake: "ficha inteligente", analysis: "análise inicial",
  draft: "minuta gerada", instructions: "instruções do advogado", client: "relato do cliente", derived: "derivado",
};

interface Attempt<T> { value: T | null | undefined; source: SourceKey; }
function firstOf<T>(...tries: Array<Attempt<T>>): { value: T; source: SourceKey } | null {
  for (const t of tries) {
    const v = t.value;
    if (v !== null && v !== undefined && !(typeof v === "number" && isNaN(v))) {
      return { value: v as T, source: t.source };
    }
  }
  return null;
}

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, "março": 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export function parseMoneyBrl(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return isFinite(s) && s > 0 ? s : null;
  const m = String(s).match(/R?\$?\s*([\d\.]+,\d{2}|\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)/);
  if (!m) return null;
  let raw = m[1];
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(raw);
  return isFinite(n) && n > 0 ? n : null;
}

export function parseDatePtBr(s: string | null | undefined): string | null {
  if (!s) return null;
  const txt = String(s).trim();
  const m1 = txt.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m1) {
    const d = parseInt(m1[1], 10); const mo = parseInt(m1[2], 10); let y = parseInt(m1[3], 10);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y.toString().padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const m2 = txt.match(/\b(\d{1,2})\s+de\s+([a-zçãé]+)\s+de\s+(\d{2,4})\b/i);
  if (m2) {
    const d = parseInt(m2[1], 10); const mo = MONTHS_PT[m2[2].toLowerCase()]; let y = parseInt(m2[3], 10);
    if (y < 100) y += 2000;
    if (mo && d >= 1 && d <= 31) {
      return `${y.toString().padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const m3 = txt.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
  return null;
}

function parseTime(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/\b(\d{1,2})[h:](\d{0,2})?\b/i);
  if (!m) return null;
  const h = Math.min(23, parseInt(m[1], 10));
  const mi = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function extractSalary(text: string): number | null {
  const patterns = [
    /sal[aá]rio\s+(?:base|mensal|[uú]ltimo|fixo)?\s*(?:de|era|foi|:)?\s*R?\$?\s*([\d\.,]+)/i,
    /remunera[çc][aã]o\s+(?:fixa|mensal)?\s*(?:de|:)?\s*R?\$?\s*([\d\.,]+)/i,
    /R\$\s*([\d\.,]+)\s*(?:mensais|por m[eê]s|\/m[eê]s)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) { const v = parseMoneyBrl(m[1]); if (v && v >= 500 && v < 200000) return v; }
  }
  return null;
}

function extractAdmission(text: string): string | null {
  const re = /(?:admitido|admiss[aã]o|contratado|contrata[çc][aã]o|in[ií]cio\s+do\s+contrato)[^\n]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+de\s+[a-zçãé]+\s+de\s+\d{2,4}|\d{4}-\d{2}-\d{2})/i;
  const m = text.match(re);
  return m ? parseDatePtBr(m[1]) : null;
}
function extractTermination(text: string): string | null {
  const re = /(?:rescis[aã]o|desligado|desligamento|dispensa|pedido\s+de\s+demiss[aã]o|resili[çc][aã]o|t[eé]rmino\s+do\s+contrato|[uú]ltimo\s+dia\s+(?:trabalhado|de\s+trabalho)?|sa[ií]da)[^\n]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+de\s+[a-zçãé]+\s+de\s+\d{2,4}|\d{4}-\d{2}-\d{2})/i;
  const m = text.match(re);
  return m ? parseDatePtBr(m[1]) : null;
}

function extractSchedule(text: string): Partial<WorkSchedule> {
  const out: Partial<WorkSchedule> = {};
  const j = text.match(/(?:das?\s+)?(\d{1,2}[h:]\d{0,2})\s+(?:[àa]s?|at[eé])\s+(\d{1,2}[h:]\d{0,2})/i);
  if (j) { out.start_time = parseTime(j[1]); out.end_time = parseTime(j[2]); }
  const i = text.match(/intervalo\s+(?:de\s+)?(?:apenas\s+)?(\d{1,3})\s*(?:min|minutos)/i);
  if (i) out.interval_minutes = parseInt(i[1], 10);
  const f = text.match(/(\d{1,2})\s+folgas?\s+(?:por|no|ao|\/)\s*m[eê]s/i);
  if (f) out.days_off_per_month = parseInt(f[1], 10);
  const dpw = text.match(/(\d)\s+dias?\s+(?:por|na|\/)\s*semana/i);
  if (dpw) out.days_per_week = parseInt(dpw[1], 10);
  return out;
}

function extractVariable(text: string): Partial<VariablePay> {
  const out: Partial<VariablePay> = {};
  const rate = text.match(/R\$\s*([\d,\.]+)\s*(?:por|\/)\s*(?:km|quil[oô]metro)/i);
  if (rate) out.km_rate = parseMoneyBrl(rate[1]);
  const km = text.match(/(?:m[eé]dia\s+de\s+)?([\d\.]{2,})\s*km\s*(?:\/|por)\s*m[eê]s/i);
  if (km) {
    const n = parseInt(km[1].replace(/\./g, ""), 10);
    if (isFinite(n) && n > 0) out.average_km_per_month = n;
  }
  return out;
}

interface BuildInput {
  caseData?: Record<string, unknown> | null;
  client?: Record<string, unknown> | null;
  intake?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
  documents?: Array<Record<string, unknown>> | null;
  chunks?: Array<Record<string, unknown>> | null;
  additionalInstructions?: string | null;
}

function collectText(input: BuildInput): Array<{ text: string; source: SourceKey }> {
  const arr: Array<{ text: string; source: SourceKey }> = [];
  const docTxt: string[] = [];
  for (const d of input.documents ?? []) {
    if (typeof d?.analysis_summary === "string") docTxt.push(d.analysis_summary as string);
  }
  for (const c of input.chunks ?? []) {
    if (typeof c?.content === "string") docTxt.push(c.content as string);
  }
  if (docTxt.length) arr.push({ text: docTxt.join("\n"), source: "document" });
  if (input.intake) {
    const it = input.intake;
    const t = [it.problem_summary, it.client_story, it.uploaded_documents_notes,
      it.existing_documents, it.internal_notes, it.facts_period, it.amount_involved]
      .filter((x) => typeof x === "string").join("\n");
    if (t) arr.push({ text: t, source: "intake" });
  }
  if (input.analysis) {
    const c = (input.analysis.content_json as Record<string, unknown> | undefined) ?? {};
    const t = [c.summary, ...(Array.isArray(c.facts) ? c.facts : [])]
      .filter((x) => typeof x === "string").join("\n");
    if (t) arr.push({ text: t, source: "analysis" });
  }
  if (input.additionalInstructions) arr.push({ text: input.additionalInstructions, source: "instructions" });
  return arr;
}

export function buildCalculationContext(input: BuildInput): CalculationContext {
  const texts = collectText(input);
  const it = (input.intake ?? {}) as Record<string, unknown>;
  const an = ((input.analysis?.content_json as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;

  const salary = firstOf<number>(
    { value: parseMoneyBrl(it.monthly_salary as string) ?? parseMoneyBrl(it.salary as string) ?? parseMoneyBrl(it.remuneracao as string), source: "intake" },
    { value: parseMoneyBrl(an.monthly_salary as string), source: "analysis" },
    ...texts.map((t) => ({ value: extractSalary(t.text), source: t.source })),
  );

  const admission = firstOf<string>(
    { value: parseDatePtBr(it.admission_date as string) ?? parseDatePtBr(it.data_admissao as string), source: "intake" },
    { value: parseDatePtBr(an.admission_date as string), source: "analysis" },
    ...texts.map((t) => ({ value: extractAdmission(t.text), source: t.source })),
  );

  const termination = firstOf<string>(
    { value: parseDatePtBr(it.termination_date as string) ?? parseDatePtBr(it.data_rescisao as string), source: "intake" },
    { value: parseDatePtBr(an.termination_date as string), source: "analysis" },
    ...texts.map((t) => ({ value: extractTermination(t.text), source: t.source })),
  );

  let terminationDayCount: number | null = null;
  let terminationDaySource: SourceKey = "derived";
  const wd = it.worked_days_in_last_month;
  if (typeof wd === "number" && wd > 0) { terminationDayCount = wd; terminationDaySource = "intake"; }
  else if (termination?.value) {
    const d = parseInt(termination.value.slice(8, 10), 10);
    if (!isNaN(d)) terminationDayCount = d;
  }

  const sched: WorkSchedule = {
    start_time: null, end_time: null, interval_minutes: null,
    days_per_week: null, days_off_per_month: null,
  };
  let schedSource: SourceKey | null = null;
  for (const t of texts) {
    const p = extractSchedule(t.text);
    if (p.start_time && !sched.start_time) { sched.start_time = p.start_time; schedSource ??= t.source; }
    if (p.end_time && !sched.end_time) { sched.end_time = p.end_time; schedSource ??= t.source; }
    if (p.interval_minutes != null && sched.interval_minutes == null) { sched.interval_minutes = p.interval_minutes; schedSource ??= t.source; }
    if (p.days_off_per_month != null && sched.days_off_per_month == null) { sched.days_off_per_month = p.days_off_per_month; schedSource ??= t.source; }
    if (p.days_per_week != null && sched.days_per_week == null) { sched.days_per_week = p.days_per_week; schedSource ??= t.source; }
  }
  if (!sched.days_per_week && sched.days_off_per_month != null) {
    sched.days_per_week = Math.max(4, Math.min(6, 7 - Math.round(sched.days_off_per_month / 4.33)));
  }

  const varPay: VariablePay = { km_rate: null, average_km_per_month: null, monthly_variable_estimate: null };
  let varSource: SourceKey | null = null;
  for (const t of texts) {
    const p = extractVariable(t.text);
    if (p.km_rate != null && varPay.km_rate == null) { varPay.km_rate = p.km_rate; varSource ??= t.source; }
    if (p.average_km_per_month != null && varPay.average_km_per_month == null) {
      varPay.average_km_per_month = p.average_km_per_month; varSource ??= t.source;
    }
  }
  if (varPay.km_rate != null && varPay.average_km_per_month != null) {
    varPay.monthly_variable_estimate = Math.round(varPay.km_rate * varPay.average_km_per_month * 100) / 100;
  }

  const conf: Record<string, Confidence> = {};
  const src: Record<string, string> = {};
  const set = (f: string, s: SourceKey | null) => { if (s) { conf[f] = SOURCE_CONFIDENCE[s]; src[f] = SOURCE_LABEL[s]; } };
  set("monthly_salary", salary?.source ?? null);
  set("admission_date", admission?.source ?? null);
  set("termination_date", termination?.source ?? null);
  set("termination_day_count", terminationDayCount != null ? terminationDaySource : null);
  set("work_schedule", schedSource);
  set("variable_pay", varSource);

  const role = typeof it.role === "string" ? it.role
    : typeof (it as Record<string, unknown>).profession === "string" ? (it as Record<string, unknown>).profession as string
    : typeof an.role === "string" ? an.role as string : null;

  return {
    monthly_salary: salary?.value ?? null,
    admission_date: admission?.value ?? null,
    termination_date: termination?.value ?? null,
    termination_day_count: terminationDayCount,
    role,
    work_schedule: sched,
    variable_pay: varPay,
    confidence_by_field: conf,
    sources_by_field: src,
  };
}
