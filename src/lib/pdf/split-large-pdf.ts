// =============================================================================
// PR-3.6 — Split client-side de PDFs grandes em partes processáveis pelo edge.
// O advogado vê um único documento lógico; internamente o sistema o divide para
// caber nos limites do Edge Runtime (CPU/memória/tempo).
//
// PR-3.6 Onda 3 — Rebalanceamento por BYTES (não por páginas iguais).
// Motivo: PDFs com páginas escaneadas concentradas em trechos específicos
// (THAURUS) geravam partes de 9–11 MB no esquema anterior, caindo no fallback
// multimodal (>8 MB) que estoura o IDLE_TIMEOUT de 150 s do Edge Runtime.
// Agora cada parte é montada greedily até atingir o alvo de bytes, com hard
// cap absoluto que mantém todas as partes abaixo de LARGE_PDF_THRESHOLD.
// =============================================================================
import { PDFDocument } from "pdf-lib";

/** Acima deste tamanho, o PDF é dividido em partes. */
export const SPLIT_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

/** Alvo ideal por parte: 4–5 MB.
 *  Encerramos uma parte quando, ao incluir a próxima página, ela passaria
 *  do alvo. Resulta tipicamente em partes entre 3.5 e 5 MB. */
const PART_TARGET_BYTES = 5 * 1024 * 1024; // 5 MB

/** Hard cap absoluto. Nenhuma parte pode ser ≥ que isto, sob pena de cair no
 *  fallback multimodal (LARGE_PDF_THRESHOLD do extract = 8 MB). Mantemos 7 MB
 *  como margem de segurança contra a discrepância entre tamanho medido e
 *  tamanho final ao salvar com diferentes objetos de fonte/recurso. */
const PART_HARD_MAX_BYTES = 7 * 1024 * 1024; // 7 MB

/** Estimativa de overhead fixo por PDF gerado (cross-ref, trailer, fontes). */
const PART_BASE_OVERHEAD_BYTES = 80 * 1024; // ~80 KB

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

/** Mede o peso real (em bytes) de cada página individual do PDF de origem.
 *  Faz isso copiando 1 página de cada vez para um novo PDFDocument e salvando.
 *  Custo: N saves no cliente — aceitável para PDFs jurídicos (≤ alguns
 *  milhares de páginas) e roda apenas uma vez no upload. */
async function measurePageSizes(src: PDFDocument): Promise<number[]> {
  const total = src.getPageCount();
  const sizes: number[] = new Array(total);
  for (let i = 0; i < total; i++) {
    const one = await PDFDocument.create();
    const [copied] = await one.copyPages(src, [i]);
    one.addPage(copied);
    const bytes = await one.save({ useObjectStreams: true });
    sizes[i] = bytes.byteLength;
  }
  return sizes;
}

/** Greedy bin-packing por bytes. Cada bin = uma parte. */
function planParts(pageSizes: number[]): Array<{ start: number; end: number }> {
  const plan: Array<{ start: number; end: number }> = [];
  let start = 0;
  let acc = PART_BASE_OVERHEAD_BYTES;

  for (let i = 0; i < pageSizes.length; i++) {
    const pageSize = pageSizes[i];
    const wouldBe = acc + pageSize;

    if (i === start) {
      // Sempre aceita ao menos 1 página, mesmo que a página sozinha exceda o
      // hard cap (caso patológico — registramos warning na execução).
      acc = wouldBe;
      continue;
    }

    if (wouldBe > PART_HARD_MAX_BYTES || wouldBe > PART_TARGET_BYTES) {
      // Fecha a parte corrente em [start, i) e começa nova com a página i.
      plan.push({ start, end: i });
      start = i;
      acc = PART_BASE_OVERHEAD_BYTES + pageSize;
    } else {
      acc = wouldBe;
    }
  }
  plan.push({ start, end: pageSizes.length });
  return plan;
}

/**
 * Divide um PDF grande em N partes, balanceadas por bytes (não por páginas
 * iguais). Garante que cada parte fique ≤ PART_HARD_MAX_BYTES sempre que
 * possível, com alvo em PART_TARGET_BYTES.
 *
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

  // 1) Mede o peso real de cada página.
  const pageSizes = await measurePageSizes(src);

  // 2) Planeja as partes greedy por bytes.
  const plan = planParts(pageSizes);
  const totalParts = plan.length;

  const baseName = file.name.replace(/\.pdf$/i, "");
  const parts: SplitPart[] = [];

  for (let i = 0; i < totalParts; i++) {
    const { start, end } = plan[i];
    const out = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, k) => start + k);
    const copied = await out.copyPages(src, indices);
    copied.forEach((p) => out.addPage(p));
    const outBytes = await out.save({ useObjectStreams: true });

    if (outBytes.byteLength > PART_HARD_MAX_BYTES) {
      // Diagnóstico — caso patológico: 1 página excede o cap, ou o agrupamento
      // estimado foi otimista. O upload prossegue, mas alertamos no console
      // para o usuário/dev saber que essa parte ainda pode cair no fallback.
      console.warn(
        `[split-large-pdf] parte ${i + 1}/${totalParts} ficou com ` +
          `${(outBytes.byteLength / (1024 * 1024)).toFixed(2)} MB ` +
          `(> ${(PART_HARD_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB hard cap). ` +
          `Páginas ${start + 1}-${end}. Pode acionar fallback multimodal no extract.`,
      );
    }

    // Cópia para ArrayBuffer "puro" para satisfazer o tipo BlobPart do lib DOM.
    const copy = new Uint8Array(outBytes.byteLength);
    copy.set(outBytes);
    const blob = new Blob([copy.buffer], { type: "application/pdf" });
    const partFile = new File(
      [blob],
      `${baseName} — parte ${i + 1} de ${totalParts}.pdf`,
      { type: "application/pdf" },
    );
    parts.push({ file: partFile, partIndex: i + 1, totalParts });
  }

  return { needsSplit: true, parts, logicalName: file.name, totalSize: file.size };
}
