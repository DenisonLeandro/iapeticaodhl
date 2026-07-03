ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'not_requested';

CREATE INDEX IF NOT EXISTS case_drafts_quality_status_idx
  ON public.case_drafts(quality_status)
  WHERE quality_status IN ('pending','running','failed');