-- Migration: 00010_create_finances
-- Description: Creates the finances table for financial management (income/expense tracking)
-- with RLS policies for organization-scoped data isolation.

-- =============================================================================
-- 1. Table: finances
-- Stores income and expense records per organization.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.finances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id         UUID,
  client_id       UUID,
  type            TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  category        TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  due_date        DATE NOT NULL,
  payment_date    DATE,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente')),
  payment_method  TEXT,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finances IS 'Financial records (income and expenses) per organization';
COMMENT ON COLUMN public.finances.type IS 'receita = income, despesa = expense';
COMMENT ON COLUMN public.finances.status IS 'pago = paid, pendente = pending';

-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_finances_organization_id ON public.finances (organization_id);
CREATE INDEX IF NOT EXISTS idx_finances_type ON public.finances (type);
CREATE INDEX IF NOT EXISTS idx_finances_status ON public.finances (status);
CREATE INDEX IF NOT EXISTS idx_finances_due_date ON public.finances (due_date);
CREATE INDEX IF NOT EXISTS idx_finances_created_by ON public.finances (created_by);

-- =============================================================================
-- 3. Trigger: auto-update updated_at on row modification
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_finances_updated_at ON public.finances;
CREATE TRIGGER trigger_finances_updated_at
  BEFORE UPDATE ON public.finances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS Policies — organization-scoped isolation
-- =============================================================================

-- 5.1 SELECT: Users can see finances within their own organization
CREATE POLICY finances_select ON public.finances
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 5.2 INSERT: Authenticated users can insert finances for their organization
CREATE POLICY finances_insert ON public.finances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- 5.3 UPDATE: Users can update finances within their organization
CREATE POLICY finances_update ON public.finances
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

-- 5.4 DELETE: Only admins can delete finances in their organization
CREATE POLICY finances_delete ON public.finances
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );
