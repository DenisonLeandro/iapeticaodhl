-- Migration: 00007_create_clients
-- Description: Creates the clients table with RLS for multi-tenant
-- client management (law firm CRM).

-- =============================================================================
-- 1. Table: clients
-- Stores client records scoped to an organization. Supports soft delete
-- via the deleted_at column.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  document_type   TEXT CHECK (document_type IN ('cpf', 'cnpj')),
  document_number TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB,
  notes           TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS 'Client records scoped to an organization, with soft delete support';
COMMENT ON COLUMN public.clients.document_type IS 'Document type: cpf (individual) or cnpj (company)';
COMMENT ON COLUMN public.clients.document_number IS 'Document number (CPF or CNPJ), stored without formatting';
COMMENT ON COLUMN public.clients.address IS 'Structured address: street, number, complement, neighborhood, city, state, zip_code';
COMMENT ON COLUMN public.clients.deleted_at IS 'Soft delete timestamp; NULL means active';

-- =============================================================================
-- 2. Indexes
-- =============================================================================

-- Unique constraint: one document_number per organization (among active records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_document
  ON public.clients (organization_id, document_number)
  WHERE deleted_at IS NULL AND document_number IS NOT NULL;

-- Search uses ILIKE on application layer
-- B-tree index on full_name for basic lookups and ORDER BY
CREATE INDEX IF NOT EXISTS idx_clients_full_name
  ON public.clients (full_name);

-- Index on organization_id for listing clients within an org
CREATE INDEX IF NOT EXISTS idx_clients_organization_id
  ON public.clients (organization_id);

-- Index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_clients_created_at
  ON public.clients (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- 3. Trigger: auto-update updated_at on row modification
-- Reuses the set_updated_at() function created in migration 00001.
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. Enable RLS
-- =============================================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS Policies
-- =============================================================================

-- 5.1 SELECT: Users can see active clients within their organization
CREATE POLICY clients_select ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 5.2 INSERT: Authenticated users can insert clients into their organization
CREATE POLICY clients_insert ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- 5.3 UPDATE: Authenticated users can update clients in their organization
CREATE POLICY clients_update ON public.clients
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

-- 5.4 DELETE: Authenticated users can delete clients in their organization
-- (physical delete — though the app uses soft delete via UPDATE)
CREATE POLICY clients_delete ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- Search uses ILIKE on application layer
-- pg_trgm extension removed for Lovable Cloud compatibility
