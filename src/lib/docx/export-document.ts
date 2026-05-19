// =============================================================================
// DOCX Export — Convert HTML document content to DOCX with legal margins CNJ/ABNT
// =============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  Footer,
  PageNumber,
  BorderStyle,
} from "docx";
import { parseHTML, type TextSegment } from "@/lib/document-parser";

// CNJ/ABNT margins in DXA (1cm ≈ 567 DXA)
const MARGIN_LEFT = 1701;   // 3cm
const MARGIN_RIGHT = 1134;  // 2cm
const MARGIN_TOP = 1701;    // 3cm
const MARGIN_BOTTOM = 1134; // 2cm

/**
 * Export document content (HTML) to a DOCX blob with Brazilian legal margins.
 */
export async function exportDocumentToDOCX(
  content: string,
  title: string,
): Promise<Blob> {
  const segments = parseHTML(content);
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: title, bold: true, font: "Arial", size: 32 }),
      ],
    }),
  );

  // Build paragraphs from segments
  let currentRuns: TextRun[] = [];
  let currentType: TextSegment["type"] = "normal";

  function flushParagraph() {
    if (currentRuns.length === 0) return;

    let opts: Record<string, unknown> = {
      children: currentRuns,
      spacing: { line: 360 },
    };

    if (currentType === "heading1") {
      opts = { ...opts, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 240, line: 360 } };
    } else if (currentType === "heading2") {
      opts = { ...opts, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 180, line: 360 } };
    } else if (currentType === "heading3") {
      opts = { ...opts, heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 120, line: 360 } };
    } else if (currentType === "blockquote") {
      opts = { ...opts, indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6", space: 8 } } };
    } else if (currentType === "listItem") {
      opts = { ...opts, numbering: { reference: "bullets", level: 0 } };
    }

    children.push(new Paragraph(opts as ConstructorParameters<typeof Paragraph>[0]));
    currentRuns = [];
  }

  for (const seg of segments) {
    if (seg.text === "\n") {
      flushParagraph();
      currentType = "normal";
      continue;
    }

    // If type changed, flush
    if (seg.type !== currentType && currentRuns.length > 0) {
      flushParagraph();
    }
    currentType = seg.type;

    const fontSize = currentType === "heading1" ? 32
      : currentType === "heading2" ? 28
      : currentType === "heading3" ? 26
      : 24; // 12pt

    currentRuns.push(
      new TextRun({
        text: seg.text.trim() + " ",
        bold: seg.bold,
        italics: seg.italic,
        font: "Arial",
        size: fontSize,
      }),
    );
  }
  flushParagraph();

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 24 },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Página ", PageNumber.CURRENT], font: "Arial", size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
