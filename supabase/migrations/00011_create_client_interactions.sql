-- Migration: 00011_create_client_interactions
-- Description: Creates client_interactions and client_files tables for Story 4.2,
-- plus Supabase Storage bucket for client documents.

-- =============================================================================
-- 1. Table: client_interactions
-- Stores interaction/meeting history records for clients.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.client_interactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_date TIMESTAMPTZ NOT NULL,
  subject          TEXT NOT NULL,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_interactions IS 'Client interaction/meeting history records';
COMMENT ON COLUMN public.client_interactions.interaction_date IS 'Date and time of the interaction';
COMMENT ON COLUMN public.client_interactions.subject IS 'Subject or title of the interaction';
COMMENT ON COLUMN public.client_interactions.notes IS 'Detailed notes about the interaction';

-- =============================================================================
-- 2. Indexes for client_interactions
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_client_interactions_client_date
  ON public.client_interactions (client_id, interaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_client_interactions_organization_id
  ON public.client_interactions (organization_id);

-- =============================================================================
-- 3. Trigger: auto-update updated_at on row modification
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_client_interactions_updated_at ON public.client_interactions;
CREATE TRIGGER trigger_client_interactions_updated_at
  BEFORE UPDATE ON public.client_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. Enable RLS for client_interactions
-- =============================================================================
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. RLS Policies for client_interactions
-- =============================================================================

CREATE POLICY client_interactions_select ON public.client_interactions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY client_interactions_insert ON public.client_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY client_interactions_update ON public.client_interactions
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

CREATE POLICY client_interactions_delete ON public.client_interactions
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- =============================================================================
-- 6. Table: client_files
-- Stores metadata for files uploaded for clients (stored in Supabase Storage).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.client_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_type       TEXT,
  file_size       BIGINT,
  storage_path    TEXT NOT NULL,
  description     TEXT,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_files IS 'Metadata for client files stored in Supabase Storage';
COMMENT ON COLUMN public.client_files.storage_path IS 'Path in Supabase Storage bucket client-documents';
COMMENT ON COLUMN public.client_files.file_type IS 'MIME type of the file';
COMMENT ON COLUMN public.client_files.file_size IS 'File size in bytes';

-- =============================================================================
-- 7. Indexes for client_files
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_client_files_client_id
  ON public.client_files (client_id);

CREATE INDEX IF NOT EXISTS idx_client_files_organization_id
  ON public.client_files (organization_id);

-- =============================================================================
-- 8. Enable RLS for client_files
-- =============================================================================
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 9. RLS Policies for client_files
-- =============================================================================

CREATE POLICY client_files_select ON public.client_files
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY client_files_insert ON public.client_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY client_files_delete ON public.client_files
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

-- =============================================================================
-- 10. Supabase Storage Bucket: client-documents
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 11. Storage RLS Policies
-- =============================================================================

-- SELECT (download)
CREATE POLICY "Users can view org client files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- INSERT (upload)
CREATE POLICY "Users can upload org client files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- DELETE
CREATE POLICY "Users can delete org client files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT p.organization_id::text
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);
