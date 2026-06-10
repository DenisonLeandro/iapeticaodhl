// =============================================================================
// Tribunais brasileiros — fonte única para validação Zod e renderização da UI
// =============================================================================

export type TribunalGroup =
  | "Superiores"
  | "Trabalho (TRTs)"
  | "Federais (TRFs)"
  | "Estaduais (TJs)"
  | "Eleitorais (TREs)"
  | "Militares Estaduais"
  | "Outro";

export interface TribunalOption {
  value: string;
  label: string;
  group: TribunalGroup;
}

const SUPERIORES: TribunalOption[] = [
  { value: "STF", label: "STF — Supremo Tribunal Federal", group: "Superiores" },
  { value: "STJ", label: "STJ — Superior Tribunal de Justiça", group: "Superiores" },
  { value: "TST", label: "TST — Tribunal Superior do Trabalho", group: "Superiores" },
  { value: "TSE", label: "TSE — Tribunal Superior Eleitoral", group: "Superiores" },
  { value: "STM", label: "STM — Superior Tribunal Militar", group: "Superiores" },
];

const TRTS: TribunalOption[] = Array.from({ length: 24 }, (_, i) => {
  const n = i + 1;
  return {
    value: `TRT${n}`,
    label: `TRT${n} — Tribunal Regional do Trabalho da ${n}ª Região`,
    group: "Trabalho (TRTs)" as const,
  };
});

const TRFS: TribunalOption[] = Array.from({ length: 6 }, (_, i) => {
  const n = i + 1;
  return {
    value: `TRF-${n}`,
    label: `TRF-${n} — Tribunal Regional Federal da ${n}ª Região`,
    group: "Federais (TRFs)" as const,
  };
});

const TJ_ESTADOS: Array<[string, string]> = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DFT", "Distrito Federal e Territórios"],
  ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"],
  ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"],
  ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"],
  ["SC", "Santa Catarina"], ["SP", "São Paulo"], ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

const TJS: TribunalOption[] = TJ_ESTADOS.map(([uf, nome]) => ({
  value: `TJ${uf}`,
  label: `TJ${uf} — Tribunal de Justiça ${uf === "DFT" ? "do Distrito Federal e Territórios" : `de ${nome.startsWith("A") || nome.startsWith("E") ? "do" : "de"} ${nome}`}`,
  group: "Estaduais (TJs)" as const,
}));

const TRES: TribunalOption[] = TJ_ESTADOS.map(([uf, nome]) => ({
  value: `TRE-${uf}`,
  label: `TRE-${uf} — Tribunal Regional Eleitoral ${uf === "DFT" ? "do Distrito Federal" : `de ${nome}`}`,
  group: "Eleitorais (TREs)" as const,
}));

const TJMS: TribunalOption[] = [
  { value: "TJM-SP", label: "TJM-SP — Tribunal de Justiça Militar de São Paulo", group: "Militares Estaduais" },
  { value: "TJM-MG", label: "TJM-MG — Tribunal de Justiça Militar de Minas Gerais", group: "Militares Estaduais" },
  { value: "TJM-RS", label: "TJM-RS — Tribunal de Justiça Militar do Rio Grande do Sul", group: "Militares Estaduais" },
];

const OUTRO: TribunalOption = { value: "Outro", label: "Outro", group: "Outro" };

export const TRIBUNAIS: TribunalOption[] = [
  ...SUPERIORES,
  ...TRTS,
  ...TRFS,
  ...TJS,
  ...TRES,
  ...TJMS,
  OUTRO,
];

export const TRIBUNAL_VALUES = TRIBUNAIS.map((t) => t.value) as [string, ...string[]];

/** Conjunto para lookup O(1) no auto-fill. */
const TRIBUNAL_SET = new Set(TRIBUNAL_VALUES);

export function isKnownTribunal(value: string | null | undefined): boolean {
  if (!value) return false;
  return TRIBUNAL_SET.has(value);
}

/** Tribunais agrupados — útil para renderizar `<SelectGroup>`. */
export function getTribunaisByGroup(): Record<TribunalGroup, TribunalOption[]> {
  const groups = {} as Record<TribunalGroup, TribunalOption[]>;
  for (const t of TRIBUNAIS) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t);
  }
  return groups;
}
