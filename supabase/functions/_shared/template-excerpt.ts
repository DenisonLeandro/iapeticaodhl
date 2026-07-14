// =============================================================================
// PR-Q1A — Seleção determinística de trechos curtos do template do escritório
// Sem IA, sem I/O. Teto hard de 6.000 caracteres totais.
// =============================================================================

export interface TemplateExcerptCtx {
  main_topic?: string | null;
  piece_type?: string | null;
  legal_area?: string | null;
}

export interface TemplateExcerpt {
  opening: string;
  style: string;
  requests: string;
  total_chars: number;
  found_via: string[];
  has_dados_funcionais: boolean;
  uses_arabic_numbering: boolean;
}

const MAX_OPENING = 1500;
const MAX_STYLE = 2000;
const MAX_REQUESTS = 2500;
const MAX_TOTAL = 6000;

const OPENING_KEYWORDS = [
  "DADOS FUNCIONAIS",
  "PRELIMINARMENTE",
  "JUSTIÇA GRATUITA",
  "JUSTICA GRATUITA",
  "INVERSÃO DO ÔNUS",
  "INVERSAO DO ONUS",
];

const REQUESTS_KEYWORDS = [
  "DOS PEDIDOS",
  "DO PEDIDO",
  "PEDIDOS",
  "Isto posto",
  "Ex positis",
  "Diante do exposto",
  "DIANTE DO EXPOSTO",
  "ANTE O EXPOSTO",
];

/**
 * Verifica se o texto usa numeração arábica no estilo "1.-, 2.-, 2.1.-".
 */
export function detectsArabicNumbering(text: string): boolean {
  if (!text) return false;
  const matches = text.match(/(^|\n)\s*\d+\.\-/g);
  return (matches?.length ?? 0) >= 3;
}

function findAround(
  text: string,
  keywords: string[],
  window: number,
): { start: number; end: number; keyword: string } | null {
  const upper = text.toUpperCase();
  for (const kw of keywords) {
    const idx = upper.indexOf(kw.toUpperCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - Math.floor(window / 4));
      const end = Math.min(text.length, idx + window);
      return { start, end, keyword: kw };
    }
  }
  return null;
}

function slice(text: string, start: number, end: number): string {
  return text.slice(start, end).trim();
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Seleciona trechos curtos e representativos do extracted_text, respeitando
 * limites por categoria e um teto global de 6.000 caracteres.
 */
export function buildTemplateExcerpt(
  extractedText: string | null | undefined,
  ctx: TemplateExcerptCtx = {},
): TemplateExcerpt {
  const empty: TemplateExcerpt = {
    opening: "",
    style: "",
    requests: "",
    total_chars: 0,
    found_via: [],
    has_dados_funcionais: false,
    uses_arabic_numbering: false,
  };
  if (!extractedText || typeof extractedText !== "string") return empty;
  const text = extractedText;
  const found: string[] = [];

  // 1) OPENING — bloco inicial estruturado
  let opening = "";
  const openHit = findAround(text, OPENING_KEYWORDS, MAX_OPENING);
  if (openHit) {
    opening = slice(text, openHit.start, openHit.end);
    found.push(`opening_kw:${openHit.keyword}`);
  } else {
    opening = clip(text.slice(0, MAX_OPENING), MAX_OPENING);
    if (opening) found.push("opening_head_fallback");
  }
  opening = clip(opening, MAX_OPENING);

  // 2) REQUESTS — bloco de pedidos / fecho
  let requests = "";
  const reqHit = findAround(text, REQUESTS_KEYWORDS, MAX_REQUESTS);
  if (reqHit) {
    // do início do match até o final ou +MAX_REQUESTS
    const start = reqHit.start;
    const end = Math.min(text.length, start + MAX_REQUESTS);
    requests = slice(text, start, end);
    found.push(`requests_kw:${reqHit.keyword}`);
  } else {
    const start = Math.max(0, text.length - MAX_REQUESTS);
    requests = clip(text.slice(start), MAX_REQUESTS);
    if (requests) found.push("requests_tail_fallback");
  }
  requests = clip(requests, MAX_REQUESTS);

  // 3) STYLE — trecho de mérito
  let style = "";
  const topic = (ctx.main_topic ?? "").trim();
  if (topic && topic.length >= 3) {
    const topicIdx = text.toLowerCase().indexOf(topic.toLowerCase());
    if (topicIdx >= 0) {
      const start = Math.max(0, topicIdx - 300);
      const end = Math.min(text.length, topicIdx + MAX_STYLE);
      style = slice(text, start, end);
      found.push(`style_topic:${topic.slice(0, 40)}`);
    }
  }
  if (!style) {
    // trecho central: pula opening (se do começo) e para antes de requests
    const from = openHit ? openHit.end : MAX_OPENING;
    const to = reqHit ? reqHit.start : text.length - MAX_REQUESTS;
    if (to > from + 200) {
      style = clip(text.slice(from, from + MAX_STYLE).trim(), MAX_STYLE);
      if (style) found.push("style_middle_fallback");
    }
  }
  style = clip(style, MAX_STYLE);

  // 4) Dedup por overlap simples: se style está totalmente contido em opening
  //    ou requests, zera para não pagar tokens duas vezes.
  if (style && opening.includes(style.slice(0, Math.min(120, style.length)))) {
    style = "";
  }
  if (style && requests.includes(style.slice(0, Math.min(120, style.length)))) {
    style = "";
  }

  // 5) Teto global: cortar style primeiro, depois opening; preservar requests.
  let total = opening.length + style.length + requests.length;
  if (total > MAX_TOTAL) {
    const excess = total - MAX_TOTAL;
    const styleCut = Math.min(style.length, excess);
    style = style.slice(0, Math.max(0, style.length - styleCut));
    total = opening.length + style.length + requests.length;
  }
  if (total > MAX_TOTAL) {
    const excess = total - MAX_TOTAL;
    const openingCut = Math.min(opening.length, excess);
    opening = opening.slice(0, Math.max(0, opening.length - openingCut));
    total = opening.length + style.length + requests.length;
  }
  // Requests jamais é cortado abaixo do teto de sua categoria (já respeitado acima).

  const has_dados_funcionais =
    /DADOS\s+FUNCIONAIS/i.test(opening) ||
    /DADOS\s+FUNCIONAIS/i.test(style) ||
    /DADOS\s+FUNCIONAIS/i.test(text);

  const uses_arabic_numbering = detectsArabicNumbering(text);

  return {
    opening,
    style,
    requests,
    total_chars: opening.length + style.length + requests.length,
    found_via: found,
    has_dados_funcionais,
    uses_arabic_numbering,
  };
}

// =============================================================================
// Auditoria leve determinística — placeholders, seções, estilo
// =============================================================================

export const CRITICAL_PLACEHOLDER_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "[NOME]", re: /\[NOME\]/g },
  { label: "[CPF]", re: /\[CPF\]/g },
  { label: "[ENDEREÇO]", re: /\[ENDERE[ÇC]O\]/g },
  { label: "[INSERIR VALOR]", re: /\[INSERIR\s+VALOR\]/gi },
  { label: "[INSERIR ...]", re: /\[INSERIR[^\]]*\]/gi },
  { label: "[Número ...]", re: /\[N[uú]mero[^\]]*\]/gi },
  { label: "NOME DO ADVOGADO", re: /NOME\s+DO\s+ADVOGADO/g },
  { label: "OAB/[UF]", re: /OAB\s*\/\s*\[UF\]/gi },
];

