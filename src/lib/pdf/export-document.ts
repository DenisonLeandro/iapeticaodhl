// =============================================================================
// PDF Export — Convert HTML document content to PDF with legal margins CNJ/ABNT
// Story 2.3 — Legal Document Editor
// =============================================================================

import jsPDF from "jspdf";
import { parseHTML } from "@/lib/document-parser";

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

  // Title
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  const titleLines = pdf.splitTextToSize(title, usableWidth) as string[];
  titleLines.forEach((line: string) => {
    checkPageBreak(8);
    pdf.text(line, marginLeft, cursorY);
    cursorY += 8;
  });
  cursorY += 4;

  // Parse and render body
  const segments = parseHTML(content);

  for (const seg of segments) {
    if (seg.text === "\n") {
      cursorY += 3;
      continue;
    }

    let segFontSize = fontSize;
    let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal";
    let indent = 0;

    if (seg.type === "heading1") { segFontSize = 16; fontStyle = "bold"; }
    else if (seg.type === "heading2") { segFontSize = 14; fontStyle = "bold"; }
    else if (seg.type === "heading3") { segFontSize = 13; fontStyle = "bold"; }
    else if (seg.type === "blockquote") { indent = 10; fontStyle = "italic"; }
    else if (seg.type === "listItem") { indent = 5; }

    if (seg.bold && seg.italic) fontStyle = "bolditalic";
    else if (seg.bold) fontStyle = "bold";
    else if (seg.italic) fontStyle = "italic";

    pdf.setFontSize(segFontSize);
    pdf.setFont("helvetica", fontStyle);

    const effectiveWidth = usableWidth - indent;
    const lines = pdf.splitTextToSize(seg.text.trim(), effectiveWidth) as string[];

    for (const line of lines) {
      checkPageBreak(lineHeight);
      const x = marginLeft + indent;

      if (seg.type === "blockquote") {
        pdf.setDrawColor(59, 130, 246);
        pdf.setLineWidth(0.5);
        pdf.line(marginLeft + 5, cursorY - 4, marginLeft + 5, cursorY + 1);
      }

      if (seg.type === "listItem" && line === lines[0]) {
        pdf.text("• ", marginLeft, cursorY);
      }

      pdf.text(line, x, cursorY);
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
