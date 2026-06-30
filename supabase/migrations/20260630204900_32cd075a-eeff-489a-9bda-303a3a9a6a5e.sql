
CREATE TABLE IF NOT EXISTS public.case_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,

  legal_area text NULL,
  legal_area_other text NULL,
  represented_party text NULL,
  opposing_party text NULL,

  problem_summary text NULL,
  client_story text NULL,
  client_goal text NULL,
  client_goal_other text NULL,

  urgency text NULL,
  deadline_date date NULL,

  facts_period text NULL,
  facts_location text NULL,
  amount_involved text NULL,

  has_existing_lawsuit boolean NULL,
  existing_case_number text NULL,

  existing_documents text NULL,
  uploaded_documents_notes text NULL,
  missing_documents text NULL,
  witnesses text NULL,
  other_evidence text NULL,

  internal_notes text NULL,

  ai_suggested_area text NULL,
  ai_suggested_subtype text NULL,
  ai_missing_information jsonb NULL,
  ai_complementary_questions jsonb NULL,
  ai_recommended_documents jsonb NULL,
  ai_initial_risks jsonb NULL,
  ai_next_steps jsonb NULL,
  ai_suggested_at timestamptz NULL,

  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT case_intake_forms_case_unique UNIQUE (case_id)
);

CREATE INDEX IF NOT EXISTS idx_case_intake_forms_org ON public.case_intake_forms (organization_id);
CREATE INDEX IF NOT EXISTS idx_case_intake_forms_case ON public.case_intake_forms (case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_intake_forms TO authenticated;
GRANT ALL ON public.case_intake_forms TO service_role;

ALTER TABLE public.case_intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_select_org" ON public.case_intake_forms
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "intake_insert_org" ON public.case_intake_forms
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "intake_update_org" ON public.case_intake_forms
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "intake_delete_org" ON public.case_intake_forms
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER set_case_intake_forms_updated_at
  BEFORE UPDATE ON public.case_intake_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
