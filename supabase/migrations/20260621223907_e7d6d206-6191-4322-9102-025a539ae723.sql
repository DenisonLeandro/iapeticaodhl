
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.client_files
  ADD COLUMN IF NOT EXISTS parent_file_id uuid REFERENCES public.client_files(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS page_from integer,
  ADD COLUMN IF NOT EXISTS page_to integer,
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS classification_source text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.client_files DROP CONSTRAINT IF EXISTS client_files_processing_status_check;
ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_processing_status_check
  CHECK (processing_status = ANY (ARRAY[
    'pending','processing','analyzed','error',
    'uploaded','extracting','classifying','analyzing','embedding','completed','failed'
  ]));

ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_classification_source_check
  CHECK (classification_source IN ('auto','manual'));

ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_media_type_check
  CHECK (media_type IN ('pdf','image','audio','audio_transcript','text','other'));

CREATE INDEX IF NOT EXISTS idx_client_files_parent_file ON public.client_files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_client_files_processing_status ON public.client_files(organization_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_client_files_content_hash ON public.client_files(organization_id, content_hash) WHERE content_hash IS NOT NULL;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS executive_summary jsonb,
  ADD COLUMN IF NOT EXISTS executive_summary_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS executive_summary_version integer NOT NULL DEFAULT 0;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_approved_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text;

CREATE INDEX IF NOT EXISTS idx_documents_approved_template
  ON public.documents(organization_id) WHERE is_approved_template = true;

CREATE TABLE IF NOT EXISTS public.case_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  message_kind text NOT NULL DEFAULT 'general'
    CHECK (message_kind IN ('general','thesis','strategy','risk','missing_document','lawyer_note','citation')),
  is_pinned boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_chat_messages TO authenticated;
GRANT ALL ON public.case_chat_messages TO service_role;

ALTER TABLE public.case_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_chat_messages_select" ON public.case_chat_messages
  FOR SELECT TO authenticated USING (organization_id = public.get_my_organization_id());
CREATE POLICY "case_chat_messages_insert" ON public.case_chat_messages
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "case_chat_messages_update" ON public.case_chat_messages
  FOR UPDATE TO authenticated USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "case_chat_messages_delete" ON public.case_chat_messages
  FOR DELETE TO authenticated USING (organization_id = public.get_my_organization_id());

CREATE INDEX idx_case_chat_messages_case ON public.case_chat_messages(case_id, created_at);
CREATE INDEX idx_case_chat_messages_pinned ON public.case_chat_messages(case_id) WHERE is_pinned = true;
CREATE INDEX idx_case_chat_messages_org ON public.case_chat_messages(organization_id);

CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.client_files(id) ON DELETE CASCADE,
  source_kind text NOT NULL DEFAULT 'pdf'
    CHECK (source_kind IN ('pdf','audio_transcript','library','note','other')),
  chunk_index integer NOT NULL DEFAULT 0,
  page_from integer,
  page_to integer,
  content text NOT NULL,
  content_hash text,
  embedding vector(1536) NOT NULL,
  token_count integer,
  model_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_embeddings TO authenticated;
GRANT ALL ON public.document_embeddings TO service_role;

ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_embeddings_select" ON public.document_embeddings
  FOR SELECT TO authenticated USING (organization_id = public.get_my_organization_id());
CREATE POLICY "document_embeddings_insert" ON public.document_embeddings
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "document_embeddings_update" ON public.document_embeddings
  FOR UPDATE TO authenticated USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "document_embeddings_delete" ON public.document_embeddings
  FOR DELETE TO authenticated USING (organization_id = public.get_my_organization_id());

CREATE INDEX idx_document_embeddings_case ON public.document_embeddings(case_id);
CREATE INDEX idx_document_embeddings_file ON public.document_embeddings(file_id);
CREATE INDEX idx_document_embeddings_org ON public.document_embeddings(organization_id);
CREATE INDEX idx_document_embeddings_hash ON public.document_embeddings(organization_id, content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_document_embeddings_vec ON public.document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_case_chunks(
  p_case_id uuid,
  p_query_embedding vector(1536),
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid, file_id uuid, source_kind text, page_from int, page_to int,
  content text, similarity float, metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.file_id, e.source_kind, e.page_from, e.page_to, e.content,
         1 - (e.embedding <=> p_query_embedding) AS similarity, e.metadata
  FROM public.document_embeddings e
  WHERE e.case_id = p_case_id
    AND e.organization_id = public.get_my_organization_id()
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_case_chunks(uuid, vector, int) TO authenticated;
