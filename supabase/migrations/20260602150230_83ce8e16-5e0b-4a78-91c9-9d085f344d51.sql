
-- Phase 1: extend client_files for AI process analysis

ALTER TABLE public.client_files
  ADD COLUMN IF NOT EXISTS case_id uuid,
  ADD COLUMN IF NOT EXISTS petition_id uuid,
  ADD COLUMN IF NOT EXISTS document_kind text,
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS analysis_summary text,
  ADD COLUMN IF NOT EXISTS analysis_json jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Constraints (allow NULL since fields are optional)
ALTER TABLE public.client_files
  DROP CONSTRAINT IF EXISTS client_files_document_kind_check;
ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_document_kind_check
  CHECK (document_kind IS NULL OR document_kind IN (
    'geral','pdf_integral','inicial','contestacao','replica','sentenca',
    'acordao','laudo','manifestacao','documentos','audiencia','recurso','outros'
  ));

ALTER TABLE public.client_files
  DROP CONSTRAINT IF EXISTS client_files_processing_status_check;
ALTER TABLE public.client_files
  ADD CONSTRAINT client_files_processing_status_check
  CHECK (processing_status IN ('pending','processing','analyzed','error'));

-- Index for case lookups within an org
CREATE INDEX IF NOT EXISTS idx_client_files_case_org
  ON public.client_files (organization_id, case_id)
  WHERE case_id IS NOT NULL;

-- UPDATE policy (missing today) — org isolation
DROP POLICY IF EXISTS client_files_update ON public.client_files;
CREATE POLICY client_files_update ON public.client_files
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT p.organization_id FROM profiles p WHERE p.id = auth.uid()));

-- Trigger: updated_at on row change (reuse existing helper)
DROP TRIGGER IF EXISTS trg_client_files_updated_at ON public.client_files;
CREATE TRIGGER trg_client_files_updated_at
  BEFORE UPDATE ON public.client_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ensure case_id belongs to same organization_id
CREATE OR REPLACE FUNCTION public.client_files_validate_case_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _case_org uuid;
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    SELECT organization_id INTO _case_org FROM public.cases WHERE id = NEW.case_id;
    IF _case_org IS NULL THEN
      RAISE EXCEPTION 'Processo não encontrado';
    END IF;
    IF _case_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Processo pertence a outra organização';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_files_validate_case_org ON public.client_files;
CREATE TRIGGER trg_client_files_validate_case_org
  BEFORE INSERT OR UPDATE OF case_id, organization_id ON public.client_files
  FOR EACH ROW EXECUTE FUNCTION public.client_files_validate_case_org();
