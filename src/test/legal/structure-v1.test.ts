// =============================================================================
// PR-TRAB-STRUCT-1 — Testes do módulo de ordem canônica trabalhista.
// Módulo puro (sem I/O, sem LLM): testável isoladamente no Vitest.
// Import por caminho relativo ao módulo em supabase/functions/_shared.
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  STRUCTURE_VERSION,
  TRABALHISTA_INICIAL_CHAPTERS,
  MAX_MERITO_CHAPTERS,
  getChapter,
  canonicalRank,
  canonicalOrderIndex,
  orderChapters,
  baseSections,
  closingSections,
  meritCatalogForPlan,
  defaultMeritKeys,
  skeletonForFastPrompt,
} from "../../../supabase/functions/_shared/structure/trabalhista-inicial";

const rankOf = (key: string) => canonicalRank(key)!;

describe("catálogo canônico — integridade", () => {
  it("versão estrutural estável", () => {
    expect(STRUCTURE_VERSION).toBe("trabalhista_inicial_v1");
  });

  it("todo final_request_key não-nulo é único entre capítulos que exigem pedido (exceto grupos)", () => {
    // req_jornada é compartilhado propositalmente pelo grupo jornada.
    const seen = new Map<string, number>();
    for (const c of TRABALHISTA_INICIAL_CHAPTERS) {
      if (c.final_request_key) seen.set(c.final_request_key, (seen.get(c.final_request_key) ?? 0) + 1);
    }
    // Só req_jornada pode aparecer mais de uma vez (jornada + intervalo + legacy HE).
    for (const [k, n] of seen) {
      if (n > 1) expect(k).toBe("req_jornada");
    }
  });

  it("ranks estritamente crescentes na ordem de leitura dos não-legados", () => {
    const ranks = TRABALHISTA_INICIAL_CHAPTERS.filter((c) => !c.legacy_alias).map((c) => c.canonical_rank);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });
});

describe("abertura e fechamento — sem drift vs legado", () => {
  it("baseSections mantém chaves e order_index 10-60", () => {
    expect(baseSections()).toEqual([
      { section_key: "enderecamento", section_label: "Endereçamento", order_index: 10 },
      { section_key: "qualificacao", section_label: "Qualificação das partes", order_index: 20 },
      { section_key: "dados_funcionais", section_label: "Dados contratuais e funcionais", order_index: 30 },
      { section_key: "sintese_fatos", section_label: "Síntese dos fatos", order_index: 40 },
      { section_key: "justica_gratuita", section_label: "Gratuidade da justiça", order_index: 50 },
      { section_key: "preliminares", section_label: "Preliminares", order_index: 60 },
    ]);
  });

  it("closingSections mantém chaves e order_index 900-930", () => {
    expect(closingSections()).toEqual([
      { section_key: "rol_pedidos_valores", section_label: "Rol de pedidos com valores individualizados", order_index: 900 },
      { section_key: "valor_causa", section_label: "Valor da causa", order_index: 910 },
      { section_key: "pedido_final", section_label: "Pedido final / requerimentos finais", order_index: 920 },
      { section_key: "fechamento", section_label: "Fechamento", order_index: 930 },
    ]);
  });
});

describe("meritCatalogForPlan — oferta ao LLM", () => {
  const cat = meritCatalogForPlan();

  it("exclui aliases legados", () => {
    expect(cat["merito_horas_extras"]).toBeUndefined();
    expect(cat["merito_intervalo_intrajornada"]).toBeUndefined();
    expect(cat["merito_multas_467_477"]).toBeUndefined();
  });

  it("inclui as chaves novas/consolidadas", () => {
    expect(cat["merito_jornada"]).toBeDefined();
    expect(cat["merito_multa_477"]).toBeDefined();
    expect(cat["merito_multa_467"]).toBeDefined();
    expect(cat["merito_seguro_desemprego"]).toBeDefined();
    expect(cat["merito_vinculo_ctps"]).toBeDefined();
    expect(cat["merito_modalidade_ruptura"]).toBeDefined();
  });

  it("não excede o cap declarado", () => {
    expect(Object.keys(cat).length).toBeLessThanOrEqual(MAX_MERITO_CHAPTERS + 1);
    expect(MAX_MERITO_CHAPTERS).toBeGreaterThanOrEqual(Object.keys(cat).length - 1);
  });

  it("só contém chaves de mérito", () => {
    for (const k of Object.keys(cat)) expect(k.startsWith("merito_")).toBe(true);
  });
});

describe("defaultMeritKeys — fallback conservador", () => {
  it("todas as chaves default existem no catálogo", () => {
    for (const k of defaultMeritKeys()) expect(getChapter(k)).not.toBeNull();
  });
});

describe("ordem canônica (Ordem D do briefing)", () => {
  it("modalidade → verbas → 477 → 467 → seguro → FGTS", () => {
    expect(rankOf("merito_modalidade_ruptura")).toBeLessThan(rankOf("merito_verbas_rescisorias"));
    expect(rankOf("merito_verbas_rescisorias")).toBeLessThan(rankOf("merito_multa_477"));
    expect(rankOf("merito_multa_477")).toBeLessThan(rankOf("merito_multa_467"));
    expect(rankOf("merito_multa_467")).toBeLessThan(rankOf("merito_seguro_desemprego"));
    expect(rankOf("merito_seguro_desemprego")).toBeLessThan(rankOf("merito_fgts"));
  });

  it("dano moral fica próximo do fim do mérito (após os demais méritos)", () => {
    const dano = rankOf("merito_dano_moral");
    for (const k of ["merito_jornada", "merito_adicional_noturno", "merito_insalubridade", "merito_diferencas_salariais"]) {
      expect(dano).toBeGreaterThan(rankOf(k));
    }
  });

  it("mérito fica entre abertura e fechamento", () => {
    expect(rankOf("preliminares")).toBeLessThan(rankOf("merito_verbas_rescisorias"));
    expect(rankOf("merito_dano_moral")).toBeLessThan(rankOf("rol_pedidos_valores"));
  });
});

