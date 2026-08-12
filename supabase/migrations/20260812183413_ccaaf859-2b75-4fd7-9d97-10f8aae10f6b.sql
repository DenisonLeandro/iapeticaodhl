WITH alvo AS (
  SELECT id, organization_id, case_id
  FROM public.client_files
  WHERE case_id = '1de8ed70-7f15-4bd9-9bbf-85a2a9d0dcab'
    AND length(regexp_replace(regexp_replace(coalesce(extracted_text,''), '\[\[PAGE\s+\d+\]\]', '', 'g'), '\s', '', 'g'))
        < 40 * greatest(coalesce(page_count,1),1)
),
del_emb AS (
  DELETE FROM public.document_embeddings WHERE file_id IN (SELECT id FROM alvo)
),
del_chunks AS (
  DELETE FROM public.document_chunks WHERE file_id IN (SELECT id FROM alvo)
),
upd AS (
  UPDATE public.client_files f
     SET extracted_text = NULL,
         extraction_version = NULL,
         extraction_model = NULL,
         embedding_version = NULL,
         classification_version = NULL,
         pipeline_stage = 'queued',
         pipeline_last_error = NULL
   FROM alvo a WHERE f.id = a.id
)
INSERT INTO public.processing_jobs (organization_id, file_id, case_id, job_type, status, priority, scheduled_at)
SELECT organization_id, id, case_id, 'extract', 'queued', 50, now() FROM alvo;