// =============================================================================
// Single source of truth for the Supabase client.
// Re-exports the auto-generated canonical client from @/integrations/supabase/client
// to guarantee ONE GoTrueClient instance across the app (prevents login/session
// race conditions caused by multiple clients sharing localStorage).
// =============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BackendConfigStatus = "ok" | "missing_url" | "missing_key";

export function getBackendConfigStatus(): BackendConfigStatus {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url) return "missing_url";
  if (!key) return "missing_key";
  return "ok";
}

export function getSupabaseClient(): SupabaseClient<Database> {
  return supabase;
}

export { supabase };
