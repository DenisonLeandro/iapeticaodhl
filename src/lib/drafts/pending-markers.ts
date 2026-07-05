// =============================================================================
// PR-4.4B.2B — Detecção e destaque visual dos marcadores pendentes.
// NÃO altera o texto salvo — apenas apresentação.
// Duas passadas:
//   1) regex tipada → classifica (informar/calcular/anexar/confirmar/revisar/jurisprudencia)
//   2) fallback bracket → qualquer [...] remanescente vira "revisar"
// =============================================================================
import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

export type PendingCategory =
  | "informar" | "calcular" | "anexar" | "confirmar" | "revisar" | "jurisprudencia";

export const PENDING_MARKER_REGEX =
  /\[(INFORMAR|PREENCHER|INSERIR|DEFINIR|ATUALIZAR|VERIFICAR|CALCULAR|ANEXAR|CONFIRMAR|REVISAR|JURISPRUD[EÊ]NCIA A INSERIR)[^\]\n]{0,400}\]/gi;

// Fallback: qualquer [ ... ] que ainda não tenha sido capturado.
export const PENDING_MARKER_BRACKET_REGEX = /\[[^\]\n]{2,400}\]/g;

export function classifyMarker(marker: string): PendingCategory {
  const u = marker.toUpperCase();
  if (u.includes("JURISPRUD")) return "jurisprudencia";
  if (u.startsWith("[INFORMAR") || u.startsWith("[PREENCHER") || u.startsWith("[INSERIR") || u.startsWith("[DEFINIR") || u.startsWith("[ATUALIZAR") || u.startsWith("[VERIFICAR")) return "informar";
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

interface Found { index: number; length: number; text: string; category: PendingCategory }

function findAllMarkers(text: string): Found[] {
  const out: Found[] = [];
  if (!text) return out;
  const re1 = new RegExp(PENDING_MARKER_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    out.push({ index: m.index, length: m[0].length, text: m[0], category: classifyMarker(m[0]) });
  }
  const re2 = new RegExp(PENDING_MARKER_BRACKET_REGEX.source, "g");
  while ((m = re2.exec(text)) !== null) {
    const start = m.index, end = m.index + m[0].length;
    const overlap = out.some((f) => !(end <= f.index || start >= f.index + f.length));
    if (overlap) continue;
    if (/^\[\s*\d+\s*\]$/.test(m[0])) continue; // ignore [1] etc.
    out.push({ index: start, length: m[0].length, text: m[0], category: "revisar" });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function countPendingMarkers(text: string): PendingCounts {
  const counts: PendingCounts = { total: 0, informar: 0, calcular: 0, anexar: 0, confirmar: 0, revisar: 0, jurisprudencia: 0 };
  for (const f of findAllMarkers(text)) { counts[f.category] += 1; counts.total += 1; }
  return counts;
}

export function renderWithHighlights(text: string): ReactNode {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let last = 0; let key = 0;
  for (const f of findAllMarkers(text)) {
    if (f.index > last) nodes.push(text.slice(last, f.index));
    nodes.push(createElement("mark", {
      key: `pm-${key++}`,
      className: `pending-marker pending-marker--${f.category}`,
      title: CATEGORY_LABEL[f.category],
    }, f.text));
    last = f.index + f.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return createElement(Fragment, null, ...nodes);
}
