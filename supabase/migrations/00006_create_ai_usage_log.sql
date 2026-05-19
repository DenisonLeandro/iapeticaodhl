-- Migration: 00006_create_ai_usage_log
-- Description: Creates the ai_usage_log table for tracking LLM API usage,
-- token consumption and estimated cost per organization. Includes RLS.

-- =============================================================================
-- 1. Table: ai_usage_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  tokens_input    INTEGER NOT NULL DEFAULT 0,
  tokens_output   INTEGER NOT NULL DEFAULT 0,
  cost_estimated  DECIMAL(10,6) NOT NULL DEFAULT 0,
  document_id     UUID NULL REFERENCES public.documents(id) ON DELETE SET NULL,
  prompt_summary  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_log IS 'Tracks LLM API usage per organization for cost monitoring';

-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_organization_id ON public.ai_usage_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_profile_id ON public.ai_usage_log (profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider ON public.ai_usage_log (provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log (created_at);

-- =============================================================================
-- 3. RLS
-- =============================================================================
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see usage logs in their organization
CREATE POLICY ai_usage_log_select_org ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- INSERT: users can insert usage logs in their organization
CREATE POLICY ai_usage_log_insert_org ON public.ai_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- UPDATE: users can update usage logs in their organization
CREATE POLICY ai_usage_log_update_org ON public.ai_usage_log
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- DELETE: users can delete usage logs in their organization
CREATE POLICY ai_usage_log_delete_org ON public.ai_usage_log
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );
