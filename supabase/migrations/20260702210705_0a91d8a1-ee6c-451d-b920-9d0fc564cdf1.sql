
-- PR-4.4B — Tabela case_drafts
CREATE TABLE public.case_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by uuid,
  updated_by uuid,
  title text,
  draft_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  content text NOT NULL DEFAULT '',
  objective text,
  tone text,
  additional_instructions text,
  template_id uuid REFERENCES public.legal_templates(id) ON DELETE SET NULL,
  sources_used jsonb,
  missing_information jsonb,
  warnings jsonb,
  model_used text,
  tokens_input integer,
  tokens_output integer,
  cost_estimate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_drafts_case ON public.case_drafts(case_id, created_at DESC);
CREATE INDEX idx_case_drafts_org ON public.case_drafts(organization_id, created_at DESC);
CREATE INDEX idx_case_drafts_status ON public.case_drafts(case_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_drafts TO authenticated;
GRANT ALL ON public.case_drafts TO service_role;

ALTER TABLE public.case_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_drafts_select_org" ON public.case_drafts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "case_drafts_insert_org" ON public.case_drafts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "case_drafts_update_org" ON public.case_drafts
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "case_drafts_delete_org" ON public.case_drafts
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER case_drafts_set_updated_at
  BEFORE UPDATE ON public.case_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
