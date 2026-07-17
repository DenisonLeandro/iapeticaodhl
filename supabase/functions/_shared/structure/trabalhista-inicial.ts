// =============================================================================
// PR-TRAB-STRUCT-1 — Ordem canônica compartilhada da petição inicial trabalhista.
//
// FONTE ÚNICA da ORDEM/ESTRUTURA de capítulos, consumida tanto pelo modo rápido
// (generate-legal-draft) quanto pelo modo por capítulos (plan-draft-chapters,
// generate-draft-section).
//
// Este arquivo é TS PURO, sem imports (nem Deno, nem URL, nem npm), para poder
// ser importado tanto pelas edge functions (Deno) quanto pelos testes (Vitest).
//
// Escopo PR-1: apenas ordem/estrutura, tipos e helpers puros. NÃO contém
// validação (validateStructure) nem lógica de principal/sucessivo — isso é PR-2.
// Os campos `successive`, `requires_final_request`, `final_request_key` e
// `grouping_key` são apenas DADOS aqui; sua aplicação em regras vem no PR-2.
// =============================================================================

/** Marcador de versão estrutural. Gravado em case_drafts.sources_used.structure. */
export const STRUCTURE_VERSION = "trabalhista_inicial_v1" as const;
export type StructureVersion = typeof STRUCTURE_VERSION;

export type ChapterApplicability = "always" | "if_claim_present" | "optional";

/**
 * Papel do capítulo na montagem:
 * - "opening"      → abertura (vira case_draft_sections no modo capítulos).
 * - "merit"        → mérito (vira case_draft_sections; oferecido ao LLM se não for legacy).
 * - "rol_embedded" → matéria que NÃO vira capítulo próprio; é redigida dentro do
 *                    pedido final/rol. Aparece apenas no esqueleto do modo rápido e
 *                    como referência de ordem do rol. NÃO é criada como seção.
 * - "closing"      → fechamento (rol, valor da causa, pedido final, fechamento).
 */
export type ChapterKind = "opening" | "merit" | "rol_embedded" | "closing";

export interface ChapterSpec {
  section_key: string;
  section_label: string;
  /** ÚNICA fonte de ordenação. No modo capítulos vira order_index. */
  canonical_rank: number;
  applicability: ChapterApplicability;
  kind: ChapterKind;
  /** Indica se o capítulo precisa ter requerimento correspondente no rol. */
  requires_final_request: boolean;
  /** Liga o capítulo à alínea do rol (null p/ estruturais). */
  final_request_key: string | null;
  /**
   * Capítulos com o mesmo grouping_key devem ser consolidados em UMA única
   * alínea no rol (ex.: jornada = horas extras + intervalo intrajornada).
   * Consumido pelas regras do PR-2; aqui é apenas dado.
   */
  grouping_key?: string;
  /**
   * Chave legada reconhecida para compatibilidade (minutas antigas /
   * regeneração individual). NÃO é oferecida ao LLM para minutas novas, mas é
   * resolvida por getChapter/canonicalRank para ordenar corretamente.
   */
  legacy_alias?: boolean;
  /** Metadado principal/sucessivo — DADO apenas no PR-1 (aplicado no PR-2). */
  successive?: {
    principal: string;
    successive: string;
    condition?: string;
  };
}

/** Estrutura gravada em case_drafts.sources_used.structure (sem migration). */
export interface StructureMarker {
  version: StructureVersion;
  canonical_order_applied: boolean;
  fallback_reason: string | null;
}

