
-- Tabela de memórias de cálculo estimativas por peça
CREATE TABLE public.case_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES public.case_drafts(id) ON DELETE SET NULL,
  calculation_status TEXT NOT NULL DEFAULT 'pending_data',
  total_estimated_value NUMERIC(14,2),
  assumptions JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_calculations_case ON public.case_calculations(case_id);
CREATE INDEX idx_case_calculations_draft ON public.case_calculations(draft_id);
CREATE INDEX idx_case_calculations_org ON public.case_calculations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_calculations TO authenticated;
GRANT ALL ON public.case_calculations TO service_role;

ALTER TABLE public.case_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read case_calculations" ON public.case_calculations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());
CREATE POLICY "org members insert case_calculations" ON public.case_calculations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "org members update case_calculations" ON public.case_calculations
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id())
  WITH CHECK (organization_id = public.get_my_organization_id());
CREATE POLICY "org members delete case_calculations" ON public.case_calculations
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER trg_case_calculations_updated_at
  BEFORE UPDATE ON public.case_calculations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Itens de cálculo
CREATE TABLE public.case_calculation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID NOT NULL REFERENCES public.case_calculations(id) ON DELETE CASCADE,
  request_label TEXT NOT NULL,
  legal_basis TEXT,
  formula TEXT,
  input_data JSONB DEFAULT '{}'::jsonb,
  assumptions JSONB DEFAULT '{}'::jsonb,
  estimated_value NUMERIC(14,2),
  confidence TEXT NOT NULL DEFAULT 'low',
  missing_fields JSONB DEFAULT '[]'::jsonb,
  period TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_calc_items_calc ON public.case_calculation_items(calculation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_calculation_items TO authenticated;
GRANT ALL ON public.case_calculation_items TO service_role;

ALTER TABLE public.case_calculation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read case_calc_items" ON public.case_calculation_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.case_calculations c
    WHERE c.id = calculation_id
      AND c.organization_id = public.get_my_organization_id()
  ));
CREATE POLICY "org members write case_calc_items" ON public.case_calculation_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.case_calculations c
    WHERE c.id = calculation_id
      AND c.organization_id = public.get_my_organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.case_calculations c
    WHERE c.id = calculation_id
      AND c.organization_id = public.get_my_organization_id()
  ));


-- Campos aditivos em case_drafts
ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS senior_review JSONB,
  ADD COLUMN IF NOT EXISTS senior_review_status TEXT,
  ADD COLUMN IF NOT EXISTS senior_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS calculation_id UUID REFERENCES public.case_calculations(id) ON DELETE SET NULL;
