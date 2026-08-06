// =============================================================================
// PR-4.4B.2B — Destaque visual dos marcadores pendentes (apresentação).
// PR-COMPLETUDE 1 — a DETECÇÃO passou a vir da fonte única compartilhada
// (`@shared/completeness.ts`, mesmo arquivo usado pelas Edge Functions).
// Aqui ficam apenas rótulos e renderização — nenhuma regex duplicada.
// =============================================================================
import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { detectPlaceholders, type PlaceholderOccurrence } from "@shared/completeness.ts";

export type PendingCategory =
  | "informar" | "calcular" | "anexar" | "confirmar" | "revisar" | "jurisprudencia";

export function classifyMarker(marker: string): PendingCategory {
  const u = marker.toUpperCase();
  if (u.includes("JURISPRUD")) return "jurisprudencia";
  if (u.includes("CALCULAR")) return "calcular";
  if (u.includes("ANEXAR")) return "anexar";
  if (u.includes("CONFIRMAR")) return "confirmar";
  if (/INFORMAR|PREENCHER|INSERIR|DEFINIR|ATUALIZAR|VERIFICAR|NOME|OAB|VARA|COMARCA|CPF|CNPJ|ENDERE/.test(u))
    return "informar";
  return "revisar";
}

export interface PendingCounts {
  total: number; informar: number; calcular: number; anexar: number;
  confirmar: number; revisar: number; jurisprudencia: number;
}

export const CATEGORY_LABEL: Record<PendingCategory, string> = {
  informar: "Informar dados",
  calcular: "Calcular valores",
  anexar: "Anexar documentos",
  confirmar: "Confirmar com cliente",
  revisar: "Revisar fundamentos",
  jurisprudencia: "Jurisprudência a inserir",
};

export interface PendingMarker extends PlaceholderOccurrence {
  ui_category: PendingCategory;
}

export function findPendingMarkers(text: string): PendingMarker[] {
  return detectPlaceholders(text ?? "").map((p) => ({ ...p, ui_category: classifyMarker(p.marker) }));
}

export function countPendingMarkers(text: string): PendingCounts {
  const counts: PendingCounts = { total: 0, informar: 0, calcular: 0, anexar: 0, confirmar: 0, revisar: 0, jurisprudencia: 0 };
  for (const f of findPendingMarkers(text)) { counts[f.ui_category] += 1; counts.total += 1; }
  return counts;
}

export function renderWithHighlights(text: string): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let last = 0; let key = 0;
  for (const f of findPendingMarkers(text)) {
    if (f.index > last) nodes.push(text.slice(last, f.index));
    nodes.push(createElement("mark", {
      key: `pm-${key++}`,
      className: `pending-marker pending-marker--${f.ui_category}`,
      title: CATEGORY_LABEL[f.ui_category],
    }, f.marker));
    last = f.index + f.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return createElement(Fragment, null, ...nodes);
}
