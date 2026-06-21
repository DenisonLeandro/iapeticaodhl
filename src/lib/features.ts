// =============================================================================
// Feature flags — preparação para SaaS modular (Fase 8)
// -----------------------------------------------------------------------------
// Por ora, todos os módulos retornam `true`. Quando a Fase 8 entrar (tabela
// `entitlements` + plano), basta plugar a consulta real aqui — todos os
// pontos de uso continuam funcionando sem refatoração.
// =============================================================================

export type FeatureKey =
  | "module.case_chat"          // Chat Jurídico por Processo
  | "module.rag"                // Busca semântica nos documentos
  | "module.executive_summary"  // Painel de Resumo Executivo do Processo
  | "module.huge_files"         // Upload acima de 200 MB (até 500 MB)
  | "module.senior_review"      // Revisão Sênior (futuro)
  | "module.firm_library"       // Biblioteca do Escritório (futuro)
  | "module.audio_ingestion";   // Áudios/transcrições (futuro)

/**
 * Limite máximo de upload em bytes, dependente da feature flag `module.huge_files`.
 * - Padrão: 200 MB
 * - Com `module.huge_files`: 500 MB
 */
export const UPLOAD_LIMIT_DEFAULT_BYTES = 200 * 1024 * 1024;
export const UPLOAD_LIMIT_HUGE_BYTES = 500 * 1024 * 1024;

/**
 * Stub do has_feature. Hoje retorna `true` para tudo.
 * Na Fase 8 isso passará a consultar `entitlements` por `organization_id`.
 */
export function hasFeature(_organizationId: string | null | undefined, _key: FeatureKey): boolean {
  return true;
}

/**
 * Limite efetivo de upload para a organização atual.
 */
export function getUploadLimitBytes(organizationId: string | null | undefined): number {
  return hasFeature(organizationId, "module.huge_files")
    ? UPLOAD_LIMIT_HUGE_BYTES
    : UPLOAD_LIMIT_DEFAULT_BYTES;
}
