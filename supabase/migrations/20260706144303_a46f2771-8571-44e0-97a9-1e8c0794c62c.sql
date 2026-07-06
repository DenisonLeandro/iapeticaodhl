-- PR-1: Fundação de dados para modo "Gerar por capítulos — qualidade máxima"

-- 1) Colunas novas em case_drafts
ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS generation_mode text NOT NULL DEFAULT 'fast',
  ADD COLUMN IF NOT EXISTS assembly_status text,
  ADD COLUMN IF NOT EXISTS piece_type_key text;

ALTER TABLE public.case_drafts
  DROP CONSTRAINT IF EXISTS case_drafts_generation_mode_check;
ALTER TABLE public.case_drafts
  ADD CONSTRAINT case_drafts_generation_mode_check
  CHECK (generation_mode IN ('fast','chapters'));

ALTER TABLE public.case_drafts
  DROP CONSTRAINT IF EXISTS case_drafts_assembly_status_check;
ALTER TABLE public.case_drafts
  ADD CONSTRAINT case_drafts_assembly_status_check
  CHECK (assembly_status IS NULL OR assembly_status IN ('stale','assembled','failed'));

-- 2) Tabela case_draft_sections
CREATE TABLE IF NOT EXISTS public.case_draft_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  draft_id uuid NOT NULL REFERENCES public.case_drafts(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_label text NOT NULL,
  order_index int NOT NULL,
  content text,
  status text NOT NULL DEFAULT 'pending',
  generation_prompt jsonb,
  model_used text,
  tokens_input int,
  tokens_output int,
  cost_estimate numeric,
  quality_notes jsonb,
  last_error text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_draft_sections_status_check
    CHECK (status IN ('pending','generating','generated','edited','approved','skipped','failed')),
  CONSTRAINT case_draft_sections_draft_key_unique UNIQUE (draft_id, section_key)
);

CREATE INDEX IF NOT EXISTS case_draft_sections_draft_id_idx
  ON public.case_draft_sections(draft_id);
CREATE INDEX IF NOT EXISTS case_draft_sections_org_idx
  ON public.case_draft_sections(organization_id);

-- 3) GRANTs (leitura no client; mutations via service_role/edge functions futuras)
GRANT SELECT ON public.case_draft_sections TO authenticated;
GRANT ALL ON public.case_draft_sections TO service_role;

-- 4) RLS
ALTER TABLE public.case_draft_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_draft_sections_select_org" ON public.case_draft_sections;
CREATE POLICY "case_draft_sections_select_org"
  ON public.case_draft_sections
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_my_organization_id());

-- 5) Trigger updated_at
DROP TRIGGER IF EXISTS trg_case_draft_sections_updated_at ON public.case_draft_sections;
CREATE TRIGGER trg_case_draft_sections_updated_at
  BEFORE UPDATE ON public.case_draft_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
