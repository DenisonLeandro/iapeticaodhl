CREATE TABLE public.case_claim_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  global_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_case_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'awaiting_lawyer_review',
  model_used text,
  tokens_input int,
  tokens_output int,
  cost_estimate numeric,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_claim_maps_status_check CHECK (status IN ('draft','awaiting_lawyer_review','reviewed'))
);

CREATE UNIQUE INDEX case_claim_maps_one_current_per_case
  ON public.case_claim_maps (case_id)
  WHERE is_current = true;

CREATE INDEX case_claim_maps_case_id_idx ON public.case_claim_maps (case_id, version DESC);
CREATE INDEX case_claim_maps_org_idx ON public.case_claim_maps (organization_id);

GRANT SELECT ON public.case_claim_maps TO authenticated;
GRANT ALL ON public.case_claim_maps TO service_role;

ALTER TABLE public.case_claim_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view claim maps of their organization"
  ON public.case_claim_maps
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE TRIGGER trg_case_claim_maps_updated_at
  BEFORE UPDATE ON public.case_claim_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