// -----------------------------------------------------------------------------
// Catálogo canônico ordenado.
// Abertura e fechamento mantêm EXATAMENTE as mesmas section_keys, section_labels
// e ranks já usados por plan-draft-chapters (order_index 10-60 e 900-930), para
// não introduzir drift no assemble nem na UI.
// -----------------------------------------------------------------------------
export const TRABALHISTA_INICIAL_CHAPTERS: readonly ChapterSpec[] = [
  // ---- Abertura (order_index 10-60, inalterados) ----
  { section_key: "enderecamento", section_label: "Endereçamento", canonical_rank: 10, applicability: "always", kind: "opening", requires_final_request: false, final_request_key: null },
  { section_key: "qualificacao", section_label: "Qualificação das partes", canonical_rank: 20, applicability: "always", kind: "opening", requires_final_request: false, final_request_key: null },
  { section_key: "dados_funcionais", section_label: "Dados contratuais e funcionais", canonical_rank: 30, applicability: "always", kind: "opening", requires_final_request: false, final_request_key: null },
  { section_key: "sintese_fatos", section_label: "Síntese dos fatos", canonical_rank: 40, applicability: "always", kind: "opening", requires_final_request: false, final_request_key: null },
  { section_key: "justica_gratuita", section_label: "Gratuidade da justiça", canonical_rank: 50, applicability: "if_claim_present", kind: "opening", requires_final_request: true, final_request_key: "req_justica_gratuita" },
  { section_key: "preliminares", section_label: "Preliminares", canonical_rank: 60, applicability: "if_claim_present", kind: "opening", requires_final_request: true, final_request_key: "req_preliminares" },

  // ---- Mérito (ordem jurídica canônica, ranks 100-380) ----
  { section_key: "merito_vinculo_ctps", section_label: "Do mérito — Reconhecimento de vínculo e retificação da CTPS", canonical_rank: 100, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_vinculo_ctps" },
  { section_key: "merito_modalidade_ruptura", section_label: "Do mérito — Modalidade de ruptura contratual", canonical_rank: 120, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_modalidade_ruptura" },
  { section_key: "merito_verbas_rescisorias", section_label: "Do mérito — Verbas rescisórias", canonical_rank: 140, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_verbas_rescisorias" },
  { section_key: "merito_multa_477", section_label: "Do mérito — Multa do art. 477 da CLT", canonical_rank: 160, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_multa_477" },
  { section_key: "merito_multa_467", section_label: "Do mérito — Multa do art. 467 da CLT", canonical_rank: 180, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_multa_467" },
  { section_key: "merito_seguro_desemprego", section_label: "Do mérito — Seguro-desemprego e guias rescisórias", canonical_rank: 200, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_seguro_desemprego" },
  { section_key: "merito_fgts", section_label: "Do mérito — FGTS", canonical_rank: 220, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_fgts" },
  {
    section_key: "merito_jornada",
    section_label: "Do mérito — Jornada, horas extras e intervalo intrajornada",
    canonical_rank: 240,
    applicability: "if_claim_present",
    kind: "merit",
    requires_final_request: true,
    final_request_key: "req_jornada",
    grouping_key: "jornada",
    successive: {
      principal: "jornada/limite especial comprovado (norma coletiva, contrato, escala ou categoria)",
      successive: "excedentes da 8ª diária e da 44ª semanal",
      condition: "usar limite inferior como principal apenas quando houver fonte identificada; caso contrário, 8ª/44ª direto",
    },
  },
  { section_key: "merito_adicional_noturno", section_label: "Do mérito — Adicional noturno", canonical_rank: 260, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_adicional_noturno" },
  {
    section_key: "merito_insalubridade",
    section_label: "Do mérito — Insalubridade",
    canonical_rank: 280,
    applicability: "if_claim_present",
    kind: "merit",
    requires_final_request: true,
    final_request_key: "req_insalubridade",
    successive: {
      principal: "base de cálculo sobre o salário contratual / salário do autor",
      successive: "base de cálculo sobre o salário mínimo",
    },
  },
  { section_key: "merito_periculosidade", section_label: "Do mérito — Periculosidade", canonical_rank: 300, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_periculosidade" },
  { section_key: "merito_diferencas_salariais", section_label: "Do mérito — Diferenças salariais, acúmulo e equiparação", canonical_rank: 320, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_diferencas_salariais" },
  { section_key: "merito_ferias", section_label: "Do mérito — Férias", canonical_rank: 340, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_ferias" },
  { section_key: "merito_pedidos_especiais", section_label: "Do mérito — Pedidos especiais do caso", canonical_rank: 360, applicability: "optional", kind: "merit", requires_final_request: true, final_request_key: "req_pedidos_especiais" },
  { section_key: "merito_dano_moral", section_label: "Do mérito — Dano moral", canonical_rank: 380, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_dano_moral" },

  // ---- Legacy aliases (reconhecidos; NÃO oferecidos para minutas novas) ----
  { section_key: "merito_horas_extras", section_label: "Do mérito — Horas extras", canonical_rank: 240, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_jornada", grouping_key: "jornada", legacy_alias: true },
  { section_key: "merito_intervalo_intrajornada", section_label: "Do mérito — Intervalo intrajornada", canonical_rank: 245, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_jornada", grouping_key: "jornada", legacy_alias: true },
  { section_key: "merito_multas_467_477", section_label: "Do mérito — Multas dos arts. 467 e 477 da CLT", canonical_rank: 160, applicability: "if_claim_present", kind: "merit", requires_final_request: true, final_request_key: "req_multas_467_477", legacy_alias: true },

  // ---- Matérias do rol final (NÃO viram capítulo próprio) ----
  { section_key: "exibicao_documentos", section_label: "Exibição de documentos e ônus da prova", canonical_rank: 400, applicability: "always", kind: "rol_embedded", requires_final_request: true, final_request_key: "req_exibicao_documentos" },
  { section_key: "honorarios", section_label: "Honorários advocatícios", canonical_rank: 420, applicability: "always", kind: "rol_embedded", requires_final_request: true, final_request_key: "req_honorarios" },
  { section_key: "valor_estimativa_nao_limitacao", section_label: "Estimativa dos valores e não limitação da condenação", canonical_rank: 440, applicability: "always", kind: "rol_embedded", requires_final_request: true, final_request_key: "req_nao_limitacao" },

  // ---- Fechamento (order_index 900-930, inalterados) ----
  { section_key: "rol_pedidos_valores", section_label: "Rol de pedidos com valores individualizados", canonical_rank: 900, applicability: "always", kind: "closing", requires_final_request: false, final_request_key: null },
  { section_key: "valor_causa", section_label: "Valor da causa", canonical_rank: 910, applicability: "always", kind: "closing", requires_final_request: false, final_request_key: null },
  { section_key: "pedido_final", section_label: "Pedido final / requerimentos finais", canonical_rank: 920, applicability: "always", kind: "closing", requires_final_request: false, final_request_key: null },
  { section_key: "fechamento", section_label: "Fechamento", canonical_rank: 930, applicability: "always", kind: "closing", requires_final_request: false, final_request_key: null },
];

/** Máximo de capítulos de mérito num plano (acomoda o catálogo expandido). */
export const MAX_MERITO_CHAPTERS = 14;

// -----------------------------------------------------------------------------
// Índice interno (não exportado) para lookup O(1) por section_key.
// -----------------------------------------------------------------------------
const BY_KEY: Record<string, ChapterSpec> = (() => {
  const m: Record<string, ChapterSpec> = {};
  for (const c of TRABALHISTA_INICIAL_CHAPTERS) m[c.section_key] = c;
  return m;
})();

// -----------------------------------------------------------------------------
// Helpers PUROS (sem I/O, sem LLM, determinísticos).
// -----------------------------------------------------------------------------

/** Retorna a spec do capítulo (inclui aliases legados) ou null. */
export function getChapter(section_key: string): ChapterSpec | null {
  return BY_KEY[section_key] ?? null;
}

/** Rank canônico da chave (inclui aliases). null se desconhecida. */
export function canonicalRank(section_key: string): number | null {
  const c = BY_KEY[section_key];
  return c ? c.canonical_rank : null;
}

/**
 * order_index canônico para o modo por capítulos (== canonical_rank).
 * null se a chave for desconhecida (caller decide o fallback).
 */
export function canonicalOrderIndex(section_key: string): number | null {
  return canonicalRank(section_key);
}

/**
 * Dado um conjunto de section_keys presentes, retorna as specs correspondentes
 * ordenadas por canonical_rank. Chaves desconhecidas são ignoradas (o caller as
 * trata). Omissões NÃO alteram a posição relativa das demais.
 */
export function orderChapters(chosenKeys: readonly string[]): ChapterSpec[] {
  const seen = new Set<string>();
  const out: ChapterSpec[] = [];
  for (const k of chosenKeys) {
    if (seen.has(k)) continue;
    const c = BY_KEY[k];
    if (!c) continue;
    seen.add(k);
    out.push(c);
  }
  out.sort((a, b) => a.canonical_rank - b.canonical_rank);
  return out;
}

/** Abertura do modo por capítulos (kind==="opening"), em ordem. */
export function baseSections(): Array<{ section_key: string; section_label: string; order_index: number }> {
  return TRABALHISTA_INICIAL_CHAPTERS
    .filter((c) => c.kind === "opening")
    .slice()
    .sort((a, b) => a.canonical_rank - b.canonical_rank)
    .map((c) => ({ section_key: c.section_key, section_label: c.section_label, order_index: c.canonical_rank }));
}

/** Fechamento do modo por capítulos (kind==="closing"), em ordem. */
export function closingSections(): Array<{ section_key: string; section_label: string; order_index: number }> {
  return TRABALHISTA_INICIAL_CHAPTERS
    .filter((c) => c.kind === "closing")
    .slice()
    .sort((a, b) => a.canonical_rank - b.canonical_rank)
    .map((c) => ({ section_key: c.section_key, section_label: c.section_label, order_index: c.canonical_rank }));
}

/**
 * Catálogo de mérito oferecido ao LLM no plano (exclui aliases legados).
 * Record<section_key, section_label> em ordem canônica.
 */
export function meritCatalogForPlan(): Record<string, string> {
  const out: Record<string, string> = {};
  TRABALHISTA_INICIAL_CHAPTERS
    .filter((c) => c.kind === "merit" && !c.legacy_alias)
    .slice()
    .sort((a, b) => a.canonical_rank - b.canonical_rank)
    .forEach((c) => { out[c.section_key] = c.section_label; });
  return out;
}

/** Fallback conservador de méritos quando não há sinal para escolher. */
export function defaultMeritKeys(): string[] {
  return [
    "merito_verbas_rescisorias",
    "merito_multa_477",
    "merito_multa_467",
    "merito_fgts",
  ];
}

/**
 * Esqueleto curto e ordenado para o prompt do MODO RÁPIDO.
 * Inclui todas as matérias na ordem canônica (a peça rápida é um documento
 * único), mas mantém a REDAÇÃO livre dentro de cada capítulo.
 */
export function skeletonForFastPrompt(): string {
  const ordered = TRABALHISTA_INICIAL_CHAPTERS
    .filter((c) => !c.legacy_alias)
    .slice()
    .sort((a, b) => a.canonical_rank - b.canonical_rank);
  const lines = ordered.map((c, i) => {
    const opt = c.applicability === "always" ? "" : " (se aplicável)";
    return `${i + 1}) ${c.section_label}${opt}`;
  });
  return [
    `Ordem canônica de capítulos (${STRUCTURE_VERSION}) — mantenha ESTA ordem, omitindo os inaplicáveis SEM alterar a posição relativa dos demais. A redação DENTRO de cada capítulo é livre.`,
    lines.join("; ") + ".",
    "Observações: jornada, horas extras e intervalo intrajornada ficam no MESMO capítulo, com uma única alínea correspondente no rol; dano moral fica próximo do final do mérito; o rol de pedidos segue a MESMA ordem dos capítulos.",
  ].join("\n");
}
