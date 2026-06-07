
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS represented_party text,
  ADD COLUMN IF NOT EXISTS source_file_ids uuid[],
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS template_id uuid;

CREATE INDEX IF NOT EXISTS documents_org_case_idx
  ON public.documents (organization_id, case_id);

CREATE INDEX IF NOT EXISTS documents_org_client_idx
  ON public.documents (organization_id, client_id);

CREATE INDEX IF NOT EXISTS documents_parent_idx
  ON public.documents (parent_document_id);
