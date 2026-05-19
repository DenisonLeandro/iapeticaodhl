-- Migration: 00005_create_documents
-- Description: Creates the documents table for AI-generated legal documents,
-- with ENUMs for document_type, document_status, and llm_provider_type, plus RLS.

-- =============================================================================
-- 1. Enum: document_type
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM (
    'petition',
    'appeal',
    'contract',
    'notification',
    'opinion',
    'power_of_attorney',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. Enum: document_status
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM (
    'draft',
    'review',
    'approved',
    'signed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 3. Enum: llm_provider_type
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.llm_provider_type AS ENUM (
    'openai',
    'gemini',
    'claude'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 4. Table: documents
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id         UUID NULL,
  client_id       UUID NULL,
  type            public.document_type NOT NULL DEFAULT 'other',
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  llm_provider    public.llm_provider_type NOT NULL,
  llm_model       TEXT NOT NULL,
  prompt_used     TEXT NOT NULL DEFAULT '',
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  status          public.document_status NOT NULL DEFAULT 'draft',
  storage_path    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.documents IS 'AI-generated legal documents';

-- =============================================================================
-- 5. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents (type);

-- =============================================================================
-- 6. RLS
-- =============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see documents in their organization
CREATE POLICY documents_select_org ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- INSERT: users can create documents in their organization
CREATE POLICY documents_insert_org ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- UPDATE: users can update documents in their organization
CREATE POLICY documents_update_org ON public.documents
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

-- DELETE: users can delete documents in their organization
CREATE POLICY documents_delete_org ON public.documents
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );
