
ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS claim_map jsonb,
  ADD COLUMN IF NOT EXISTS quality_report jsonb,
  ADD COLUMN IF NOT EXISTS generation_depth text NOT NULL DEFAULT 'professional_full';