describe("orderChapters — determinismo e omissão", () => {
  it("ordena por rank, ignora a ordem de entrada (Cenário A/E)", () => {
    const chosen = ["merito_fgts", "merito_verbas_rescisorias", "merito_modalidade_ruptura", "merito_dano_moral"];
    const ordered = orderChapters(chosen).map((c) => c.section_key);
    expect(ordered).toEqual([
      "merito_modalidade_ruptura",
      "merito_verbas_rescisorias",
      "merito_fgts",
      "merito_dano_moral",
    ]);
  });

  it("é idempotente e estável", () => {
    const chosen = ["merito_dano_moral", "merito_jornada", "merito_fgts"];
    const a = orderChapters(chosen).map((c) => c.section_key);
    const b = orderChapters([...chosen].reverse()).map((c) => c.section_key);
    expect(a).toEqual(b);
  });

  it("omissão não altera a posição relativa dos demais", () => {
    const full = orderChapters(["merito_verbas_rescisorias", "merito_fgts", "merito_dano_moral"]).map((c) => c.section_key);
    const partial = orderChapters(["merito_verbas_rescisorias", "merito_dano_moral"]).map((c) => c.section_key);
    expect(partial).toEqual(full.filter((k) => k !== "merito_fgts"));
  });

  it("ignora chaves desconhecidas e deduplica", () => {
    const ordered = orderChapters(["merito_fgts", "chave_inexistente", "merito_fgts"]).map((c) => c.section_key);
    expect(ordered).toEqual(["merito_fgts"]);
  });
});

describe("compatibilidade — aliases legados (minutas antigas / regeneração)", () => {
  it("aliases legados são resolvidos por getChapter/canonicalRank", () => {
    for (const k of ["merito_horas_extras", "merito_intervalo_intrajornada", "merito_multas_467_477"]) {
      const c = getChapter(k);
      expect(c).not.toBeNull();
      expect(c!.legacy_alias).toBe(true);
      expect(canonicalRank(k)).not.toBeNull();
    }
  });

  it("HE legado e intervalo compartilham o grupo jornada e a alínea req_jornada", () => {
    expect(getChapter("merito_horas_extras")!.grouping_key).toBe("jornada");
    expect(getChapter("merito_intervalo_intrajornada")!.grouping_key).toBe("jornada");
    expect(getChapter("merito_jornada")!.grouping_key).toBe("jornada");
    expect(getChapter("merito_horas_extras")!.final_request_key).toBe("req_jornada");
    expect(getChapter("merito_jornada")!.final_request_key).toBe("req_jornada");
  });

  it("uma minuta antiga com chaves legadas ainda ordena corretamente", () => {
    const ordered = orderChapters(["merito_multas_467_477", "merito_horas_extras", "merito_verbas_rescisorias"]).map((c) => c.section_key);
    // multas_467_477 (160) vem antes; verbas (140) antes de multas; HE (240) por último.
    expect(ordered).toEqual(["merito_verbas_rescisorias", "merito_multas_467_477", "merito_horas_extras"]);
  });
});

describe("Cenário B/C — jornada e limites de horas extras (metadado)", () => {
  it("jornada carrega o metadado principal/sucessivo (dado do PR-1)", () => {
    const j = getChapter("merito_jornada")!;
    expect(j.successive).toBeTruthy();
    expect(j.successive!.successive).toMatch(/8ª|44ª/);
  });
});

describe("Cenário D — insalubridade principal/sucessivo (metadado)", () => {
  it("insalubridade: principal salário do autor, sucessivo salário mínimo", () => {
    const ins = getChapter("merito_insalubridade")!;
    expect(ins.successive).toBeTruthy();
    expect(ins.successive!.principal).toMatch(/autor|contratual/i);
    expect(ins.successive!.successive).toMatch(/mínimo/i);
  });
});

describe("canonicalOrderIndex", () => {
  it("retorna rank para chaves conhecidas e null para desconhecidas", () => {
    expect(canonicalOrderIndex("merito_fgts")).toBe(rankOf("merito_fgts"));
    expect(canonicalOrderIndex("nao_existe")).toBeNull();
  });
});

describe("skeletonForFastPrompt", () => {
  const sk = skeletonForFastPrompt();

  it("cita a versão estrutural e a ordem", () => {
    expect(sk).toContain(STRUCTURE_VERSION);
    expect(sk.toLowerCase()).toContain("ordem canônica");
  });

  it("não lista aliases legados como itens separados", () => {
    expect(sk).not.toContain("Do mérito — Horas extras");
    expect(sk).not.toContain("Multas dos arts. 467 e 477");
  });

  it("preserva a ordem: verbas rescisórias antes de FGTS, FGTS antes do rol", () => {
    const iVerbas = sk.indexOf("Verbas rescisórias");
    const iFgts = sk.indexOf("FGTS");
    const iRol = sk.indexOf("Rol de pedidos");
    expect(iVerbas).toBeGreaterThan(-1);
    expect(iVerbas).toBeLessThan(iFgts);
    expect(iFgts).toBeLessThan(iRol);
  });
});
