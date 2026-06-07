-- =========================================================================
-- Fase D — Chat IA + Versionamento de documentos
-- =========================================================================

-- 1. document_chat_messages -----------------------------------------------
CREATE TABLE public.document_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_chat_messages_document_idx
  ON public.document_chat_messages(document_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chat_messages TO authenticated;
GRANT ALL ON public.document_chat_messages TO service_role;

ALTER TABLE public.document_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_chat_messages_select_org"
  ON public.document_chat_messages FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "document_chat_messages_insert_org"
  ON public.document_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "document_chat_messages_update_org"
  ON public.document_chat_messages FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "document_chat_messages_delete_org"
  ON public.document_chat_messages FOR DELETE
  TO authenticated
  USING (organization_id = public.get_my_organization_id());


-- 2. document_versions ----------------------------------------------------
CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  change_summary text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','chat_ai','editor','restored','initial')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE INDEX document_versions_doc_version_idx
  ON public.document_versions(document_id, version DESC);

GRANT SELECT, INSERT, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_versions_select_org"
  ON public.document_versions FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "document_versions_insert_org"
  ON public.document_versions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "document_versions_delete_admin"
  ON public.document_versions FOR DELETE
  TO authenticated
  USING (organization_id = public.get_my_organization_id() AND public.is_admin());