CREATE TABLE public.case_chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.case_chat_messages(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('useful','not_useful')),
  comment text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, created_by)
);

CREATE INDEX idx_case_chat_feedback_case ON public.case_chat_feedback(case_id);
CREATE INDEX idx_case_chat_feedback_org ON public.case_chat_feedback(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_chat_feedback TO authenticated;
GRANT ALL ON public.case_chat_feedback TO service_role;

ALTER TABLE public.case_chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_chat_feedback tenant select" ON public.case_chat_feedback
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "case_chat_feedback tenant insert" ON public.case_chat_feedback
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id() AND created_by = auth.uid());

CREATE POLICY "case_chat_feedback tenant update" ON public.case_chat_feedback
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id() AND created_by = auth.uid())
  WITH CHECK (organization_id = public.get_my_organization_id() AND created_by = auth.uid());

CREATE POLICY "case_chat_feedback tenant delete" ON public.case_chat_feedback
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id() AND created_by = auth.uid());

CREATE TRIGGER set_case_chat_feedback_updated_at
  BEFORE UPDATE ON public.case_chat_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();