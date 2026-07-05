// =============================================================================
// PR-4.4B.2 — Motor de cálculos estimativos DETERMINÍSTICO (sem IA).
// Cada cálculo declara fórmula, dados, premissas, valor, confiança, faltantes.
// Se faltar dado essencial: valor null + missing_fields + confidence "low".
// v1: cobre saldo de salário, aviso-prévio, 13º proporcional, férias+1/3,
//     FGTS estimado, multa 40%, multa 477, honorários. Horas extras e afins
//     só quando premissas expressas são fornecidas.
// =============================================================================

import type { CalculationContext } from "./calc-engine/normalize-context.ts";

export type Confidence = "high" | "medium" | "low";

export interface CalcItem {
  request_label: string;
  legal_basis: string | null;
  formula: string | null;
  input_data: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  estimated_value: number | null;
  confidence: Confidence;
  missing_fields: string[];
  period: string | null;
  notes: string | null;
}

export interface CalcContext {
  monthly_salary?: number | null;
  admission_date?: string | null;       // ISO
  termination_date?: string | null;     // ISO
  worked_days_in_last_month?: number | null;
  prior_vacation_taken?: boolean | null;
  fgts_missing_months?: number | null;
  weekly_extra_hours?: number | null;   // opcional — só calcula se presente
  intrajornada_minutes_suppressed_per_day?: number | null; // idem
  work_days_per_week?: number | null;
  hours_per_day?: number | null;
  hourly_extra_multiplier?: number | null; // ex 1.5
  interjornada_hours_suppressed_per_week?: number | null;
  dsr_and_holidays_per_month?: number | null; // domingos/feriados trabalhados por mês
}

export interface CalcResult {
  status: "complete" | "partial" | "pending_data";
  total_estimated_value: number;
  assumptions: Record<string, unknown>;
  items: CalcItem[];
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function monthsBetween(a: Date, b: Date): number {
  const years = b.getFullYear() - a.getFullYear();
  const months = b.getMonth() - a.getMonth();
  const days = b.getDate() - a.getDate();
  return years * 12 + months + (days >= 0 ? 0 : -1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Cálculos individuais
// ---------------------------------------------------------------------------

function calcSaldoSalario(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  if (!ctx.worked_days_in_last_month && !ctx.termination_date) missing.push("Dias trabalhados no último mês OU data da rescisão");

  if (missing.length > 0 || !ctx.monthly_salary) {
    return {
      request_label: "Saldo de salário",
      legal_basis: "art. 462 c/c art. 477 CLT",
      formula: "(salário / 30) × dias trabalhados no mês da rescisão",
      input_data: { monthly_salary: ctx.monthly_salary ?? null, worked_days: ctx.worked_days_in_last_month ?? null },
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: missing,
      period: null,
      notes: "[CALCULAR VALOR — faltam dados essenciais]",
    };
  }

  const days = ctx.worked_days_in_last_month ?? (parseDate(ctx.termination_date!)?.getDate() ?? 0);
  const value = round2((ctx.monthly_salary / 30) * days);
  return {
    request_label: "Saldo de salário",
    legal_basis: "art. 462 c/c art. 477 CLT",
    formula: "(salário / 30) × dias trabalhados",
    input_data: { monthly_salary: ctx.monthly_salary, worked_days: days },
    assumptions: { base_dias_mes: 30 },
    estimated_value: value,
    confidence: "high",
    missing_fields: [],
    period: null,
    notes: null,
  };
}

function calcAvisoPrevio(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  const adm = parseDate(ctx.admission_date ?? null);
  const term = parseDate(ctx.termination_date ?? null);
  if (!adm) missing.push("Data de admissão");
  if (!term) missing.push("Data de rescisão");

  if (missing.length > 0 || !ctx.monthly_salary || !adm || !term) {
    return {
      request_label: "Aviso-prévio indenizado",
      legal_basis: "art. 487 CLT + Lei 12.506/2011",
      formula: "salário × (1 + (anos_completos × 3 / 30)), limitado a 90 dias totais",
      input_data: { monthly_salary: ctx.monthly_salary ?? null, admission_date: ctx.admission_date ?? null, termination_date: ctx.termination_date ?? null },
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: missing,
      period: null,
      notes: "[CALCULAR VALOR — faltam dados essenciais]",
    };
  }

  const yearsCompleted = Math.floor(monthsBetween(adm, term) / 12);
  const addDays = Math.min(yearsCompleted * 3, 60); // teto: 30 base + 60 add = 90
  const totalDays = 30 + addDays;
  const value = round2((ctx.monthly_salary / 30) * totalDays);
  return {
    request_label: "Aviso-prévio indenizado",
    legal_basis: "art. 487 CLT + Lei 12.506/2011",
    formula: "(salário / 30) × (30 + min(anos × 3, 60))",
    input_data: { monthly_salary: ctx.monthly_salary, years_completed: yearsCompleted, total_days: totalDays },
    assumptions: {},
    estimated_value: value,
    confidence: "high",
    missing_fields: [],
    period: `${totalDays} dias`,
    notes: null,
  };
}

function calcDecimoTerceiroProp(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  const term = parseDate(ctx.termination_date ?? null);
  if (!term) missing.push("Data de rescisão");

  if (!ctx.monthly_salary || !term) {
    return {
      request_label: "13º salário proporcional",
      legal_basis: "Lei 4.090/62; art. 1º Lei 4.749/65",
      formula: "(salário / 12) × meses trabalhados no ano (fração ≥15 dias = mês)",
      input_data: { monthly_salary: ctx.monthly_salary ?? null, termination_date: ctx.termination_date ?? null },
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: missing,
      period: null,
      notes: "[CALCULAR VALOR — faltam dados essenciais]",
    };
  }

  const startOfYear = new Date(term.getFullYear(), 0, 1);
  const months = monthsBetween(startOfYear, term) + (term.getDate() >= 15 ? 1 : 0);
  const value = round2((ctx.monthly_salary / 12) * months);
  return {
    request_label: "13º salário proporcional",
    legal_basis: "Lei 4.090/62; art. 1º Lei 4.749/65",
    formula: "(salário / 12) × meses do ano",
    input_data: { monthly_salary: ctx.monthly_salary, months_in_year: months },
    assumptions: { fracao_15_dias_conta_mes: true },
    estimated_value: value,
    confidence: "high",
    missing_fields: [],
    period: `${months}/12 meses`,
    notes: null,
  };
}

function calcFeriasPropUmTerco(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  const adm = parseDate(ctx.admission_date ?? null);
  const term = parseDate(ctx.termination_date ?? null);
  if (!adm) missing.push("Data de admissão");
  if (!term) missing.push("Data de rescisão");

  if (!ctx.monthly_salary || !adm || !term) {
    return {
      request_label: "Férias proporcionais + 1/3",
      legal_basis: "arts. 134, 137, 146 CLT; art. 7º XVII CF",
      formula: "(salário / 12) × meses aquisitivos × (1 + 1/3)",
      input_data: { monthly_salary: ctx.monthly_salary ?? null, admission_date: ctx.admission_date ?? null, termination_date: ctx.termination_date ?? null },
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: missing,
      period: null,
      notes: "[CALCULAR VALOR — faltam dados essenciais]",
    };
  }

  // Fração do último período aquisitivo
  const lastAnniversary = new Date(term.getFullYear(), adm.getMonth(), adm.getDate());
  const startAcq = lastAnniversary <= term
    ? lastAnniversary
    : new Date(term.getFullYear() - 1, adm.getMonth(), adm.getDate());
  const months = Math.max(0, monthsBetween(startAcq, term)) + (term.getDate() >= 15 ? 1 : 0);
  const capped = Math.min(months, 12);
  const base = (ctx.monthly_salary / 12) * capped;
  const value = round2(base * (4 / 3));
  return {
    request_label: "Férias proporcionais + 1/3",
    legal_basis: "arts. 134, 137, 146 CLT; art. 7º XVII CF",
    formula: "(salário / 12) × meses × (1 + 1/3)",
    input_data: { monthly_salary: ctx.monthly_salary, months_acquisitive: capped },
    assumptions: { fracao_15_dias_conta_mes: true },
    estimated_value: value,
    confidence: "high",
    missing_fields: [],
    period: `${capped}/12 meses aquisitivos`,
    notes: null,
  };
}

function calcFgtsEstimado(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  const adm = parseDate(ctx.admission_date ?? null);
  const term = parseDate(ctx.termination_date ?? null);
  if (!adm) missing.push("Data de admissão");
  if (!term) missing.push("Data de rescisão");

  if (!ctx.monthly_salary || !adm || !term) {
    return {
      request_label: "FGTS estimado (não recolhido)",
      legal_basis: "Lei 8.036/90; Súmula 461/TST",
      formula: "salário × 8% × meses trabalhados (estimativa sem correção)",
      input_data: { monthly_salary: ctx.monthly_salary ?? null, missing_months: ctx.fgts_missing_months ?? null },
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: missing.concat(ctx.fgts_missing_months == null ? ["Meses sem recolhimento (ou confirmar todo o contrato)"] : []),
      period: null,
      notes: "[CALCULAR VALOR — dependente de extratos do FGTS a serem exibidos pela Reclamada]",
    };
  }

  const months = ctx.fgts_missing_months ?? Math.max(1, monthsBetween(adm, term));
  const value = round2(ctx.monthly_salary * 0.08 * months);
  return {
    request_label: "FGTS estimado (não recolhido)",
    legal_basis: "Lei 8.036/90; Súmula 461/TST",
    formula: "salário × 8% × meses",
    input_data: { monthly_salary: ctx.monthly_salary, months },
    assumptions: { sem_correcao_monetaria: true, sujeito_liquidacao_com_extratos: true },
    estimated_value: value,
    confidence: ctx.fgts_missing_months != null ? "medium" : "low",
    missing_fields: ctx.fgts_missing_months == null ? ["Confirmar meses efetivamente não recolhidos"] : [],
    period: `${months} meses`,
    notes: "Estimativa. Valor exato depende dos extratos do FGTS.",
  };
}

function calcMulta40Fgts(ctx: CalcContext, fgtsItem: CalcItem): CalcItem {
  if (fgtsItem.estimated_value == null) {
    return {
      request_label: "Multa de 40% sobre FGTS",
      legal_basis: "art. 18, §1º, Lei 8.036/90",
      formula: "saldo FGTS × 40%",
      input_data: {},
      assumptions: {},
      estimated_value: null,
      confidence: "low",
      missing_fields: ["Saldo do FGTS (depende dos extratos)"],
      period: null,
      notes: "[CALCULAR VALOR — depende do saldo total do FGTS]",
    };
  }
  return {
    request_label: "Multa de 40% sobre FGTS (estimativa parcial)",
    legal_basis: "art. 18, §1º, Lei 8.036/90",
    formula: "saldo FGTS × 40%",
    input_data: { fgts_base_estimado: fgtsItem.estimated_value },
    assumptions: { base_apenas_estimativa: true, sujeito_extratos: true },
    estimated_value: round2(fgtsItem.estimated_value * 0.4),
    confidence: "low",
    missing_fields: ["Confirmar saldo total do FGTS via extratos"],
    period: null,
    notes: "Estimativa sobre valor não recolhido; recalcular com extratos.",
  };
}

function calcMulta477(ctx: CalcContext): CalcItem {
  const missing: string[] = [];
  if (!ctx.monthly_salary) missing.push("Salário mensal");
  if (!ctx.monthly_salary) {
    return {
      request_label: "Multa do art. 477, §8º, CLT",
      legal_basis: "art. 477, §8º, CLT",
      formula: "= 1 salário (quando pagamento fora do prazo do §6º)",
      input_data: {},
      assumptions: { premissa: "verbas rescisórias pagas em atraso ou não pagas" },
      estimated_value: null,
      confidence: "low",
      missing_fields: missing,
      period: null,
      notes: "[CALCULAR VALOR — informar salário]",
    };
  }
  return {
    request_label: "Multa do art. 477, §8º, CLT",
    legal_basis: "art. 477, §8º, CLT",
    formula: "= 1 × salário",
    input_data: { monthly_salary: ctx.monthly_salary },
    assumptions: { premissa: "pagamento fora do prazo de 10 dias" },
    estimated_value: round2(ctx.monthly_salary),
    confidence: "high",
    missing_fields: [],
    period: null,
    notes: null,
  };
}

function calcHonorarios(ctx: CalcContext, subtotalConhecido: number): CalcItem {
  if (subtotalConhecido <= 0) {
    return {
      request_label: "Honorários advocatícios",
      legal_basis: "art. 791-A CLT",
      formula: "15% sobre o valor da condenação",
      input_data: {},
      assumptions: { percentual: 0.15 },
      estimated_value: null,
      confidence: "low",
      missing_fields: ["Valor da condenação (depende dos pedidos deferidos)"],
      period: null,
      notes: "[CALCULAR VALOR — dependente da condenação]",
    };
  }
  return {
    request_label: "Honorários advocatícios (estimativa)",
    legal_basis: "art. 791-A CLT",
    formula: "15% × subtotal estimado dos pedidos",
    input_data: { subtotal_estimado: subtotalConhecido },
    assumptions: { percentual: 0.15, base: "somente pedidos com valor calculado" },
    estimated_value: round2(subtotalConhecido * 0.15),
    confidence: "medium",
    missing_fields: ["Percentual final depende do juízo (5% a 15%)"],
    period: null,
    notes: "[REVISAR JURISPRUDÊNCIA ATUAL SOBRE ADI 5.766/STF QUANTO À JUSTIÇA GRATUITA]",
  };
}

// Horas extras / intrajornada / interjornada / DSR — SÓ com premissas expressas
function calcHorasExtras(ctx: CalcContext): CalcItem | null {
  if (
    ctx.weekly_extra_hours == null ||
    !ctx.monthly_salary ||
    !ctx.work_days_per_week ||
    !ctx.hours_per_day
  ) return null;

  const monthlyHours = ctx.hours_per_day * ctx.work_days_per_week * 4.33;
  const hourly = ctx.monthly_salary / monthlyHours;
  const monthlyExtra = (ctx.weekly_extra_hours ?? 0) * 4.33;
  const mult = ctx.hourly_extra_multiplier ?? 1.5;
  const adm = parseDate(ctx.admission_date ?? null);
  const term = parseDate(ctx.termination_date ?? null);
  const months = adm && term ? Math.max(1, monthsBetween(adm, term)) : 1;
  const value = round2(hourly * monthlyExtra * mult * months);
  return {
    request_label: "Horas extras (estimativa com premissas)",
    legal_basis: "art. 7º XIII/XVI CF; arts. 58 e 59 CLT",
    formula: "hora normal × horas extras/mês × adicional × meses do contrato",
    input_data: {
      monthly_salary: ctx.monthly_salary, weekly_extra_hours: ctx.weekly_extra_hours,
      work_days_per_week: ctx.work_days_per_week, hours_per_day: ctx.hours_per_day,
      months,
    },
    assumptions: { multiplicador: mult, base_horas_mes: monthlyHours },
    estimated_value: value,
    confidence: "medium",
    missing_fields: ["Reflexos em DSR, férias+1/3, 13º, FGTS+40%, aviso"],
    period: `${months} meses`,
    notes: "Estimativa exige confirmação da jornada real e dos controles de ponto.",
  };
}

function calcIntrajornada(ctx: CalcContext): CalcItem | null {
  if (ctx.intrajornada_minutes_suppressed_per_day == null || !ctx.monthly_salary || !ctx.hours_per_day || !ctx.work_days_per_week) return null;
  const hourly = ctx.monthly_salary / (ctx.hours_per_day * ctx.work_days_per_week * 4.33);
  const suppressedHoursMonth = (ctx.intrajornada_minutes_suppressed_per_day / 60) * ctx.work_days_per_week * 4.33;
  const value = round2(hourly * suppressedHoursMonth * 1.5);
  return {
    request_label: "Intervalo intrajornada suprimido (indenização)",
    legal_basis: "art. 71, §4º, CLT (redação pós-Reforma 13/11/2017)",
    formula: "hora normal × horas suprimidas/mês × 1,5 (apenas o tempo suprimido, natureza indenizatória)",
    input_data: { minutes_per_day: ctx.intrajornada_minutes_suppressed_per_day },
    assumptions: { aplicacao_pos_reforma: true, natureza_indenizatoria: true, sem_reflexos: true },
    estimated_value: value,
    confidence: "medium",
    missing_fields: ["Confirmar aplicabilidade temporal do art. 71 §4º"],
    period: "1 mês",
    notes: "[REVISAR APLICAÇÃO TEMPORAL — contratos anteriores à Reforma seguem entendimento anterior]",
  };
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

export function runCalculations(ctx: CalcContext): CalcResult {
  const items: CalcItem[] = [];

  items.push(calcSaldoSalario(ctx));
  items.push(calcAvisoPrevio(ctx));
  items.push(calcDecimoTerceiroProp(ctx));
  items.push(calcFeriasPropUmTerco(ctx));
  const fgts = calcFgtsEstimado(ctx);
  items.push(fgts);
  items.push(calcMulta40Fgts(ctx, fgts));
  items.push(calcMulta477(ctx));

  const he = calcHorasExtras(ctx);
  if (he) items.push(he);
  const intra = calcIntrajornada(ctx);
  if (intra) items.push(intra);

  const subtotal = items.reduce((acc, i) => acc + (i.estimated_value ?? 0), 0);
  items.push(calcHonorarios(ctx, subtotal));

  const total = items.reduce((acc, i) => acc + (i.estimated_value ?? 0), 0);
  const anyComputed = items.some((i) => i.estimated_value != null);
  const anyMissing = items.some((i) => i.estimated_value == null);
  const status: CalcResult["status"] =
    anyComputed && !anyMissing ? "complete" : anyComputed ? "partial" : "pending_data";

  return {
    status,
    total_estimated_value: round2(total),
    assumptions: {
      base_dias_mes: 30,
      base_horas_mes: 220,
      fgts_percent: 0.08,
      multa_fgts: 0.4,
      honorarios_percentual_estimado: 0.15,
    },
    items,
  };
}

// ---------------------------------------------------------------------------
// Adapter: CalculationContext (normalize-context) → CalcContext (legado)
// + derivação de premissas de jornada (weekly_extra_hours, intrajornada).
// ---------------------------------------------------------------------------

function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function contextFromNormalized(n: CalculationContext): CalcContext {
  const s = n.work_schedule;
  const startMin = timeToMinutes(s.start_time);
  const endMin = timeToMinutes(s.end_time);
  const interval = s.interval_minutes ?? null;
  const daysPerWeek = s.days_per_week ?? null;

  let workedMinutesPerDay: number | null = null;
  if (startMin != null && endMin != null) {
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    if (interval != null) diff -= interval;
    if (diff > 0) workedMinutesPerDay = diff;
  }
  const hoursPerDay = workedMinutesPerDay != null ? workedMinutesPerDay / 60 : null;

  let weeklyExtra: number | null = null;
  if (hoursPerDay != null && daysPerWeek != null && hoursPerDay > 8) {
    weeklyExtra = Math.round((hoursPerDay - 8) * daysPerWeek * 100) / 100;
  }

  let intrajornadaSuppressed: number | null = null;
  if (interval != null && hoursPerDay != null && hoursPerDay > 6 && interval < 60) {
    intrajornadaSuppressed = 60 - interval;
  }

  return {
    monthly_salary: n.monthly_salary,
    admission_date: n.admission_date,
    termination_date: n.termination_date,
    worked_days_in_last_month: n.termination_day_count,
    fgts_missing_months: null,
    weekly_extra_hours: weeklyExtra,
    intrajornada_minutes_suppressed_per_day: intrajornadaSuppressed,
    work_days_per_week: daysPerWeek,
    hours_per_day: hoursPerDay != null ? Math.min(hoursPerDay, 24) : null,
    hourly_extra_multiplier: 1.5,
  };
}

/**
 * Annotate calc result items with source/confidence info coming from the
 * normalized context (injected as private keys inside `assumptions`).
 */
export function annotateWithSources(result: CalcResult, n: CalculationContext): CalcResult {
  const bySrc = n.sources_by_field;
  const byConf = n.confidence_by_field;
  const has = (k: string) => bySrc[k] || byConf[k];
  const labelFor = (label: string): { src?: string; conf?: string } => {
    const l = label.toLowerCase();
    if (l.includes("saldo")) return { src: bySrc.termination_day_count || bySrc.termination_date, conf: byConf.termination_day_count || byConf.termination_date };
    if (l.includes("aviso") || l.includes("férias") || l.includes("13") || l.includes("fgts") || l.includes("multa"))
      return { src: bySrc.monthly_salary, conf: byConf.monthly_salary };
    if (l.includes("intrajornada") || l.includes("horas extras") || l.includes("interjornada"))
      return { src: bySrc.work_schedule, conf: byConf.work_schedule };
    if (l.includes("produtividade") || l.includes("km"))
      return { src: bySrc.variable_pay, conf: byConf.variable_pay };
    return { src: has("monthly_salary") ? bySrc.monthly_salary : undefined, conf: byConf.monthly_salary };
  };
  return {
    ...result,
    items: result.items.map((it) => {
      const { src, conf } = labelFor(it.request_label);
      const assumptions = { ...(it.assumptions ?? {}) } as Record<string, unknown>;
      if (src) assumptions._source = src;
      if (conf) assumptions._confidence_source = conf;
      return { ...it, assumptions };
    }),
  };
}

// ---------------------------------------------------------------------------
// Backwards-compat helper (fallback quando não há normalização).
// ---------------------------------------------------------------------------

function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[R$\s.]/g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function pickIso(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function extractCalcContext(sources: {
  intake?: Record<string, unknown> | null;
  analysis?: Record<string, unknown> | null;
}): CalcContext {
  const it = sources.intake ?? {};
  const an = (sources.analysis?.content_json as Record<string, unknown> | undefined) ?? {};

  return {
    monthly_salary: pickNumber(it.monthly_salary, it.salary, it.remuneracao, an.monthly_salary),
    admission_date: pickIso(it.admission_date, it.data_admissao, an.admission_date),
    termination_date: pickIso(it.termination_date, it.data_rescisao, an.termination_date),
    worked_days_in_last_month: pickNumber(it.worked_days_in_last_month),
    fgts_missing_months: pickNumber(it.fgts_missing_months),
    weekly_extra_hours: pickNumber(it.weekly_extra_hours),
    intrajornada_minutes_suppressed_per_day: pickNumber(it.intrajornada_minutes_suppressed_per_day),
    work_days_per_week: pickNumber(it.work_days_per_week),
    hours_per_day: pickNumber(it.hours_per_day),
    hourly_extra_multiplier: pickNumber(it.hourly_extra_multiplier),
  };
}
