-- Migration: 00008_create_cases
-- Description: Creates the cases table for case management with RLS policies.

-- =============================================================================
-- 1. Enum: case_status
-- Defines the possible statuses for a legal case.
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM (
    'active',
    'archived',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Table: cases
-- Stores legal cases (processos judiciais) scoped to an organization.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id         UUID,  -- FK to clients table will be added when clients migration is created
  case_number       TEXT NOT NULL,
  court             TEXT NOT NULL,
  branch            TEXT,
  subject           TEXT,
  status            public.case_status NOT NULL DEFAULT 'active',
  opposing_party    TEXT,
  assigned_to       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cases IS 'Legal cases (processos) scoped to an organization';
COMMENT ON COLUMN public.cases.case_number IS 'Número do processo (formato CNJ)';
COMMENT ON COLUMN public.cases.court IS 'Tribunal (STF, STJ, TST, etc.)';
COMMENT ON COLUMN public.cases.branch IS 'Vara do tribunal';
COMMENT ON COLUMN public.cases.opposing_party IS 'Parte contrária no processo';
COMMENT ON COLUMN public.cases.assigned_to IS 'Advogado responsável pelo caso';

-- =============================================================================
-- 3. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_cases_organization_id ON public.cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON public.cases (client_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases (case_number);

-- =============================================================================
-- 4. Trigger: auto-update updated_at on row modification
-- Reuses the set_updated_at() function created in migration 00001.
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_cases_updated_at ON public.cases;
CREATE TRIGGER trigger_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. Enable RLS
-- =============================================================================
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS Policies
-- =============================================================================

-- 6.1 Organization isolation: all authenticated users can only see cases
-- belonging to their organization.
CREATE POLICY cases_org_isolation ON public.cases
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 6.2 INSERT: admin, lawyer, secretary can create cases
CREATE POLICY cases_insert ON public.cases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'lawyer', 'secretary')
    )
  );

-- 6.3 UPDATE: admin, lawyer, secretary can update cases in their org
CREATE POLICY cases_update ON public.cases
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'lawyer', 'secretary')
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'lawyer', 'secretary')
    )
  );

-- 6.4 DELETE: only admin can delete cases
CREATE POLICY cases_delete ON public.cases
  FOR DELETE
  TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
