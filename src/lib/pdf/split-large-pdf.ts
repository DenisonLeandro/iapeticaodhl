// =============================================================================
// PR-3.6 — Split client-side de PDFs grandes em partes processáveis pelo edge.
// O advogado vê um único documento lógico; internamente o sistema o divide para
// caber nos limites do Edge Runtime (CPU/memória/tempo).
// =============================================================================
import { PDFDocument } from "pdf-lib";

/** Acima deste tamanho, o PDF é dividido em partes. Mantém folga vs. o limite
 *  de extração (15 MB no edge) e vs. o caminho rápido do pdfjs (8 MB). */
export const SPLIT_THRESHOLD_BYTES = 7 * 1024 * 1024; // 7 MB

/** Alvo aproximado de tamanho por parte (em bytes). Mantém uma margem segura
 *  abaixo do hard limit do edge runtime. */
const PART_TARGET_BYTES = 6 * 1024 * 1024; // 6 MB

export interface SplitPart {
  file: File;
  partIndex: number; // 1-based
  totalParts: number;
}

export interface SplitResult {
  needsSplit: boolean;
  parts: SplitPart[]; // 1 item quando needsSplit=false
  logicalName: string;
  totalSize: number;
}

/**
 * Divide um PDF grande em N partes aproximadamente do mesmo número de páginas,
 * calibrado para que cada parte fique ≤ PART_TARGET_BYTES (estimado).
 * PDFs não-PDF ou pequenos retornam needsSplit=false e a parte única.
 */
export async function splitPdfIfLarge(file: File): Promise<SplitResult> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf || file.size <= SPLIT_THRESHOLD_BYTES) {
    return {
      needsSplit: false,
      parts: [{ file, partIndex: 1, totalParts: 1 }],
      logicalName: file.name,
      totalSize: file.size,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = src.getPageCount();

  // Estima quantas partes pelo tamanho original; mínimo 2.
  const estParts = Math.max(2, Math.ceil(file.size / PART_TARGET_BYTES));
  const pagesPerPart = Math.max(1, Math.ceil(totalPages / estParts));
  const totalParts = Math.ceil(totalPages / pagesPerPart);

  const baseName = file.name.replace(/\.pdf$/i, "");
  const parts: SplitPart[] = [];

  for (let i = 0; i < totalParts; i++) {
    const startPage = i * pagesPerPart;
    const endPage = Math.min(startPage + pagesPerPart, totalPages);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: endPage - startPage }, (_, k) => startPage + k);
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    const outBytes = await out.save();
    // pdf-lib retorna Uint8Array; embrulhamos em Blob para evitar incompatibilidade
    // de tipos do lib DOM (Uint8Array<ArrayBufferLike> vs ArrayBufferView<ArrayBuffer>).
    const blob = new Blob([outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength)], { type: "application/pdf" });
    const partFile = new File(
      [blob],
      `${baseName} — parte ${i + 1} de ${totalParts}.pdf`,
      { type: "application/pdf" },
    );
    parts.push({ file: partFile, partIndex: i + 1, totalParts });
  }

  return { needsSplit: true, parts, logicalName: file.name, totalSize: file.size };
}
