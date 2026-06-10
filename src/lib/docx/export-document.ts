// =============================================================================
// DOCX Export — Convert HTML document content to DOCX over the firm's letterhead
// =============================================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  Header,
  Footer,
  ImageRun,
  BorderStyle,
} from "docx";
import { parseHTML, type TextSegment } from "@/lib/document-parser";
import { normalizeToHtml } from "@/lib/ai/normalize-html";
import headerAsset from "@/assets/letterhead-header.png.asset.json";
import footerAsset from "@/assets/letterhead-footer.png.asset.json";

const FONT = "Tahoma";

// Margens (deixam espaço para o timbrado de cabeçalho/rodapé) em DXA (1cm ≈ 567 DXA)
const MARGIN_LEFT = 1701;   // 3cm
const MARGIN_RIGHT = 1134;  // 2cm
const MARGIN_TOP = 2550;    // ~4,5cm
const MARGIN_BOTTOM = 3120; // ~5,5cm
const MARGIN_HEADER = 360;  // ~0,6cm da borda
const MARGIN_FOOTER = 360;

// Largura útil em EMU para escalar as imagens (A4 11906 DXA = 21cm = 793 pt = 7,5" usable)
// docx ImageRun usa pixels (1px ≈ 9525 EMU mas a API aceita transformation em px @ 96dpi).
// 17 cm ≈ 643 px @96dpi — usamos isso para header/footer ocuparem a largura.
const LETTERHEAD_WIDTH_PX = 643;
const HEADER_HEIGHT_PX = Math.round((320 / 1654) * LETTERHEAD_WIDTH_PX); // ~124px
const FOOTER_HEIGHT_PX = Math.round((260 / 1654) * LETTERHEAD_WIDTH_PX); // ~101px

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

/**
 * Export document content (HTML) to a DOCX blob over the firm's letterhead.
 */
export async function exportDocumentToDOCX(
  content: string,
  title: string,
): Promise<Blob> {
  // Carrega imagens do timbrado em paralelo
  const [headerBuf, footerBuf] = await Promise.all([
    fetchAsArrayBuffer(headerAsset.url),
    fetchAsArrayBuffer(footerAsset.url),
  ]);

  const segments = parseHTML(normalizeToHtml(content));
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: title, bold: true, font: FONT, size: 32 }),
      ],
    }),
  );

  let currentRuns: TextRun[] = [];
  let currentType: TextSegment["type"] = "normal";

  function flushParagraph() {
    if (currentRuns.length === 0) return;

    let opts: Record<string, unknown> = {
      children: currentRuns,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 120 },
    };

    if (currentType === "heading1") {
      opts = { ...opts, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240, line: 360 } };
    } else if (currentType === "heading2") {
      opts = { ...opts, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { before: 180, after: 180, line: 360 } };
    } else if (currentType === "heading3") {
      opts = { ...opts, heading: HeadingLevel.HEADING_3, alignment: AlignmentType.LEFT, spacing: { before: 120, after: 120, line: 360 } };
    } else if (currentType === "blockquote") {
      opts = { ...opts, alignment: AlignmentType.JUSTIFIED, indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 6, color: "3B82F6", space: 8 } } };
    } else if (currentType === "listItem") {
      opts = { ...opts, alignment: AlignmentType.LEFT, numbering: { reference: "bullets", level: 0 } };
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

    if (seg.type !== currentType && currentRuns.length > 0) {
      flushParagraph();
    }
    currentType = seg.type;

    const fontSize = currentType === "heading1" ? 32
      : currentType === "heading2" ? 28
      : currentType === "heading3" ? 26
      : 24;

    currentRuns.push(
      new TextRun({
        text: seg.text.trim() + " ",
        bold: seg.bold,
        italics: seg.italic,
        font: FONT,
        size: fontSize,
      }),
    );
  }
  flushParagraph();

  const letterheadHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new ImageRun({
            type: "png",
            data: headerBuf,
            transformation: { width: LETTERHEAD_WIDTH_PX, height: HEADER_HEIGHT_PX },
            altText: { title: "Cabeçalho", description: "Papel timbrado", name: "letterhead-header" },
          }),
        ],
      }),
    ],
  });

  const letterheadFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0 },
        children: [
          new ImageRun({
            type: "png",
            data: footerBuf,
            transformation: { width: LETTERHEAD_WIDTH_PX, height: FOOTER_HEIGHT_PX },
            altText: { title: "Rodapé", description: "Endereços", name: "letterhead-footer" },
          }),
        ],
      }),
    ],
  });

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
          run: { font: FONT, size: 24 },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: FONT },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: FONT },
          paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: FONT },
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
              header: MARGIN_HEADER,
              footer: MARGIN_FOOTER,
            },
          },
        },
        headers: { default: letterheadHeader },
        footers: { default: letterheadFooter },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
