-- Migration: 00013_create_publications
-- Description: Creates the publications table for DJEN publication capture with RLS policies.

-- =============================================================================
-- 1. Enum: publication_source
-- Defines the possible sources for captured publications.
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.publication_source AS ENUM (
    'djen',
    'dje_pe',
    'dje_sp',
    'dje_rj'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Table: publications
-- Stores captured legal publications (publicações do diário de justiça).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.publications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id           UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  lawyer_name       TEXT NOT NULL,
  publication_date  DATE NOT NULL,
  content           TEXT NOT NULL,
  source            public.publication_source NOT NULL DEFAULT 'djen',
  read              BOOLEAN NOT NULL DEFAULT false,
  external_id       TEXT,
  matched_case_number TEXT,
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.publications IS 'Publicações capturadas de diários de justiça eletrônicos';
COMMENT ON COLUMN public.publications.lawyer_name IS 'Nome do advogado encontrado na publicação';
COMMENT ON COLUMN public.publications.publication_date IS 'Data da publicação no diário';
COMMENT ON COLUMN public.publications.content IS 'Texto completo da publicação';
COMMENT ON COLUMN public.publications.source IS 'Fonte da publicação (DJEN, DJE-PE, etc.)';
COMMENT ON COLUMN public.publications.read IS 'Indica se a publicação foi lida pelo usuário';
COMMENT ON COLUMN public.publications.external_id IS 'ID externo para deduplicação';
COMMENT ON COLUMN public.publications.matched_case_number IS 'Número do processo CNJ detectado no conteúdo';

-- =============================================================================
-- 3. Unique constraint for deduplication
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_org_external_id
  ON public.publications (organization_id, external_id)
  WHERE external_id IS NOT NULL;

-- =============================================================================
-- 4. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_publications_org_read
  ON public.publications (organization_id, read);

CREATE INDEX IF NOT EXISTS idx_publications_org_date
  ON public.publications (organization_id, publication_date DESC);

CREATE INDEX IF NOT EXISTS idx_publications_case_id
  ON public.publications (case_id);

-- =============================================================================
-- 5. Enable RLS
-- =============================================================================
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS Policies
-- =============================================================================

-- 6.1 Organization isolation: all authenticated users can only see publications
-- belonging to their organization.
CREATE POLICY publications_org_isolation ON public.publications
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 6.2 INSERT: service_role only (Edge Function inserts publications)
-- No insert policy for authenticated users — publications are created by the scraper.
CREATE POLICY publications_insert_service ON public.publications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6.3 UPDATE: admin, lawyer, secretary can update publications (mark as read)
CREATE POLICY publications_update ON public.publications
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

-- =============================================================================
-- 7. Enable Supabase Realtime
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE publications;