// Marcadores gerenciados pelo próprio sistema — NÃO são considerados placeholders crus.
// Ficam de fora da auditoria porque representam pendências controladas.
// Ex.: [COMPLETAR ...], [ALERTA:...], [CALCULAR VALOR ...], [CONFIRMAR COM O CLIENTE].

export interface LightAuditResult {
  placeholder_hits: Array<{ label: string; count: number }>;
  placeholder_total: number;
  has_pedidos_section: boolean;
  missing_dados_funcionais: boolean;
  uses_roman_numerals_predominantly: boolean;
  final_requests_use_bullets: boolean;
}

/**
 * Roda auditoria determinística leve na minuta gerada.
 * Não bloqueia geração — apenas gera warnings.
 */
export function runLightDraftAudit(
  content: string,
  templateExcerpt: TemplateExcerpt,
): LightAuditResult {
  const html = content ?? "";

  const placeholder_hits: Array<{ label: string; count: number }> = [];
  let placeholder_total = 0;
  for (const p of CRITICAL_PLACEHOLDER_PATTERNS) {
    const m = html.match(p.re);
    if (m && m.length > 0) {
      placeholder_hits.push({ label: p.label, count: m.length });
      placeholder_total += m.length;
    }
  }

  const has_pedidos_section = /\b(DOS?\s+)?PEDIDOS?\b/i.test(html);

  const missing_dados_funcionais =
    templateExcerpt.has_dados_funcionais &&
    !/DADOS\s+FUNCIONAIS/i.test(html);

  // Romanos predominantes: >= 5 marcadores "I -", "II -", "III -" etc. no início
  // de linha OU seção. Só é warning se o template usa arábico.
  const romanMatches = html.match(/(^|\n)\s*[IVX]{1,4}\s*[\.\-–—]/g) ?? [];
  const arabicMatches = html.match(/(^|\n)\s*\d+\.\-/g) ?? [];
  const uses_roman_numerals_predominantly =
    templateExcerpt.uses_arabic_numbering &&
    romanMatches.length >= 5 &&
    romanMatches.length > arabicMatches.length;

  // Bullets no rol final: procura seção PEDIDOS/DIANTE DO EXPOSTO e conta bullets
  const finalIdx = (() => {
    for (const kw of ["DOS PEDIDOS", "PEDIDOS", "DIANTE DO EXPOSTO", "Isto posto", "ANTE O EXPOSTO"]) {
      const i = html.toUpperCase().indexOf(kw.toUpperCase());
      if (i >= 0) return i;
    }
    return -1;
  })();
  let final_requests_use_bullets = false;
  if (finalIdx >= 0 && templateExcerpt.uses_arabic_numbering) {
    const tail = html.slice(finalIdx);
    const bullets = tail.match(/(^|\n)\s*[-•·]\s+/g) ?? [];
    const numbered = tail.match(/(^|\n)\s*(\d+\.\-|\d+\)|\d+\.)/g) ?? [];
    final_requests_use_bullets = bullets.length >= 3 && bullets.length > numbered.length;
  }

  return {
    placeholder_hits,
    placeholder_total,
    has_pedidos_section,
    missing_dados_funcionais,
    uses_roman_numerals_predominantly,
    final_requests_use_bullets,
  };
}
