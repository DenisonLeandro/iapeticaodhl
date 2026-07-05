// =============================================================================
// PR-4.4B.2A — Detecção e destaque visual dos marcadores pendentes.
// NÃO altera o texto salvo — apenas apresentação.
// =============================================================================
import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

export type PendingCategory =
  | "informar" | "calcular" | "anexar" | "confirmar" | "revisar" | "jurisprudencia";

export const PENDING_MARKER_REGEX =
  /\[(INFORMAR|CALCULAR|ANEXAR|CONFIRMAR|REVISAR|JURISPRUD[EÊ]NCIA A INSERIR|PREENCHER|INSERIR|ATUALIZAR|VERIFICAR|DEFINIR)[^\]\n]{0,400}\]/gi;

export function classifyMarker(marker: string): PendingCategory {
  const u = marker.toUpperCase();
  if (u.includes("JURISPRUD")) return "jurisprudencia";
  if (u.startsWith("[INFORMAR") || u.startsWith("[PREENCHER") || u.startsWith("[INSERIR") || u.startsWith("[DEFINIR")) return "informar";
  if (u.startsWith("[CALCULAR")) return "calcular";
  if (u.startsWith("[ANEXAR")) return "anexar";
  if (u.startsWith("[CONFIRMAR")) return "confirmar";
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

export function countPendingMarkers(text: string): PendingCounts {
  const counts: PendingCounts = { total: 0, informar: 0, calcular: 0, anexar: 0, confirmar: 0, revisar: 0, jurisprudencia: 0 };
  if (!text) return counts;
  const re = new RegExp(PENDING_MARKER_REGEX.source, "gi");
  const matches = text.match(re) ?? [];
  for (const m of matches) {
    counts[classifyMarker(m)] += 1;
    counts.total += 1;
  }
  return counts;
}

export function renderWithHighlights(text: string): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let last = 0; let key = 0;
  const re = new RegExp(PENDING_MARKER_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const cat = classifyMarker(m[0]);
    nodes.push(createElement("mark", {
      key: `pm-${key++}`,
      className: `pending-marker pending-marker--${cat}`,
      title: CATEGORY_LABEL[cat],
    }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return createElement(Fragment, null, ...nodes);
}
