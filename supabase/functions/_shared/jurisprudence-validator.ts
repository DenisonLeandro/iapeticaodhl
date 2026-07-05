// =============================================================================
// PR-4.4B.2 — Validação de jurisprudência sem link.
// - Súmulas e OJs são permitidas sem link (biblioteca conferida).
// - Decisões específicas, acórdãos, RR/AIRR/RE/ARE, ADI/ADPF, temas: exigem link.
// - Se não houver link, substitui a citação por marcador e emite warning.
// - Também detecta expressões vazias ("jurisprudência pacífica" etc.) e marca revisão.
// =============================================================================

export interface JurisprudenceValidationResult {
  content: string;
  warnings: string[];
  replacements: number;
  vague_expressions: number;
}

const URL_RE = /https?:\/\/\S+/i;

// Cita processo/acórdão específico (padrões TST/STF/STJ/TRT/TJ/TRF típicos)
const SPECIFIC_CITATION = new RegExp(
  [
    "\\b(?:RR|AIRR|RE|ARE|AI|REsp|AREsp|HC|MS|RMS|MI|RE|ADI|ADPF|ADC|ADO|Tema)\\s*[-\\s]*\\d[\\d\\.\\-\\/]*",
    "(?:acórdão|acordao)\\s+[nº°]?\\s*\\d[\\d\\.\\-\\/]*",
    "processo\\s+[nº°]?\\s*\\d[\\d\\.\\-\\/]*",
  ].join("|"),
  "gi",
);

const VAGUE_RE =
  /(jurisprudência\s+pacífica|entendimento\s+consolidado|o\s+TST\s+entende|o\s+STF\s+entende|entendimento\s+dos\s+tribunais\s+superiores|conforme\s+entendimento\s+majoritário|é\s+entendimento\s+pacífico)/gi;

const MARKER = "[JURISPRUDÊNCIA A INSERIR — TEMA: revisar tema e inserir fonte oficial]";

export function validateJurisprudence(content: string): JurisprudenceValidationResult {
  const warnings: string[] = [];
  let replacements = 0;
  let vague = 0;

  // Divide em parágrafos preservando quebras
  const paragraphs = content.split(/(\n{2,})/);

  const outParas = paragraphs.map((para) => {
    // Preserva separadores em branco
    if (/^\n{2,}$/.test(para)) return para;

    let updated = para;

    // 1) Citações específicas sem link no mesmo parágrafo
    if (SPECIFIC_CITATION.test(para) && !URL_RE.test(para)) {
      const themeHint = para.replace(/\s+/g, " ").trim().slice(0, 80);
      updated =
        updated.replace(SPECIFIC_CITATION, () => {
          replacements++;
          return MARKER;
        }) +
        (themeHint ? ` [TEMA: ${themeHint.replace(/\s{2,}/g, " ").slice(0, 80)}…]` : "");
      warnings.push(
        `Citação jurisprudencial sem link removida (substituída por marcador). Revisar e inserir fonte oficial. Trecho: "${themeHint.slice(0, 60)}…"`,
      );
    }
    // reset lastIndex (regex global)
    SPECIFIC_CITATION.lastIndex = 0;

    // 2) Expressões vagas → marcador de revisão adjacente
    if (VAGUE_RE.test(para)) {
      const count = (para.match(VAGUE_RE) ?? []).length;
      vague += count;
      updated =
        updated.replace(VAGUE_RE, (m) => `${m} [REVISAR — inserir fonte oficial ou reformular]`);
    }
    VAGUE_RE.lastIndex = 0;

    return updated;
  });

  if (vague > 0) {
    warnings.push(
      `Foram detectadas ${vague} afirmação(ões) jurisprudencial(is) genérica(s) (ex.: "jurisprudência pacífica", "o TST entende"). Marcadas para revisão — inserir fonte oficial ou reformular.`,
    );
  }

  return {
    content: outParas.join(""),
    warnings,
    replacements,
    vague_expressions: vague,
  };
}
