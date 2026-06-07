// =============================================================================
// normalize-html — Normalize and sanitize AI-generated content for safe render
// =============================================================================

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s",
  "ol", "ul", "li",
  "blockquote",
  "span", "div",
];

const ALLOWED_ATTR = ["style", "class"];

/** Remove ```html ... ``` or ``` ... ``` fences around the whole response. */
export function stripCodeFences(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  // Strip leading ```html or ```
  const fenceStart = /^```(?:html|HTML)?\s*\n?/;
  const fenceEnd = /\n?```\s*$/;
  if (fenceStart.test(s)) {
    s = s.replace(fenceStart, "");
    s = s.replace(fenceEnd, "");
  }
  return s.trim();
}

/** Heuristic: does the string already look like HTML? */
export function looksLikeHtml(raw: string): boolean {
  return /<\/?(p|h[1-6]|strong|em|ul|ol|li|blockquote|br|div|span)\b/i.test(raw);
}

/** Minimal Markdown → HTML for fallback (bold, italics, headings, lists, paragraphs). */
export function markdownToHtml(raw: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let buf: string[] = [];

  const flushPara = () => {
    if (buf.length) {
      let text = escape(buf.join(" "));
      text = text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<p>${text}</p>`);
      buf = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      closeList();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${escape(h[2])}</h${level}>`);
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(trimmed);
    if (li) {
      flushPara();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      let item = escape(li[1])
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
      out.push(`<li>${item}</li>`);
      continue;
    }
    closeList();
    buf.push(trimmed);
  }
  flushPara();
  closeList();
  return out.join("\n");
}

/** Pipeline: strip fences → ensure HTML → return raw HTML (unsanitized). */
export function normalizeToHtml(raw: string): string {
  const stripped = stripCodeFences(raw || "");
  if (!stripped) return "";
  if (looksLikeHtml(stripped)) return stripped;
  return markdownToHtml(stripped);
}

/** Sanitize HTML with a conservative allowlist. */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}

/** Convenience: normalize + sanitize in one call. */
export function toSafeHtml(raw: string): string {
  return sanitizeHtml(normalizeToHtml(raw));
}
