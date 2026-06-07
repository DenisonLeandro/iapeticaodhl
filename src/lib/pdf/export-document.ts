// =============================================================================
// PDF Export — Convert HTML document content to PDF with legal margins CNJ/ABNT
// Story 2.3 — Legal Document Editor
// =============================================================================

import jsPDF from "jspdf";
import { parseHTML } from "@/lib/document-parser";
import { normalizeToHtml } from "@/lib/ai/normalize-html";

/**
 * Export document content (HTML) to a PDF blob with Brazilian legal margins.
 *
 * Margins per ABNT/CNJ:
 *  - Left: 30mm, Right: 20mm, Top: 30mm, Bottom: 20mm
 *  - Font: Helvetica 12pt, line height 1.5
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
  const marginTop = 30;
  const marginBottom = 20;
  const usableWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 7;
  const fontSize = 12;

  let cursorY = marginTop;

  function addPageNumber() {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Página ${pdf.getNumberOfPages()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
  }

  function checkPageBreak(needed: number) {
    if (cursorY + needed > pageHeight - marginBottom) {
      addPageNumber();
      pdf.addPage();
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

      // Justify only full body lines (not last line of paragraph, not headings/lists)
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


  addPageNumber();
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
