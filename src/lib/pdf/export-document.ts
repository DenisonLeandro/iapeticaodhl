// =============================================================================
// PDF Export — Convert HTML document content to PDF with legal margins CNJ/ABNT
// Sobre papel timbrado (Denison Leandro Advogados Associados)
// =============================================================================

import jsPDF from "jspdf";
import { parseHTML } from "@/lib/document-parser";
import { normalizeToHtml } from "@/lib/ai/normalize-html";
import letterheadAsset from "@/assets/letterhead-full.jpg.asset.json";

// Cache the letterhead as base64 (data URL) so we only fetch it once per session
let letterheadCache: string | null = null;

async function getLetterheadDataUrl(): Promise<string> {
  if (letterheadCache) return letterheadCache;
  const res = await fetch(letterheadAsset.url);
  const blob = await res.blob();
  letterheadCache = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return letterheadCache;
}

/**
 * Export document content (HTML) to a PDF blob over the firm's letterhead.
 *
 * Margens (deixam espaço para a faixa laranja + logo no topo e endereços no rodapé):
 *  - Esquerda: 30mm, Direita: 20mm, Topo: 45mm, Rodapé: 55mm
 *  - Fonte: Helvetica 12pt, line height 1.5
 */
export async function exportDocumentToPDF(
  content: string,
  title: string,
): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 30;
  const marginRight = 20;
  const marginTop = 45;
  const marginBottom = 55;
  const usableWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 7;
  const fontSize = 12;

  // Pré-carrega o timbrado
  const letterhead = await getLetterheadDataUrl();

  function drawLetterhead() {
    pdf.addImage(letterhead, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  let cursorY = marginTop;
  drawLetterhead();

  function checkPageBreak(needed: number) {
    if (cursorY + needed > pageHeight - marginBottom) {
      pdf.addPage();
      drawLetterhead();
      cursorY = marginTop;
    }
  }

  // Title — centered
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(title, usableWidth) as string[];
  titleLines.forEach((line: string) => {
    checkPageBreak(8);
    pdf.text(line, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 8;
  });
  cursorY += 4;

  // Parse and render body (normalize first to clean fences / escaped tags)
  const segments = parseHTML(normalizeToHtml(content));

  for (const seg of segments) {
    if (seg.text === "\n") {
      cursorY += 3;
      continue;
    }

    let segFontSize = fontSize;
    let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal";
    let indent = 0;
    let align: "left" | "center" | "right" | "justify" = "justify";

    if (seg.type === "heading1") { segFontSize = 14; fontStyle = "bold"; align = "center"; }
    else if (seg.type === "heading2") { segFontSize = 13; fontStyle = "bold"; align = "center"; }
    else if (seg.type === "heading3") { segFontSize = 12; fontStyle = "bold"; align = "left"; }
    else if (seg.type === "blockquote") { indent = 12; fontStyle = "italic"; }
    else if (seg.type === "listItem") { indent = 5; align = "left"; }

    if (seg.bold && seg.italic) fontStyle = "bolditalic";
    else if (seg.bold) fontStyle = "bold";
    else if (seg.italic) fontStyle = "italic";

    pdf.setFontSize(segFontSize);
    pdf.setFont("helvetica", fontStyle);

    const effectiveWidth = usableWidth - indent;
    const lines = pdf.splitTextToSize(seg.text.trim(), effectiveWidth) as string[];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      checkPageBreak(lineHeight);
      const x = marginLeft + indent;

      if (seg.type === "blockquote") {
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.4);
        pdf.line(marginLeft + 5, cursorY - 4, marginLeft + 5, cursorY + 1);
      }

      if (seg.type === "listItem" && i === 0) {
        pdf.text("• ", marginLeft, cursorY);
      }

      if (align === "justify" && i < lines.length - 1 && line.trim().split(/\s+/).length > 1) {
        try {
          pdf.text(line, x, cursorY, { align: "justify", maxWidth: effectiveWidth });
        } catch {
          pdf.text(line, x, cursorY);
        }
      } else if (align === "center") {
        pdf.text(line, pageWidth / 2, cursorY, { align: "center" });
      } else {
        pdf.text(line, x, cursorY);
      }
      cursorY += lineHeight;
    }
  }

  return pdf.output("blob");
}

/**
 * Trigger a browser download of the PDF blob.
 * @deprecated Use downloadBlob from @/lib/document-parser instead
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
