import { describe, it, expect } from "vitest";
import {
  detectPlaceholders,
  summarizePlaceholders,
  deriveCalculationStatus,
  computeCaseValue,
  runCompletenessAudit,
} from "@shared/completeness.ts";
import { isItemConsistent } from "@shared/calc-engine.ts";
import { countPendingMarkers } from "@/lib/drafts/pending-markers";

const PETICAO = `EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DA VARA DO TRABALHO

DOS PEDIDOS
a) saldo de salário — [CALCULAR VALOR];
b) aviso prévio — [CALCULAR VALOR];
c) 13º proporcional — [CALCULAR VALOR];
d) férias + 1/3 — [CALCULAR VALOR];
e) FGTS — [CALCULAR VALOR];
f) multa 40% — [CALCULAR VALOR];
g) multa do art. 477 — [CALCULAR VALOR];
h) horas extras — [CALCULAR VALOR];

Processo nº [Número do processo]

Recife, 6 de agosto de 2026.

NOME DO ADVOGADO
OAB/PE nº XXXX
`;

describe("detecção de placeholders (fonte única)", () => {
  it("conta cada ocorrência individualmente e separa por categoria", () => {
    const found = detectPlaceholders(PETICAO);
    const s = summarizePlaceholders(found);
    const calc = found.filter((f) => f.marker.toUpperCase().includes("CALCULAR"));
    expect(calc).toHaveLength(8);
    expect(calc[7].occurrence_index).toBe(8);
    expect(s.placeholder_count).toBe(
      s.calculation_placeholder_count + s.qualification_placeholder_count + s.other_placeholder_count,
    );
    expect(s.calculation_placeholder_count).toBe(8);
    expect(s.placeholder_count).toBeGreaterThanOrEqual(10);
    expect(found.some((f) => /NOME DO ADVOGADO/i.test(f.marker))).toBe(true);
    expect(found.some((f) => /N[úu]mero do processo/i.test(f.marker))).toBe(true);
  });

  it("ignora notas de rodapé e mantém a mesma contagem no frontend", () => {
    expect(detectPlaceholders("texto [1] e [2]")).toHaveLength(0);
    expect(countPendingMarkers(PETICAO).total).toBe(detectPlaceholders(PETICAO).length);
  });

  it("associa a seção do marcador", () => {
    const found = detectPlaceholders(PETICAO);
    expect(found[0].section_key).toBe("pedidos");
  });
});

describe("gate de injeção usa chave canônica (regressão)", () => {
  const base = {
    request_label: "Saldo de salário",
    legal_basis: null, formula: null, input_data: {}, assumptions: {},
    estimated_value: 1000, confidence: "high" as const, missing_fields: [],
    period: null, notes: null,
  };
  it("origem documento processado → injetável", () => {
    expect(isItemConsistent(base, { terminationSrc: "document" })).toBe(true);
  });
  it("origem ficha inteligente → injetável", () => {
    expect(isItemConsistent(base, { terminationSrc: "intake" })).toBe(true);
  });
  it("origem análise inicial → não injetável", () => {
    expect(isItemConsistent(base, { terminationSrc: "initial_analysis" })).toBe(false);
  });
});

describe("status derivado e valor da causa", () => {
  const calculado = { request_label: "Saldo", estimated_value: 100, assumptions: { _draft_injectable: true } };
  const estimado = { request_label: "Honorários", estimated_value: 15, assumptions: { _draft_injectable: false } };
  const pendente = { request_label: "FGTS", estimated_value: null, missing_fields: ["Extratos"] };
  const manual = { request_label: "Dano moral", estimated_value: null, manual_value: 5000, manual_value_confirmed: true };

  it("classifica os quatro estados", () => {
    expect(deriveCalculationStatus(calculado)).toBe("calculated");
    expect(deriveCalculationStatus(estimado)).toBe("estimated");
    expect(deriveCalculationStatus(pendente)).toBe("pending");
    expect(deriveCalculationStatus(manual)).toBe("manual");
  });

  it("nunca marca calculated sem valor", () => {
    expect(deriveCalculationStatus({ estimated_value: null, assumptions: { _draft_injectable: true } })).toBe("pending");
  });

  it("valor da causa parcial quando há pendência", () => {
    const r = computeCaseValue([calculado, estimado, pendente, manual]);
    expect(r.claim_value_sum).toBe(5115);
    expect(r.case_value_status).toBe("partial");
    expect(r.pending_claims.map((p) => p.label)).toEqual(["FGTS"]);
  });

  it("completo quando todos têm valor utilizável", () => {
    expect(computeCaseValue([calculado, estimado]).case_value_status).toBe("complete");
  });
});

describe("auditoria e compatibilidade com legado", () => {
  it("minuta com pendências fica draft_incomplete", () => {
    const a = runCompletenessAudit({ content: PETICAO, items: [] });
    expect(a.protocol_readiness).toBe("draft_incomplete");
  });

  it("minuta limpa fica pronta para revisão e só vira apta com ato do advogado", () => {
    const content = "PEDIDOS\na) saldo de salário: R$ 1.000,00.";
    const items = [{ request_label: "Saldo", estimated_value: 1000, assumptions: { _draft_injectable: true } }];
    const a = runCompletenessAudit({ content, items });
    expect(a.protocol_readiness).toBe("ready_for_legal_review");
    const b = runCompletenessAudit({ content, items, lawyerReviewConfirmedHash: a.content_hash });
    expect(b.protocol_readiness).toBe("lawyer_review_confirmed");
    const c = runCompletenessAudit({ content: content + " alterado", items, lawyerReviewConfirmedHash: a.content_hash });
    expect(c.protocol_readiness).toBe("ready_for_legal_review");
  });

  it("minuta legada (sem auditoria e sem itens) abre e é auditável sem alterar conteúdo", () => {
    const legacy = "Texto antigo sem marcadores.";
    const a = runCompletenessAudit({ content: legacy });
    expect(a.placeholder_count).toBe(0);
    expect(a.case_value_status).toBe("pending");
    expect(legacy).toBe("Texto antigo sem marcadores.");
  });
});
