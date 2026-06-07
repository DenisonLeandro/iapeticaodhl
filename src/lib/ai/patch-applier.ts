// =============================================================================
// Patch applier — aplica suggested_patch da IA no HTML da petição
// Fase D
// =============================================================================

import { normalizeToHtml } from "./normalize-html";

export type PatchType = "insert" | "replace" | "delete" | "none";

export interface SuggestedPatch {
  type: PatchType;
  target_section?: string;
  content?: string;
  explanation?: string;
}

export interface ApplyResult {
  ok: boolean;
  content: string;
  warning?: string;
}

function normalizeHeading(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Encontra um <h1|h2|h3|h4> cujo texto coincide com target. */
function findHeading(doc: Document, target: string): HTMLElement | null {
  const targetNorm = normalizeHeading(target);
  if (!targetNorm) return null;
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4")) as HTMLElement[];
  // 1. match exato normalizado
  let found = headings.find((h) => normalizeHeading(h.textContent ?? "") === targetNorm);
  // 2. fallback: contém
  if (!found) {
    found = headings.find((h) => normalizeHeading(h.textContent ?? "").includes(targetNorm));
  }
  return found ?? null;
}

/** Retorna o conjunto de nós do heading até (mas sem incluir) o próximo heading de mesmo ou maior nível. */
function collectSection(start: HTMLElement): HTMLElement[] {
  const level = parseInt(start.tagName.substring(1), 10);
  const out: HTMLElement[] = [start];
  let node = start.nextElementSibling as HTMLElement | null;
  while (node) {
    if (/^H[1-6]$/.test(node.tagName)) {
      const nl = parseInt(node.tagName.substring(1), 10);
      if (nl <= level) break;
    }
    out.push(node);
    node = node.nextElementSibling as HTMLElement | null;
  }
  return out;
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html || "<div></div>", "text/html");
}

function serialize(doc: Document): string {
  return doc.body.innerHTML;
}

/** Insere o trecho ao final do body. Se target_section for dado, usa-o como heading. */
export function applyInsert(currentContent: string, patch: SuggestedPatch): ApplyResult {
  const doc = parse(currentContent);
  const wrapper = doc.createElement("div");
  const headingText = patch.target_section?.trim();
  const body = normalizeToHtml(patch.content ?? "");
  const html =
    (headingText ? `<h2>${headingText}</h2>` : "") + body;
  wrapper.innerHTML = html;
  while (wrapper.firstChild) {
    doc.body.appendChild(wrapper.firstChild);
  }
  return { ok: true, content: serialize(doc) };
}

/** Substitui um tópico inteiro identificado pelo heading target_section. */
export function applyReplace(currentContent: string, patch: SuggestedPatch): ApplyResult {
  if (!patch.target_section?.trim()) {
    return applyInsert(currentContent, patch);
  }
  const doc = parse(currentContent);
  const heading = findHeading(doc, patch.target_section);
  if (!heading) {
    // fallback: insere ao final com aviso
    const r = applyInsert(currentContent, patch);
    return { ...r, warning: `Tópico "${patch.target_section}" não encontrado — trecho adicionado ao final.` };
  }
  const nodes = collectSection(heading);
  const headingTag = heading.tagName.toLowerCase();
  const newWrapper = doc.createElement("div");
  newWrapper.innerHTML =
    `<${headingTag}>${patch.target_section}</${headingTag}>` +
    normalizeToHtml(patch.content ?? "");
  const parent = heading.parentNode!;
  nodes.forEach((n) => parent.removeChild(n));
  // inserir os novos nós na posição original
  const ref = nodes[nodes.length - 1]?.nextSibling ?? null;
  while (newWrapper.firstChild) {
    parent.insertBefore(newWrapper.firstChild, ref);
  }
  return { ok: true, content: serialize(doc) };
}

/** Remove um tópico inteiro identificado pelo heading target_section. */
export function applyDelete(currentContent: string, patch: SuggestedPatch): ApplyResult {
  if (!patch.target_section?.trim()) {
    return { ok: false, content: currentContent, warning: "Não foi possível localizar o trecho para excluir." };
  }
  const doc = parse(currentContent);
  const heading = findHeading(doc, patch.target_section);
  if (!heading) {
    return { ok: false, content: currentContent, warning: `Tópico "${patch.target_section}" não encontrado.` };
  }
  const nodes = collectSection(heading);
  nodes.forEach((n) => n.parentNode?.removeChild(n));
  return { ok: true, content: serialize(doc) };
}

export function applyPatch(currentContent: string, patch: SuggestedPatch): ApplyResult {
  switch (patch.type) {
    case "insert":
      return applyInsert(currentContent, patch);
    case "replace":
      return applyReplace(currentContent, patch);
    case "delete":
      return applyDelete(currentContent, patch);
    default:
      return { ok: false, content: currentContent, warning: "Sem alteração sugerida." };
  }
}
