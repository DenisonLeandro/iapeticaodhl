
ALTER TABLE public.client_files
  ADD COLUMN IF NOT EXISTS parent_file_id uuid REFERENCES public.client_files(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS logical_file_name text,
  ADD COLUMN IF NOT EXISTS part_index integer,
  ADD COLUMN IF NOT EXISTS total_parts integer;

CREATE INDEX IF NOT EXISTS idx_client_files_parent_file_id ON public.client_files(parent_file_id);

ALTER TABLE public.client_files ALTER COLUMN storage_path DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.aggregate_parent_file_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_id uuid;
  _total int;
  _done int;
  _failed int;
  _has_running boolean;
  _last_error text;
BEGIN
  _parent_id := NEW.parent_file_id;
  IF _parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE pipeline_stage = 'done'),
         count(*) FILTER (WHERE pipeline_stage = 'failed'),
         bool_or(pipeline_stage IN ('pending','queued','extracting','chunking','classifying','embedding'))
    INTO _total, _done, _failed, _has_running
  FROM public.client_files
  WHERE parent_file_id = _parent_id;

  SELECT pipeline_last_error INTO _last_error
  FROM public.client_files
  WHERE parent_file_id = _parent_id AND pipeline_stage = 'failed'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF _failed > 0 AND NOT COALESCE(_has_running, false) THEN
    UPDATE public.client_files
    SET pipeline_stage = 'failed',
        pipeline_last_error = COALESCE(_last_error, 'Uma ou mais partes falharam'),
        updated_at = now()
    WHERE id = _parent_id
      AND pipeline_stage IS DISTINCT FROM 'failed';
  ELSIF _done = _total AND _total > 0 THEN
    UPDATE public.client_files
    SET pipeline_stage = 'done',
        pipeline_last_error = NULL,
        updated_at = now()
    WHERE id = _parent_id
      AND pipeline_stage IS DISTINCT FROM 'done';
  ELSIF COALESCE(_has_running, false) THEN
    UPDATE public.client_files
    SET pipeline_stage = 'extracting',
        updated_at = now()
    WHERE id = _parent_id
      AND pipeline_stage IS DISTINCT FROM 'extracting'
      AND pipeline_stage IS DISTINCT FROM 'done'
      AND pipeline_stage IS DISTINCT FROM 'failed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aggregate_parent_file_status ON public.client_files;
CREATE TRIGGER trg_aggregate_parent_file_status
AFTER INSERT OR UPDATE OF pipeline_stage ON public.client_files
FOR EACH ROW
WHEN (NEW.parent_file_id IS NOT NULL)
EXECUTE FUNCTION public.aggregate_parent_file_status();
