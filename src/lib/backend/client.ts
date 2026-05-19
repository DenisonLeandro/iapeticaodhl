// =============================================================================
// Resilient single-instance Supabase client wrapper.
// - Does NOT statically import the auto-generated client (which throws at
//   import time when env vars are missing, causing a black screen).
// - Resolves the public Lovable Cloud config from import.meta.env at runtime.
// - Lazily creates ONE client instance to keep GoTrue session consistent.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BackendConfigStatus = "ok" | "missing_url" | "missing_key";

function resolveUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (url) return url;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as
    | string
    | undefined;
  if (projectId) return `https://${projectId}.supabase.co`;
  return null;
}

function resolveKey(): string | null {
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  return key || null;
}

export function getBackendConfigStatus(): BackendConfigStatus {
  if (!resolveUrl()) return "missing_url";
  if (!resolveKey()) return "missing_key";
  return "ok";
}

let _client: SupabaseClient<Database> | null = null;

function buildClient(): SupabaseClient<Database> {
  const url = resolveUrl();
  const key = resolveKey();
  if (!url || !key) {
    throw new Error(
      "Lovable Cloud não está configurado: variáveis públicas ausentes."
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_client) _client = buildClient();
  return _client;
}

// Proxy so `import { supabase } from "@/lib/backend/client"` keeps working
// without instantiating the real client at module-import time.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient() as unknown as Record<string, unknown>;
    const value = client[prop as string];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
}) as SupabaseClient<Database>;
