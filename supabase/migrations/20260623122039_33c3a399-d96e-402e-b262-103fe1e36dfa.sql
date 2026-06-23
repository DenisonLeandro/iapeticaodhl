-- PR-3.6 Onda 1: resiliência do pipeline (reaper + reconciler + heartbeat)

-- 1) Heartbeat para detectar jobs travados
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS processing_jobs_running_heartbeat_idx
  ON public.processing_jobs (status, heartbeat_at)
  WHERE status = 'running';

-- 2) Reaper de jobs órfãos
CREATE OR REPLACE FUNCTION public.reap_orphan_processing_jobs(p_stale_minutes int DEFAULT 5)
RETURNS TABLE(reaped_id uuid, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cutoff timestamptz := now() - make_interval(mins => p_stale_minutes);
  r record;
BEGIN
  FOR r IN
    SELECT id, attempts, max_attempts, file_id, last_error
      FROM public.processing_jobs
     WHERE status = 'running'
       AND COALESCE(heartbeat_at, started_at) < _cutoff
     FOR UPDATE SKIP LOCKED
  LOOP
    IF r.attempts >= r.max_attempts THEN
      UPDATE public.processing_jobs
         SET status = 'failed',
             finished_at = now(),
             last_error = COALESCE(r.last_error, '') || '|reaped_orphan'
       WHERE id = r.id;

      -- propaga falha para client_files apenas se ainda estiver em estágio in-flight
      UPDATE public.client_files
         SET pipeline_stage = 'failed',
             pipeline_last_error = COALESCE(pipeline_last_error, 'reaped_orphan: job travado sem heartbeat'),
             updated_at = now()
       WHERE id = r.file_id
         AND pipeline_stage IN ('pending','queued','extracting','chunking','classifying','embedding');

      reaped_id := r.id; action := 'failed_max_attempts'; RETURN NEXT;
    ELSE
      UPDATE public.processing_jobs
         SET status = 'queued',
             scheduled_at = now(),
             started_at = NULL,
             heartbeat_at = NULL,
             last_error = COALESCE(r.last_error, '') || '|reaped_orphan'
       WHERE id = r.id;

      reaped_id := r.id; action := 'requeued'; RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_orphan_processing_jobs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_orphan_processing_jobs(int) TO service_role;

-- 3) Reconciliador com salvaguardas contra falso positivo
CREATE OR REPLACE FUNCTION public.reconcile_pipeline_stages()
RETURNS TABLE(file_id uuid, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  _chunk_count int;
  _embed_count int;
  _has_active_job boolean;
  _has_done_job boolean;
BEGIN
  FOR r IN
    SELECT f.id, f.pipeline_last_error, f.extracted_text, f.extraction_at
      FROM public.client_files f
     WHERE f.pipeline_stage IN ('extracting','chunking','classifying','embedding')
     FOR UPDATE SKIP LOCKED
  LOOP
    -- Salvaguarda 2: extração concluída
    IF r.extracted_text IS NULL OR r.extraction_at IS NULL THEN
      CONTINUE;
    END IF;

    -- Salvaguarda 3: embeddings = chunks > 0
    SELECT count(*) INTO _chunk_count FROM public.document_chunks WHERE document_chunks.file_id = r.id;
    SELECT count(*) INTO _embed_count FROM public.document_embeddings WHERE document_embeddings.file_id = r.id;

    IF _chunk_count = 0 OR _chunk_count <> _embed_count THEN
      CONTINUE;
    END IF;

    -- Salvaguarda 4: erro relevante bloqueia promoção (marcador 'reaped_orphan' é benigno)
    IF r.pipeline_last_error IS NOT NULL
       AND r.pipeline_last_error <> ''
       AND r.pipeline_last_error NOT ILIKE '%reaped_orphan%' THEN
      CONTINUE;
    END IF;

    -- Salvaguarda 5: nenhum job ativo
    SELECT EXISTS(
      SELECT 1 FROM public.processing_jobs
       WHERE processing_jobs.file_id = r.id
         AND status IN ('queued','running')
    ) INTO _has_active_job;

    IF _has_active_job THEN
      CONTINUE;
    END IF;

    -- Salvaguarda 6: existe job concluído
    SELECT EXISTS(
      SELECT 1 FROM public.processing_jobs
       WHERE processing_jobs.file_id = r.id
         AND status = 'done'
    ) INTO _has_done_job;

    IF NOT _has_done_job THEN
      CONTINUE;
    END IF;

    UPDATE public.client_files
       SET pipeline_stage = 'done',
           pipeline_last_error = NULL,
           updated_at = now()
     WHERE id = r.id;

    file_id := r.id; action := 'promoted_to_done'; RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_pipeline_stages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_pipeline_stages() TO service_role;