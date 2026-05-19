// =============================================================================
// Shared HTML → TextSegment parser for PDF/DOCX export
// =============================================================================

export interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  type: "normal" | "heading1" | "heading2" | "heading3" | "blockquote" | "listItem";
}

/**
 * Parse HTML into text segments preserving basic formatting.
 */
export function parseHTML(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  function walkNode(node: Node, bold = false, italic = false, type: TextSegment["type"] = "normal") {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) {
        segments.push({ text, bold, italic, type });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    let newType = type;
    let newBold = bold;
    let newItalic = italic;

    if (tag === "h1") { newType = "heading1"; newBold = true; }
    else if (tag === "h2") { newType = "heading2"; newBold = true; }
    else if (tag === "h3") { newType = "heading3"; newBold = true; }
    else if (tag === "blockquote") { newType = "blockquote"; newItalic = true; }
    else if (tag === "li") { newType = "listItem"; }
    else if (tag === "strong" || tag === "b") { newBold = true; }
    else if (tag === "em" || tag === "i") { newItalic = true; }

    el.childNodes.forEach((child) => walkNode(child, newBold, newItalic, newType));

    if (["h1", "h2", "h3", "p", "blockquote", "li", "div", "br"].includes(tag)) {
      segments.push({ text: "\n", bold: false, italic: false, type: "normal" });
    }
  }

  tmp.childNodes.forEach((child) => walkNode(child));
  return segments;
}

/**
 * Trigger a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
