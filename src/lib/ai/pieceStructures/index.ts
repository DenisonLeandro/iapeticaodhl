// =============================================================================
// PR-1 — Registry de estruturas por tipo de peça (STUB, não usado ativamente)
//
// Este registry define o CONTRATO para futuros PRs do modo "Gerar por capítulos".
// Nenhuma parte do fluxo atual (geração rápida, revisão sênior, aplicação de
// sugestões, exportação, versões) consulta este arquivo. Adicionado apenas para
// congelar o formato antes de introduzir edge functions e UI do modo capítulos.
// =============================================================================

/** Chave estável para identificar o tipo estrutural de uma peça. */
export type PieceTypeKey =
  | "trabalhista_inicial"
  // Reservados para PRs futuros — NÃO implementar agora:
  | "recurso_ordinario"
  | "agravo_peticao"
  | "impugnacao_contestacao"
  | "razoes_finais"
  | (string & {});

/** Blueprint de um capítulo dentro de um tipo de peça. */
export interface SectionBlueprint {
  /** Identificador estável do capítulo (ex.: "enderecamento", "merito_horas_extras"). */
  section_key: string;
  /** Rótulo humano exibido na UI. */
  section_label: string;
  /** Ordem de montagem final. */
  order: number;
  /** Se ausente/pulado bloqueia a montagem. */
  required: boolean;
  /**
   * Se true, o motor pode instanciar múltiplos capítulos deste tipo com
   * sufixos dinâmicos (ex.: `merito_horas_extras`, `merito_fgts`, ...).
   * Usado principalmente em blocos de mérito/pedidos.
   */
  multi_instance?: boolean;
  /** Dicas para o prompt de geração de cada capítulo (uso futuro). */
  prompt_hints?: string;
}

export interface PieceStructure {
  piece_type_key: PieceTypeKey;
  label: string;
  legal_area?: string;
  sections: SectionBlueprint[];
}

// ---------------------------------------------------------------------------
// STUB — Petição inicial trabalhista.
// Serve apenas para validar o formato; não é lido pelo sistema neste PR.
// ---------------------------------------------------------------------------
const trabalhistaInicial: PieceStructure = {
  piece_type_key: "trabalhista_inicial",
  label: "Petição inicial trabalhista",
  legal_area: "Trabalhista",
  sections: [
    { section_key: "enderecamento", section_label: "Endereçamento", order: 10, required: true },
    { section_key: "qualificacao", section_label: "Qualificação das partes", order: 20, required: true },
    { section_key: "dados_funcionais", section_label: "Dados contratuais e funcionais", order: 30, required: true },
    { section_key: "fatos", section_label: "Dos fatos", order: 40, required: true },
    { section_key: "justica_gratuita", section_label: "Da justiça gratuita", order: 50, required: false },
    { section_key: "preliminares", section_label: "Preliminares", order: 60, required: false },
    {
      section_key: "merito",
      section_label: "Do mérito (capítulo por pedido)",
      order: 70,
      required: true,
      multi_instance: true,
      prompt_hints:
        "Um capítulo por pedido; usar sufixo estável (ex.: merito_horas_extras, merito_fgts).",
    },
    { section_key: "rol_pedidos_valores", section_label: "Rol de pedidos com valores", order: 80, required: true },
    { section_key: "valor_da_causa", section_label: "Valor da causa", order: 90, required: true },
    { section_key: "pedido_final", section_label: "Requerimentos finais", order: 100, required: true },
    { section_key: "fechamento", section_label: "Fechamento", order: 110, required: true },
  ],
};

const REGISTRY: Record<string, PieceStructure> = {
  [trabalhistaInicial.piece_type_key]: trabalhistaInicial,
};

export function getPieceStructure(
  key: PieceTypeKey | string | null | undefined,
): PieceStructure | null {
  if (!key) return null;
  return REGISTRY[key] ?? null;
}

export function listPieceStructures(): PieceStructure[] {
  return Object.values(REGISTRY);
}
