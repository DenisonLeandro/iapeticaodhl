// =============================================================================
// Compatibility re-export. The real, single Supabase client instance lives in
// `@/lib/backend/client` (lazy + memoized). Older imports that still point at
// `@/integrations/supabase/client` must NOT create a second `createClient` —
// doing so triggers the "Multiple GoTrueClient instances" warning and causes
// unstable session/realtime/cache behavior. So we just re-export the singleton.
// =============================================================================

export { supabase } from "@/lib/backend/client";
export type { Database } from "./types";
