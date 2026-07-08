
-- ===========================================================================
-- 1) PROFILES: bloquear auto-escalação de papel (role)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NEW.id = auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio papel (role).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- ===========================================================================
-- 2) document_chunks: policies -> authenticated
-- ===========================================================================
DROP POLICY IF EXISTS document_chunks_select ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_insert ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_update ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_delete ON public.document_chunks;

CREATE POLICY document_chunks_select ON public.document_chunks
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_insert ON public.document_chunks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_update ON public.document_chunks
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY document_chunks_delete ON public.document_chunks
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id());

-- ===========================================================================
-- 3) processing_jobs: policy -> authenticated
-- ===========================================================================
DROP POLICY IF EXISTS processing_jobs_select ON public.processing_jobs;
CREATE POLICY processing_jobs_select ON public.processing_jobs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

-- ===========================================================================
-- 4) tasks: policies -> authenticated
-- ===========================================================================
DROP POLICY IF EXISTS tasks_select_org ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_org ON public.tasks;
DROP POLICY IF EXISTS tasks_update_org ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_admin_or_creator ON public.tasks;

CREATE POLICY tasks_select_org ON public.tasks
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_insert_org ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_update_org ON public.tasks
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_delete_admin_or_creator ON public.tasks
  FOR DELETE TO authenticated
  USING (
    assigned_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = tasks.organization_id
        AND p.role = 'admin'::user_role
    )
  );

-- ===========================================================================
-- 5) storage.objects (client-documents): policies -> authenticated + UPDATE
-- ===========================================================================
DROP POLICY IF EXISTS "Users can view org client files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload org client files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete org client files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update org client files" ON storage.objects;

CREATE POLICY "Users can view org client files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT (p.organization_id)::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
CREATE POLICY "Users can upload org client files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT (p.organization_id)::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
CREATE POLICY "Users can update org client files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT (p.organization_id)::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT (p.organization_id)::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
CREATE POLICY "Users can delete org client files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT (p.organization_id)::text FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- ===========================================================================
-- 6) Revogar EXECUTE em funções SECURITY DEFINER não destinadas a chamadas
--    diretas de anon/authenticated via API PostgREST.
-- ===========================================================================
-- Anon: nunca deve invocar nenhuma destas
REVOKE EXECUTE ON FUNCTION public.get_my_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_current_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_case_chunks(uuid, vector, integer, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_jurisprudence_cache() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_files_validate_case_org() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_service_key_vault(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_processing_jobs(integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reap_orphan_processing_jobs(integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_pipeline_stages() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aggregate_parent_file_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_notification_preferences_updated_at() FROM anon, authenticated, PUBLIC;
