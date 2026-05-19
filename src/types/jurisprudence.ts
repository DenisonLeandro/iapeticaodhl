// =============================================================================
// Jurisprudence Search Types
// Story 3.2 — Jurisprudence Search Integration
// =============================================================================

/** Supported court identifiers */
export type CourtId = "STF" | "STJ" | "TJPE";

/** Court metadata for UI display */
export interface CourtInfo {
  id: CourtId;
  name: string;
  fullName: string;
}

/** All supported courts */
export const COURTS: CourtInfo[] = [
  { id: "STF", name: "STF", fullName: "Supremo Tribunal Federal" },
  { id: "STJ", name: "STJ", fullName: "Superior Tribunal de Justiça" },
  { id: "TJPE", name: "TJPE", fullName: "Tribunal de Justiça de Pernambuco" },
];

/** A single jurisprudence result from a tribunal search */
export interface JurisprudenceResult {
  /** Case number (e.g., "RE 123456") */
  caseNumber: string;
  /** Summary / ementa of the decision */
  summary: string;
  /** Date of the decision (ISO string) */
  date: string;
  /** Court that issued the decision */
  court: CourtId;
  /** Link to the full decision */
  link: string;
  /** Reporting justice (optional) */
  relator?: string;
  /** Judging body (optional) */
  orgaoJulgador?: string;
}

/** Parameters for the jurisprudence search */
export interface JurisprudenceSearchParams {
  /** Search query (min 3 characters) */
  query: string;
  /** Courts to search (defaults to all) */
  courts: CourtId[];
  /** Max results per court (default 3) */
  limit?: number;
  /** Offset for pagination (default 0) */
  offset?: number;
}

/** Response from the tribunal-search Edge Function */
export interface JurisprudenceSearchResponse {
  /** Search results from all queried courts */
  results: JurisprudenceResult[];
  /** Warnings for courts that failed (graceful fallback) */
  warnings: JurisprudenceSearchWarning[];
  /** Whether results came from cache */
  fromCache: boolean;
}

/** Warning for a court that failed during search */
export interface JurisprudenceSearchWarning {
  court: CourtId;
  message: string;
}
