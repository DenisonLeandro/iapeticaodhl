-- Migration: 00001_create_organizations
-- Description: Creates the organizations table and supporting types/triggers
-- for multi-tenant organization management.

-- =============================================================================
-- 1. Enum: organization_plan
-- Defines the subscription tiers available to organizations.
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.organization_plan AS ENUM (
    'free',
    'starter',
    'professional',
    'enterprise'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Function: set_updated_at()
-- Reusable trigger function that sets updated_at to now() on every UPDATE.
-- Used across all tables that have an updated_at column.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. Table: organizations
-- Core multi-tenant table. Each organization represents a law firm or
-- legal department with its own branding, plan, and configuration.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE
                CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  branding      JSONB NOT NULL DEFAULT '{"logo_url": null, "primary_color": "#1e40af", "secondary_color": "#3b82f6"}'::jsonb,
  plan          public.organization_plan NOT NULL DEFAULT 'free',
  features_enabled JSONB NOT NULL DEFAULT '{"ai_legal": true, "finance": false, "whatsapp": false}'::jsonb,
  llm_config    JSONB NOT NULL DEFAULT '{"provider": "openai", "model": "gpt-4o-mini"}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment on table for documentation
COMMENT ON TABLE public.organizations IS 'Multi-tenant organizations (law firms / legal departments)';
COMMENT ON COLUMN public.organizations.slug IS 'URL-friendly unique identifier (lowercase, alphanumeric + hyphens)';
COMMENT ON COLUMN public.organizations.branding IS 'Custom branding: logo_url, primary_color, secondary_color';
COMMENT ON COLUMN public.organizations.features_enabled IS 'Feature flags: ai_legal, finance, whatsapp';
COMMENT ON COLUMN public.organizations.llm_config IS 'LLM configuration: provider, model';

-- =============================================================================
-- 4. Index on slug for fast lookups
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations (slug);

-- =============================================================================
-- 5. Trigger: auto-update updated_at on row modification
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON public.organizations;
CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
