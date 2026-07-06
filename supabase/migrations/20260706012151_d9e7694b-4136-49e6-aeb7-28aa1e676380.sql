
ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS senior_review_suggestions jsonb,
  ADD COLUMN IF NOT EXISTS senior_review_apply_status text,
  ADD COLUMN IF NOT EXISTS senior_review_apply_error text,
  ADD COLUMN IF NOT EXISTS senior_review_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS playbook_status text;

CREATE TABLE IF NOT EXISTS public.case_draft_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  draft_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  content text NOT NULL,
  source text NOT NULL,
  applied_suggestion_ids jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.case_draft_versions TO authenticated;
GRANT ALL ON public.case_draft_versions TO service_role;

ALTER TABLE public.case_draft_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org can read draft versions"
  ON public.case_draft_versions FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "org can insert draft versions"
  ON public.case_draft_versions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE INDEX IF NOT EXISTS idx_case_draft_versions_draft ON public.case_draft_versions(draft_id, created_at DESC);
