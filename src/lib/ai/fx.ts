// =============================================================================
// PR-3.7 — Conversão USD → BRL (estimativa)
// =============================================================================
// O custo real é armazenado em USD. BRL é apenas estimativa para visualização.
// Sempre rotular como "estimado" na UI. Preparado para virar configuração por
// organização no futuro — por ora, taxa constante documentada aqui.

export const USD_BRL_RATE = 5.5;

/** Converte USD em BRL estimado. */
export function toBRL(usd: number): number {
  return usd * USD_BRL_RATE;
}

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatUSD(usd: number): string {
  return usdFmt.format(usd ?? 0);
}

export function formatBRL(usd: number): string {
  return brlFmt.format(toBRL(usd ?? 0));
}
