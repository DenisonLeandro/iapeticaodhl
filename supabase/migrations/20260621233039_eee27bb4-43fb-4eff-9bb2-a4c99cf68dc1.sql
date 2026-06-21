
-- ============================================================
-- PR-2: Versionamento + fila de processamento + chunks
-- ============================================================

-- 1) client_files: versionamento por etapa
ALTER TABLE public.client_files
  ADD COLUMN IF NOT EXISTS extraction_version text,
  ADD COLUMN IF NOT EXISTS extraction_model text,
  ADD COLUMN IF NOT EXISTS extraction_at timestamptz,
  ADD COLUMN IF NOT EXISTS classification_version text,
  ADD COLUMN IF NOT EXISTS classification_model text,
  ADD COLUMN IF NOT EXISTS classification_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_version text,
  ADD COLUMN IF NOT EXISTS analysis_model text,
  ADD COLUMN IF NOT EXISTS analysis_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_version text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pipeline_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pipeline_last_error text;

CREATE INDEX IF NOT EXISTS client_files_pipeline_stage_idx
  ON public.client_files(pipeline_stage);

-- 2) document_embeddings: versionamento por linha + ligação ao chunk
ALTER TABLE public.document_embeddings
  ADD COLUMN IF NOT EXISTS embedding_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS chunk_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS document_embeddings_file_chunk_version_unique
  ON public.document_embeddings(file_id, chunk_index, embedding_version, COALESCE(model_name, ''));

CREATE INDEX IF NOT EXISTS document_embeddings_version_idx
  ON public.document_embeddings(embedding_version);

-- 3) document_chunks: texto puro (sem vetor) — permite reembedar sem reextrair
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid,
  file_id uuid NOT NULL REFERENCES public.client_files(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_from integer,
  page_to integer,
  content text NOT NULL,
  content_hash text,
  token_count integer,
  extraction_version text,
  chunking_version text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_chunks_select ON public.document_chunks
  FOR SELECT USING (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_insert ON public.document_chunks
  FOR INSERT WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_update ON public.document_chunks
  FOR UPDATE USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_delete ON public.document_chunks
  FOR DELETE USING (organization_id = public.get_my_organization_id());

CREATE UNIQUE INDEX IF NOT EXISTS document_chunks_file_idx_version_unique
  ON public.document_chunks(file_id, chunk_index, chunking_version);

CREATE INDEX IF NOT EXISTS document_chunks_case_idx ON public.document_chunks(case_id);
CREATE INDEX IF NOT EXISTS document_chunks_org_idx ON public.document_chunks(organization_id);

-- 4) processing_jobs: fila leve
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  file_id uuid NOT NULL REFERENCES public.client_files(id) ON DELETE CASCADE,
  case_id uuid,
  job_type text NOT NULL CHECK (job_type IN ('extract','chunk','classify','embed','full')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','cancelled')),
  priority integer NOT NULL DEFAULT 100,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Writes apenas via service_role (edge functions). Leitura por organização.
GRANT SELECT ON public.processing_jobs TO authenticated;
GRANT ALL ON public.processing_jobs TO service_role;

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY processing_jobs_select ON public.processing_jobs
  FOR SELECT USING (organization_id = public.get_my_organization_id());

CREATE INDEX IF NOT EXISTS processing_jobs_dispatch_idx
  ON public.processing_jobs(status, scheduled_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS processing_jobs_file_idx ON public.processing_jobs(file_id);

CREATE TRIGGER processing_jobs_set_updated_at
  BEFORE UPDATE ON public.processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) RPC: claim atômico de jobs (SKIP LOCKED) — service_role only
CREATE OR REPLACE FUNCTION public.claim_processing_jobs(p_limit integer DEFAULT 5)
RETURNS SETOF public.processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.processing_jobs j
  SET status = 'running',
      started_at = now(),
      attempts = j.attempts + 1
  WHERE j.id IN (
    SELECT id FROM public.processing_jobs
    WHERE status = 'queued' AND scheduled_at <= now()
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_processing_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_processing_jobs(integer) TO service_role;

-- 6) match_case_chunks: filtro opcional por embedding_version
DROP FUNCTION IF EXISTS public.match_case_chunks(uuid, vector, integer);
CREATE OR REPLACE FUNCTION public.match_case_chunks(
  p_case_id uuid,
  p_query_embedding vector,
  p_match_count integer DEFAULT 8,
  p_embedding_version text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, file_id uuid, source_kind text,
  page_from integer, page_to integer, content text,
  similarity double precision, metadata jsonb,
  embedding_version text, model_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.file_id, e.source_kind, e.page_from, e.page_to, e.content,
         1 - (e.embedding <=> p_query_embedding) AS similarity, e.metadata,
         e.embedding_version, e.model_name
  FROM public.document_embeddings e
  WHERE e.case_id = p_case_id
    AND e.organization_id = public.get_my_organization_id()
    AND (p_embedding_version IS NULL OR e.embedding_version = p_embedding_version)
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
