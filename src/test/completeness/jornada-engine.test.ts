import { describe, expect, it } from "vitest";
import {
  analyzeJornadaFromText,
  analyzeJornadaSegments,
  requiredIntervalMinutes,
  parseJornadaSegments,
} from "@shared/jornada-engine.ts";
import { detectIncoherences, extractSalaryBases } from "@shared/completeness.ts";

describe("art. 71 da CLT — faixas de intervalo", () => {
  it("não exige intervalo até 4 horas", () => {
    expect(requiredIntervalMinutes(240)).toBe(0);
  });
  it("exige 15 minutos entre 4 e 6 horas", () => {
    expect(requiredIntervalMinutes(300)).toBe(15);
    expect(requiredIntervalMinutes(360)).toBe(15);
  });
  it("exige 1 hora acima de 6 horas", () => {
    expect(requiredIntervalMinutes(361)).toBe(60);
    expect(requiredIntervalMinutes(527)).toBe(60);
  });
});

describe("motor de jornada", () => {
  it("sábado de 06h00 às 12h00 com 15 minutos não gera supressão", () => {
    const a = analyzeJornadaFromText(
      "Aos sábados: das 06h00 às 12h00, com apenas 15 minutos de intervalo para descanso e alimentação.",
    );
    expect(a.detected).toBe(true);
    const sab = a.segments[0];
    expect(sab.day_group).toBe("saturday");
    expect(sab.interval_minutes).toBe(15);
    expect(sab.worked_minutes).toBe(345);
    expect(sab.required_interval_minutes).toBe(15);
    expect(sab.suppressed_interval_minutes).toBe(0);
    expect(a.has_interval_suppression).toBe(false);
  });

  it("07h30 às 17h30 com 1 hora e 13 minutos apura 8h47 e excedente diário", () => {
    const a = analyzeJornadaFromText(
      "De segunda a sexta-feira: das 07h30 às 17h30, com 1 hora e 13 minutos de intervalo.",
    );
    const seg = a.segments[0];
    expect(seg.day_group).toBe("weekdays");
    expect(seg.interval_minutes).toBe(73);
    expect(seg.worked_minutes).toBe(527);
    expect(seg.suppressed_interval_minutes).toBe(0);
    expect(seg.daily_overtime_minutes).toBe(47);
    expect(a.has_overtime).toBe(true);
  });

  it("apura excedente da 44ª semanal somando dias úteis e sábado", () => {
    const a = analyzeJornadaFromText(
      "De segunda a sexta-feira: das 07h30 às 17h30, com 1 hora e 13 minutos de intervalo. Aos sábados: das 06h00 às 12h00, com apenas 15 minutos de intervalo.",
    );
    expect(a.segments).toHaveLength(2);
    expect(a.weekly_worked_minutes).toBe(527 * 5 + 345);
    expect(a.weekly_overtime_minutes).toBe(527 * 5 + 345 - 44 * 60);
  });

  it("jornada de 07h00 às 21h00 com 30 minutos gera supressão de 30 minutos", () => {
    const a = analyzeJornadaFromText(
      "O Reclamante cumpria jornada das 07h00 às 21h00. Gozava de intervalo intrajornada médio de apenas 30 (trinta) minutos.",
    );
    const seg = a.segments[0];
    expect(seg.interval_minutes).toBe(30);
    expect(seg.required_interval_minutes).toBe(60);
    expect(seg.suppressed_interval_minutes).toBe(30);
    expect(a.has_interval_suppression).toBe(true);
  });

  it("define o regime do art. 71 pela data de admissão", () => {
    const segs = parseJornadaSegments("das 08h00 às 18h00, com 1 hora de intervalo");
    expect(analyzeJornadaSegments(segs, { admission_date: "2019-01-10" }).art71_regime).toBe("pos_reforma");
    expect(
      analyzeJornadaSegments(segs, { admission_date: "2010-01-10", termination_date: "2015-05-05" }).art71_regime,
    ).toBe("pre_reforma");
    expect(analyzeJornadaSegments(segs, { admission_date: "2010-01-10" }).art71_regime).toBe("misto");
  });

  it("não detecta jornada quando não há horários narrados", () => {
    expect(analyzeJornadaFromText("O reclamante trabalhava muito.").detected).toBe(false);
  });
});

describe("guarda de coerência fato ↔ pedido", () => {
  it("acusa pedido de intervalo sem supressão apurada", () => {
    const text =
      "Aos sábados: das 06h00 às 12h00, com apenas 15 minutos de intervalo. A supressão de 45 minutos de seu intervalo intrajornada deve ser remunerada como hora extra.";
    const codes = detectIncoherences(text).map((i) => i.code);
    expect(codes).toContain("interval_request_without_suppression");
  });

  it("acusa enunciado errado da faixa do art. 71", () => {
    const codes = detectIncoherences(
      "A jornada aos sábados, superior a 4 horas diárias, exigiria um intervalo mínimo de 1 hora, conforme o art. 71 da CLT.",
    ).map((i) => i.code);
    expect(codes).toContain("interval_threshold_misstated");
  });

  it("acusa adicional de 100% por feriado sem fato narrado", () => {
    const codes = detectIncoherences(
      "requer o pagamento das horas extras com adicional de 50%, e de 100% para os feriados não compensados.",
    ).map((i) => i.code);
    expect(codes).toContain("holiday_request_without_fact");
  });

  it("não acusa feriado quando há fato narrado", () => {
    const codes = detectIncoherences(
      "O reclamante laborava em feriados, sem folga compensatória. Requer adicional de 100% para os feriados.",
    ).map((i) => i.code);
    expect(codes).not.toContain("holiday_request_without_fact");
  });

  it("acusa adicional noturno sem jornada noturna", () => {
    const codes = detectIncoherences(
      "Das 08h00 às 17h00. Requer o pagamento do adicional noturno e da hora noturna reduzida.",
    ).map((i) => i.code);
    expect(codes).toContain("night_shift_request_without_fact");
  });

  it("acusa conflito entre Súmula 340 e integração da parte variável", () => {
    const codes = detectIncoherences(
      "observando-se a Súmula 340 do TST para a parte variável. Requer a integração da média da remuneração variável na base de cálculo das horas extras.",
    ).map((i) => i.code);
    expect(codes).toContain("sumula_340_vs_integration");
  });

  it("acusa duas bases remuneratórias distintas", () => {
    const text =
      "Sua remuneração mensal era de R$ 3.000,00. A multa equivale a um salário do Reclamante, qual seja, R$ 3.300,00.";
    expect(extractSalaryBases(text)).toEqual([3000, 3300]);
    expect(detectIncoherences(text).map((i) => i.code)).toContain("multiple_salary_bases");
  });

  it("não acusa nada em peça coerente", () => {
    const text =
      "De segunda a sexta-feira: das 07h00 às 21h00, com 30 minutos de intervalo. Requer o pagamento do intervalo intrajornada suprimido, com adicional de 50%. Sua remuneração mensal era de R$ 3.000,00.";
    expect(detectIncoherences(text)).toHaveLength(0);
  });
});
