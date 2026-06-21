// Versões canônicas do pipeline (PR-2)
// Alterar aqui + rodar `reprocess-files` é o fluxo oficial para reindexar.
export const EXTRACTION_VERSION = "pdfjs@v1";
export const EXTRACTION_MODEL_PDFJS = "pdfjs-dist@4";
export const EXTRACTION_MODEL_OCR = "google/gemini-2.5-flash";

export const CHUNKING_VERSION = "page-block@v1";
export const CHUNK_MAX_CHARS = 1500;
export const CHUNK_OVERLAP_CHARS = 150;

export const CLASSIFICATION_VERSION = "gemini-flash@v1";
export const CLASSIFICATION_MODEL = "google/gemini-2.5-flash";

export const EMBEDDING_VERSION = "gemini-embedding-001@v1";
export const EMBEDDING_MODEL = "google/gemini-embedding-001";
export const EMBEDDING_DIMS = 3072;
export const EMBEDDING_BATCH_SIZE = 16;

export const PIPELINE_STAGES = [
  "pending",
  "queued",
  "extracting",
  "chunking",
  "classifying",
  "embedding",
  "done",
  "failed",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
