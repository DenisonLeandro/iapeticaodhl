
CREATE TABLE public.case_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL DEFAULT 'initial',
  status TEXT NOT NULL DEFAULT 'pending',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  model_task TEXT,
  model_used TEXT,
  provider TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT case_analyses_status_check CHECK (status IN ('pending','running','done','failed'))
);

CREATE INDEX idx_case_analyses_case ON public.case_analyses (case_id, created_at DESC);
CREATE INDEX idx_case_analyses_org ON public.case_analyses (organization_id, created_at DESC);
CREATE INDEX idx_case_analyses_status ON public.case_analyses (case_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_analyses TO authenticated;
GRANT ALL ON public.case_analyses TO service_role;

ALTER TABLE public.case_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_analyses_select" ON public.case_analyses
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "case_analyses_insert" ON public.case_analyses
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "case_analyses_update" ON public.case_analyses
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());

CREATE POLICY "case_analyses_delete" ON public.case_analyses
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER trg_case_analyses_updated_at
  BEFORE UPDATE ON public.case_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
