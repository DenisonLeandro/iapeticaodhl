
-- =============================================================================
-- PR-4.5A — Playbooks Jurídicos (MVP)
-- =============================================================================
CREATE TABLE public.legal_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  legal_area TEXT NOT NULL,
  document_type TEXT NOT NULL,
  case_subtype TEXT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_playbooks TO authenticated;
GRANT ALL ON public.legal_playbooks TO service_role;

ALTER TABLE public.legal_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_select_same_org" ON public.legal_playbooks
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_organization_id());

CREATE POLICY "playbooks_insert_admin" ON public.legal_playbooks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_organization_id() AND public.is_admin());

CREATE POLICY "playbooks_update_admin" ON public.legal_playbooks
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_organization_id() AND public.is_admin())
  WITH CHECK (organization_id = public.get_my_organization_id() AND public.is_admin());

CREATE POLICY "playbooks_delete_admin" ON public.legal_playbooks
  FOR DELETE TO authenticated
  USING (organization_id = public.get_my_organization_id() AND public.is_admin());

CREATE UNIQUE INDEX unique_active_legal_playbook
  ON public.legal_playbooks (organization_id, legal_area, document_type, COALESCE(case_subtype, ''))
  WHERE is_active = true;

CREATE INDEX idx_legal_playbooks_org ON public.legal_playbooks (organization_id, is_active);

CREATE TRIGGER trg_legal_playbooks_updated_at
  BEFORE UPDATE ON public.legal_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria em case_drafts
ALTER TABLE public.case_drafts
  ADD COLUMN IF NOT EXISTS playbook_id UUID NULL REFERENCES public.legal_playbooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS playbook_snapshot JSONB NULL,
  ADD COLUMN IF NOT EXISTS playbook_compliance JSONB NULL;
