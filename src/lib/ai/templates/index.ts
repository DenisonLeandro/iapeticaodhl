// =============================================================================
// Template Registry — Barrel Exports
// Story 3.1 — Legal Document Templates
// =============================================================================

export type { LegalTemplate, TemplateCategory, TemplateCategoryInfo } from "./types";
export { TEMPLATE_CATEGORIES } from "./types";

// Individual template exports
export { peticaoInicialTemplate } from "./peticao-inicial";
export { replicaTemplate } from "./replica";
export { alegacoesFinaisTemplate } from "./alegacoes-finais";
export { recursoApelacaoTemplate } from "./recurso-apelacao";
export { embargosDeclaratoriosTemplate } from "./embargos-declaratorios";
export { agravoInstrumentoTemplate } from "./agravo-instrumento";
export { agravoInternoTemplate } from "./agravo-interno";
export { respTemplate } from "./resp";
export { rextTemplate } from "./rext";
export { contratoTemplate } from "./contrato";
export { notificacaoExtrajudicialTemplate } from "./notificacao-extrajudicial";

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

import type { LegalTemplate } from "./types";
import { peticaoInicialTemplate } from "./peticao-inicial";
import { replicaTemplate } from "./replica";
import { alegacoesFinaisTemplate } from "./alegacoes-finais";
import { recursoApelacaoTemplate } from "./recurso-apelacao";
import { embargosDeclaratoriosTemplate } from "./embargos-declaratorios";
import { agravoInstrumentoTemplate } from "./agravo-instrumento";
import { agravoInternoTemplate } from "./agravo-interno";
import { respTemplate } from "./resp";
import { rextTemplate } from "./rext";
import { contratoTemplate } from "./contrato";
import { notificacaoExtrajudicialTemplate } from "./notificacao-extrajudicial";

/** All registered legal document templates */
export const allTemplates: LegalTemplate[] = [
  // Pecas Processuais
  peticaoInicialTemplate,
  replicaTemplate,
  alegacoesFinaisTemplate,
  // Recursos
  recursoApelacaoTemplate,
  embargosDeclaratoriosTemplate,
  agravoInstrumentoTemplate,
  agravoInternoTemplate,
  respTemplate,
  rextTemplate,
  // Contratos
  contratoTemplate,
  // Outros
  notificacaoExtrajudicialTemplate,
];

/**
 * Retrieve a template by its unique id.
 * Returns `undefined` if no template matches.
 */
export function getTemplate(id: string): LegalTemplate | undefined {
  return allTemplates.find((t) => t.id === id);
}

/**
 * Retrieve all templates belonging to a given category.
 */
export function getTemplatesByCategory(
  category: LegalTemplate["category"],
): LegalTemplate[] {
  return allTemplates.filter((t) => t.category === category);
}
