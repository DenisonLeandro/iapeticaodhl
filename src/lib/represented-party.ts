// =============================================================================
// Parte representada pelo escritório — valores técnicos + rótulos de UI
// =============================================================================

export const REPRESENTED_PARTY_VALUES = [
  "autor",
  "reu",
  "recorrente",
  "recorrido",
  "exequente",
  "executado",
  "terceiro",
  "outro",
] as const;

export type RepresentedParty = (typeof REPRESENTED_PARTY_VALUES)[number];

export const REPRESENTED_PARTY_OPTIONS: { value: RepresentedParty; label: string }[] = [
  { value: "autor", label: "Autor / Requerente / Reclamante" },
  { value: "reu", label: "Réu / Requerido / Reclamada" },
  { value: "recorrente", label: "Recorrente" },
  { value: "recorrido", label: "Recorrido" },
  { value: "exequente", label: "Exequente" },
  { value: "executado", label: "Executado" },
  { value: "terceiro", label: "Terceiro interessado" },
  { value: "outro", label: "Outro" },
];

export const REPRESENTED_PARTY_LABELS: Record<RepresentedParty, string> =
  Object.fromEntries(REPRESENTED_PARTY_OPTIONS.map((o) => [o.value, o.label])) as Record<
    RepresentedParty,
    string
  >;

/** Sugestão de polo contrário, apenas para orientar prompts. */
export const OPPOSING_PARTY_HINT: Record<RepresentedParty, string> = {
  autor: "Réu / Requerido / Reclamada",
  reu: "Autor / Requerente / Reclamante",
  recorrente: "Recorrido",
  recorrido: "Recorrente",
  exequente: "Executado",
  executado: "Exequente",
  terceiro: "Demais partes do processo",
  outro: "Polo contrário ao representado",
};

export const DEFAULT_REPRESENTED_PARTY: RepresentedParty = "autor";

export function isRepresentedParty(v: unknown): v is RepresentedParty {
  return typeof v === "string" && (REPRESENTED_PARTY_VALUES as readonly string[]).includes(v);
}
