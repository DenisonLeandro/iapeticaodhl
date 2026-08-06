import { describe, it, expect } from "vitest";
import {
  detectPlaceholders,
  summarizePlaceholders,
} from "@shared/completeness";
import {
  selectApplicableTheses,
  renderThesesForPrompt,
  LEGAL_THESES,
} from "@shared/legal-theses";

describe("PR-EXCELÊNCIA 1 — classificação de pendências", () => {
  it("ignora numeração romana estrutural dos pedidos", () => {
    const text = `DOS PEDIDOS\n[I] horas extras;\n[II] intervalo intrajornada;\n[III] FGTS;\n[XIV] honorários.`;
    expect(detectPlaceholders(text)).toHaveLength(0);
  });

  it("classifica marcador de pesquisa como revisão jurídica", () => {
    const list = detectPlaceholders("Sucumbência [REVISAR ADI 5.766/STF] aplicável.");
    expect(list).toHaveLength(1);
    expect(list[0].category).toBe("legal_review");
  });

  it("classifica marcador de juntada como instrução", () => {
    const list = detectPlaceholders("Junte-se [ANEXAR CTPS DIGITAL] aos autos.");
    expect(list[0].category).toBe("instruction");
  });

  it("mantém cálculo e qualificação nas categorias próprias", () => {
    const list = detectPlaceholders("Pagar [CALCULAR VALOR] perante a [INFORMAR VARA].");
    const s = summarizePlaceholders(list);
    expect(s.calculation_placeholder_count).toBe(1);
    expect(s.qualification_placeholder_count).toBe(1);
    expect(s.legal_review_placeholder_count).toBe(0);
  });

  it("resume as cinco categorias", () => {
    const s = summarizePlaceholders(
      detectPlaceholders(
        "[REVISAR TESE] [ANEXAR HOLERITES] [CALCULAR VALOR] [INFORMAR CPF] [ALGO QUALQUER AQUI]",
      ),
    );
    expect(s.placeholder_count).toBe(5);
    expect(s.legal_review_placeholder_count).toBe(1);
    expect(s.instruction_placeholder_count).toBe(1);
    expect(s.calculation_placeholder_count).toBe(1);
    expect(s.qualification_placeholder_count).toBe(1);
    expect(s.other_placeholder_count).toBe(1);
  });
});

describe("PR-EXCELÊNCIA 1 — seleção de teses", () => {
  it("tem as dez teses curadas com base legal", () => {
    expect(LEGAL_THESES).toHaveLength(10);
    for (const t of LEGAL_THESES) {
      expect(t.legal_basis.length).toBeGreaterThan(0);
      expect(t.reviewed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.guidance.length).toBeGreaterThan(80);
    }
  });

  it("seleciona conforme a matéria, não conforme o cliente", () => {
    const a = selectApplicableTheses({
      contextTexts: ["Motorista externo com rastreador, pede horas extras e intervalo intrajornada."],
      legalArea: "trabalhista",
      draftType: "initial_petition",
    }).map((t) => t.key);
    const b = selectApplicableTheses({
      contextTexts: ["Vendedor comissionado pede integração das comissões e rescisão indireta."],
      legalArea: "trabalhista",
      draftType: "initial_petition",
    }).map((t) => t.key);

    expect(a).toContain("trabalho_externo_controle_jornada");
    expect(a).toContain("intervalo_intrajornada");
    expect(b).toContain("integracao_remuneracao_variavel");
    expect(b).toContain("rescisao_indireta");
    expect(a).not.toEqual(b);
  });

  it("só traz ADI 5.766 quando há gratuidade ou honorários em pauta", () => {
    const semGratuidade = selectApplicableTheses({
      contextTexts: ["Pedido de adicional de insalubridade apenas."],
      legalArea: "trabalhista",
    }).map((t) => t.key);
    expect(semGratuidade).not.toContain("adi_5766");

    const comGratuidade = selectApplicableTheses({
      contextTexts: ["Reclamante desempregado requer justiça gratuita e honorários sucumbenciais."],
      legalArea: "trabalhista",
    }).map((t) => t.key);
    expect(comGratuidade).toContain("adi_5766");
    expect(comGratuidade).toContain("honorarios_beneficiario_gratuidade");
  });

  it("não aplica teses trabalhistas a outra área", () => {
    expect(
      selectApplicableTheses({ contextTexts: ["justiça gratuita"], legalArea: "civel" }),
    ).toHaveLength(0);
  });

  it("é determinística", () => {
    const input = { contextTexts: ["horas extras e cartões de ponto"], legalArea: "trabalhista" };
    expect(selectApplicableTheses(input)).toEqual(selectApplicableTheses(input));
  });

  it("renderiza bloco com proibição de marcadores de revisão", () => {
    const block = renderThesesForPrompt(
      selectApplicableTheses({ contextTexts: ["justiça gratuita"], legalArea: "trabalhista" }),
    );
    expect(block).toContain("PROIBIDO");
    expect(block).toContain("[REVISAR ...]");
    expect(renderThesesForPrompt([])).toBe("");
  });
});
