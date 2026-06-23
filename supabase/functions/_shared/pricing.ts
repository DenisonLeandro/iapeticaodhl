// =============================================================================
// PR-3.7 — Tabela única de preços (USD por 1M tokens) e estimador de custo
// =============================================================================
// Mantém preços centralizados. Atualizar aqui propaga para todos os logs.
// Valores em USD por 1.000.000 tokens.

export interface ModelPrice {
  input_per_m: number;
  output_per_m: number;
}

export const PRICING: Record<string, ModelPrice> = {
  // Chat / multimodal
  "google/gemini-2.5-flash": { input_per_m: 0.075, output_per_m: 0.30 },
  "google/gemini-2.5-pro": { input_per_m: 1.25, output_per_m: 5.00 },
  "google/gemini-3-flash-preview": { input_per_m: 0.075, output_per_m: 0.30 },
  "google/gemini-3.1-pro-preview": { input_per_m: 1.25, output_per_m: 5.00 },
  "gemini-2.5-flash@multimodal": { input_per_m: 0.075, output_per_m: 0.30 },

  // Embeddings (sem custo de output)
  "google/gemini-embedding-001": { input_per_m: 0.15, output_per_m: 0 },

  // Local / passthrough — sem custo
  "pdfjs-dist@4": { input_per_m: 0, output_per_m: 0 },
  "text-passthrough@v1": { input_per_m: 0, output_per_m: 0 },
};

/** Custo estimado em USD para uma chamada (truncado a 6 casas decimais). */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens = 0,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const usd =
    (inputTokens / 1_000_000) * p.input_per_m +
    (outputTokens / 1_000_000) * p.output_per_m;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
