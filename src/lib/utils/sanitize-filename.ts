// =============================================================================
// Sanitize filename para uso como chave do Supabase Storage.
// Storage rejeita caracteres não-ASCII (acentos), espaços e símbolos especiais
// com erro "Invalid key".
// =============================================================================

const MAX_BASENAME_LENGTH = 120;

/**
 * Converte um nome de arquivo qualquer em uma chave segura para o Storage.
 * - Remove acentos (NFKD)
 * - Substitui caracteres não [A-Za-z0-9._-] por "_"
 * - Colapsa underscores repetidos
 * - Preserva a extensão
 */
export function sanitizeStorageKey(name: string): string {
  if (!name || typeof name !== "string") return "file";

  // Separa nome base e extensão (última ocorrência de ".")
  const lastDot = name.lastIndexOf(".");
  let base = lastDot > 0 ? name.slice(0, lastDot) : name;
  let ext = lastDot > 0 ? name.slice(lastDot + 1) : "";

  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[_.-]+|[_.-]+$/g, "");

  base = clean(base).slice(0, MAX_BASENAME_LENGTH);
  ext = clean(ext);

  if (!base) base = "file";
  return ext ? `${base}.${ext}` : base;
}
