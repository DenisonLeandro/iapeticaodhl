-- =============================================================================
-- Migration: Create jurisprudence_cache table
-- Story 3.2 — Jurisprudence Search Integration
-- =============================================================================

-- Cache table for tribunal search results (24h TTL)
CREATE TABLE IF NOT EXISTS jurisprudence_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash    TEXT NOT NULL,
  court         TEXT NOT NULL,
  results       JSONB NOT NULL DEFAULT '[]'::jsonb,
  cached_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Index for fast cache lookups by query_hash + court
CREATE INDEX idx_jurisprudence_cache_lookup
  ON jurisprudence_cache (query_hash, court);

-- Index for cleanup of expired entries
CREATE INDEX idx_jurisprudence_cache_expires
  ON jurisprudence_cache (expires_at);

-- ---------------------------------------------------------------------------
-- RLS — Cache is shared (read by any authenticated user, written by service)
-- ---------------------------------------------------------------------------
ALTER TABLE jurisprudence_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read cache entries
CREATE POLICY "Authenticated users can read cache"
  ON jurisprudence_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete cache entries
-- (Edge Functions use service role key)
CREATE POLICY "Service role can manage cache"
  ON jurisprudence_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Auto-cleanup function: delete expired cache entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_jurisprudence_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM jurisprudence_cache
  WHERE expires_at < now();
END;
$$;

-- Schedule cleanup via pg_cron if available (Supabase Pro+)
-- For free tier, lazy deletion in the Edge Function handles this.
-- SELECT cron.schedule(
--   'cleanup-jurisprudence-cache',
--   '0 */6 * * *',  -- every 6 hours
--   $$SELECT cleanup_expired_jurisprudence_cache()$$
-- );
