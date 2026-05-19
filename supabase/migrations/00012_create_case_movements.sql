-- Migration: 00012_create_case_movements
-- Description: Creates the case_movements table for tracking legal case timeline events,
-- with RLS policies for organization isolation.

-- =============================================================================
-- 1. Table: case_movements
-- Stores timeline movements (movimentações) for legal cases.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.case_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  movement_date   TIMESTAMPTZ NOT NULL,
  type            TEXT NOT NULL
                  CONSTRAINT case_movements_type_check CHECK (
                    type IN ('peticao', 'despacho', 'decisao', 'sentenca', 'audiencia', 'recurso', 'outro')
                  ),
  description     TEXT NOT NULL,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.case_movements IS 'Timeline movements (movimentações) for legal cases';
COMMENT ON COLUMN public.case_movements.type IS 'Movement type: peticao, despacho, decisao, sentenca, audiencia, recurso, outro';
COMMENT ON COLUMN public.case_movements.movement_date IS 'Date and time of the movement';

-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_case_movements_case_id ON public.case_movements (case_id);
CREATE INDEX IF NOT EXISTS idx_case_movements_movement_date ON public.case_movements (movement_date);
CREATE INDEX IF NOT EXISTS idx_case_movements_organization_id ON public.case_movements (organization_id);

-- =============================================================================
-- 3. Enable RLS
-- =============================================================================
ALTER TABLE public.case_movements ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS Policies
-- =============================================================================

-- 4.1 SELECT: organization isolation
CREATE POLICY case_movements_org_isolation ON public.case_movements
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 4.2 INSERT: admin, lawyer, secretary can create movements
CREATE POLICY case_movements_insert ON public.case_movements
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

-- 4.3 UPDATE: admin, lawyer, secretary can update movements in their org
CREATE POLICY case_movements_update ON public.case_movements
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

-- 4.4 DELETE: only admin can delete movements
CREATE POLICY case_movements_delete ON public.case_movements
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
