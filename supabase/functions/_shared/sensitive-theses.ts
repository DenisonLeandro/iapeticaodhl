// =============================================================================
// PR-4.4B.2 — Alertas de teses jurídicas sensíveis / desatualizadas.
// Regex de detecção + severidade + mensagem. Consumido no review-legal-draft.
// =============================================================================

export type Severity = "high" | "medium" | "low";

export interface SensitiveAlert {
  id: string;
  severity: Severity;
  message: string;
}

interface Rule {
  id: string;
  match: RegExp;
  severity: Severity;
  message: string;
  // opcional: quando true, exige a presença de outra regex para disparar
  requires?: RegExp;
}

const RULES: Rule[] = [
  {
    id: "sumula_450_adpf_501",
    match: /súmula\s*450(\s*\/\s*TST|\s+do\s+TST)?|férias.{0,30}dobro|pagamento.{0,20}fér(i|)as.{0,40}atraso/i,
    severity: "high",
    message:
      "Súmula 450/TST (férias em dobro por atraso no pagamento) — RISCO ALTO: revisar ADPF 501/STF. Considerar reformulação/exclusão do pedido se contrato posterior ao julgamento e sem fundamento específico.",
  },
  {
    id: "adi_5766_gratuidade",
    match: /ADI\s*5\.?766|justiça\s+gratuita|beneficiário.{0,20}gratuidade|honorários.{0,20}sucumben/i,
    severity: "medium",
    message:
      "Sucumbência/justiça gratuita — revisar fundamentação atual à luz da ADI 5.766/STF; evitar redação genérica.",
  },
  {
    id: "intrajornada_pos_reforma",
    match: /intervalo\s+intrajornada|art\.?\s*71.{0,10}§?\s*4|Súmula\s*437/i,
    severity: "medium",
    message:
      "Intervalo intrajornada — para contratos POSTERIORES à Reforma Trabalhista (13/11/2017) aplicar art. 71, §4º, CLT (indenização apenas do tempo suprimido). Não aplicar automaticamente entendimento anterior/Súmula 437.",
  },
  {
    id: "insalubridade_base",
    match: /insalubridade|adicional\s+de\s+insalubridade|NR-?15/i,
    severity: "medium",
    message:
      "Insalubridade — verificar base de cálculo (salário mínimo, salário-base ou norma coletiva). Não afirmar 'sobre o salário do reclamante' sem fundamento específico.",
  },
];

export function detectSensitiveAlerts(text: string): SensitiveAlert[] {
  const out: SensitiveAlert[] = [];
  const seen = new Set<string>();
  for (const r of RULES) {
    if (!r.match.test(text)) continue;
    if (r.requires && !r.requires.test(text)) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({ id: r.id, severity: r.severity, message: r.message });
  }
  return out;
}
