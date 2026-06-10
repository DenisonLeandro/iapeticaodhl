// =============================================================================
// UUID utilities — normalize optional UUID inputs before DB persistence
// =============================================================================

/**
 * Converte strings vazias / whitespace / undefined em `null`.
 * Postgres rejeita "" como UUID (`invalid input syntax for type uuid: ""`),
 * portanto qualquer coluna UUID opcional deve passar por esta função antes
 * de um insert/update.
 */
export function cleanUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Versão para arrays de UUIDs — remove entradas inválidas/vazias. */
export function cleanUuidArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => cleanUuid(v))
    .filter((v): v is string => v !== null);
  return cleaned.length > 0 ? cleaned : null;
}
