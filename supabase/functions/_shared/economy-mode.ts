// =============================================================================
// Fase 2 · Bloco 1 — helper de "modo econômico" por organização
// =============================================================================
// Lê organizations.llm_config.economy_mode. Default: true (fallback seguro).
// Cache em memória por 60s por organization_id para evitar consultas repetidas
// dentro de uma mesma edge function. Qualquer erro devolve `true` (seguro de
// custo — modelo econômico).
// =============================================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TTL_MS = 60_000;
const cache = new Map<string, { value: boolean; expires_at: number }>();

export async function getEconomyMode(
  admin: SupabaseClient,
  organizationId: string | null | undefined,
): Promise<boolean> {
  if (!organizationId) return true;
  const now = Date.now();
  const hit = cache.get(organizationId);
  if (hit && hit.expires_at > now) return hit.value;

  try {
    const { data, error } = await admin
      .from("organizations")
      .select("llm_config")
      .eq("id", organizationId)
      .maybeSingle();
    if (error) {
      console.warn("economy-mode:lookup_error", error.message);
      cache.set(organizationId, { value: true, expires_at: now + TTL_MS });
      return true;
    }
    const cfg = (data as { llm_config?: Record<string, unknown> } | null)?.llm_config ?? null;
    const raw = cfg && typeof cfg === "object" ? (cfg as Record<string, unknown>).economy_mode : undefined;
    const value = raw === undefined || raw === null ? true : Boolean(raw);
    cache.set(organizationId, { value, expires_at: now + TTL_MS });
    return value;
  } catch (e) {
    console.warn("economy-mode:exception", (e as Error).message);
    cache.set(organizationId, { value: true, expires_at: now + TTL_MS });
    return true;
  }
}

/** Invalidação manual (não usada hoje; disponível para testes futuros). */
export function invalidateEconomyModeCache(orgId?: string): void {
  if (orgId) cache.delete(orgId);
  else cache.clear();
}
