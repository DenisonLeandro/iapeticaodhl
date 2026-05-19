// =============================================================================
// Jurisprudence Service — Wraps the tribunal-search Edge Function
// or uses client-side search (Lovable-compatible)
// Story 3.2 — Jurisprudence Search Integration
// =============================================================================

import { supabase } from "@/lib/backend/client";
import { USE_EDGE_FUNCTIONS } from "@/lib/config";
import { clientSearchJurisprudence } from "@/services/tribunal-search";
import type {
  JurisprudenceSearchParams,
  JurisprudenceSearchResponse,
} from "@/types/jurisprudence";

/**
 * Search for jurisprudence across Brazilian courts.
 * When USE_EDGE_FUNCTIONS is true, uses the tribunal-search Edge Function
 * (with server-side caching). When false, calls court APIs directly from
 * the browser (Lovable-compatible, no caching).
 */
export async function searchJurisprudence(
  params: JurisprudenceSearchParams,
): Promise<JurisprudenceSearchResponse> {
  if (!params.query || params.query.trim().length < 3) {
    throw new Error("A consulta deve ter pelo menos 3 caracteres.");
  }

  if (!params.courts || params.courts.length === 0) {
    throw new Error("Selecione pelo menos um tribunal.");
  }

  // Lovable-compatible: call court APIs directly from the browser
  if (!USE_EDGE_FUNCTIONS) {
    return clientSearchJurisprudence({
      query: params.query.trim(),
      courts: params.courts,
      limit: params.limit ?? 3,
      offset: params.offset ?? 0,
    });
  }

  // Edge Function path: server-side with caching and service-role access
  const { data, error } = await supabase.functions.invoke("tribunal-search", {
    body: {
      query: params.query.trim(),
      courts: params.courts,
      limit: params.limit ?? 3,
      offset: params.offset ?? 0,
    },
  });

  if (error) {
    throw new Error(
      `Falha na busca de jurisprudência: ${error.message}`,
    );
  }

  return data as JurisprudenceSearchResponse;
}
