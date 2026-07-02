// =============================================================================
// PR-4.4B — Sugestão de modelos compatíveis com o caso
// =============================================================================
import { listLegalTemplates } from "@/services/legalTemplates";
import type { LegalTemplate } from "@/types/legalTemplate";
import type { CaseDraftType } from "@/types/caseDraft";

interface MatchContext {
  legal_area?: string | null;
  represented_party?: string | null;
  main_topic?: string | null;
  procedural_stage?: string | null;
  draft_type: CaseDraftType | null;
}

const DRAFT_TYPE_TO_PIECE: Record<CaseDraftType, string[]> = {
  initial_petition: ["Petição inicial"],
  manifestation: ["Manifestação", "Impugnação"],
  extrajudicial_notice: ["Notificação extrajudicial"],
  opinion: ["Parecer"],
  other: [],
};

const AREA_ALIASES: Record<string, string> = {
  trabalhista: "Trabalhista",
  previdenciario: "Previdenciário",
  civel: "Cível",
  consumidor: "Consumidor",
  familia: "Família",
  empresarial: "Empresarial",
  contratos: "Contratos",
  bancario: "Bancário",
  imobiliario: "Imobiliário",
  cobranca_execucao: "Cobrança/Execução",
  responsabilidade_civil: "Responsabilidade civil",
  acidente: "Acidente",
};

function normArea(v?: string | null): string | null {
  if (!v) return null;
  return AREA_ALIASES[v.toLowerCase()] ?? v;
}

export interface RankedTemplate {
  template: LegalTemplate;
  score: number;
  reasons: string[];
}

export async function findMatchingTemplatesForCase(
  ctx: MatchContext,
): Promise<RankedTemplate[]> {
  const all = await listLegalTemplates({ status: "active" });
  const pieces = ctx.draft_type
    ? DRAFT_TYPE_TO_PIECE[ctx.draft_type] ?? []
    : [];
  const area = normArea(ctx.legal_area);

  const ranked = all.map<RankedTemplate>((t) => {
    let score = 0;
    const reasons: string[] = [];
    if (area && t.legal_area && t.legal_area.toLowerCase() === area.toLowerCase()) {
      score += 4;
      reasons.push(`Área: ${t.legal_area}`);
    }
    if (
      pieces.length > 0 &&
      t.piece_type &&
      pieces.some((p) => t.piece_type!.toLowerCase().includes(p.toLowerCase()))
    ) {
      score += 4;
      reasons.push(`Peça: ${t.piece_type}`);
    }
    if (
      ctx.represented_party &&
      t.represented_party &&
      t.represented_party.toLowerCase().includes(
        ctx.represented_party.toLowerCase(),
      )
    ) {
      score += 2;
      reasons.push(`Parte: ${t.represented_party}`);
    }
    if (
      ctx.main_topic &&
      t.main_topic &&
      t.main_topic.toLowerCase().includes(ctx.main_topic.toLowerCase())
    ) {
      score += 2;
      reasons.push(`Tema: ${t.main_topic}`);
    }
    if (
      ctx.procedural_stage &&
      t.procedural_stage &&
      t.procedural_stage.toLowerCase().includes(ctx.procedural_stage.toLowerCase())
    ) {
      score += 1;
      reasons.push(`Fase: ${t.procedural_stage}`);
    }
    return { template: t, score, reasons };
  });

  return ranked
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
