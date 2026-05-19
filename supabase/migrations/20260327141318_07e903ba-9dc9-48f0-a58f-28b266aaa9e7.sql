-- Enums
DO $$ BEGIN
  CREATE TYPE public.organization_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'lawyer', 'secretary', 'intern');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('petition', 'appeal', 'contract', 'notification', 'opinion', 'power_of_attorney', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM ('draft', 'review', 'approved', 'signed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.llm_provider_type AS ENUM ('openai', 'gemini', 'claude');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM ('active', 'archived', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.publication_source AS ENUM ('djen', 'dje_pe', 'dje_sp', 'dje_rj');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Utility function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  branding JSONB NOT NULL DEFAULT '{"logo_url": null, "primary_color": "#1e40af", "secondary_color": "#3b82f6"}'::jsonb,
  plan public.organization_plan NOT NULL DEFAULT 'free',
  features_enabled JSONB NOT NULL DEFAULT '{"ai_legal": true, "finance": false, "whatsapp": false}'::jsonb,
  llm_config JSONB NOT NULL DEFAULT '{"provider": "openai", "model": "gpt-4o-mini"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations (slug);
DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON public.organizations;
CREATE TRIGGER trigger_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'admin',
  full_name TEXT NOT NULL,
  oab_number TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _full_name TEXT;
  _org_name TEXT;
  _org_id UUID;
  _slug TEXT;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1));
  _org_id := (NEW.raw_user_meta_data ->> 'organization_id')::UUID;
  IF _org_id IS NULL THEN
    _org_name := COALESCE(NEW.raw_user_meta_data ->> 'organization_name', _full_name || '''s Organization');
    _slug := lower(regexp_replace(_org_name, '[^a-z0-9]+', '-', 'gi'));
    _slug := trim(both '-' from _slug);
    IF _slug = '' THEN _slug := 'org'; END IF;
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    INSERT INTO public.organizations (name, slug) VALUES (_org_name, _slug) RETURNING id INTO _org_id;
  END IF;
  INSERT INTO public.profiles (id, organization_id, role, full_name) VALUES (NEW.id, _org_id, 'admin', _full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('cpf', 'cnpj')),
  document_number TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_org_document ON public.clients (organization_id, document_number) WHERE deleted_at IS NULL AND document_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients (organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (organization_id, created_at DESC) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- cases
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID,
  case_number TEXT NOT NULL,
  court TEXT NOT NULL,
  branch TEXT,
  subject TEXT,
  status public.case_status NOT NULL DEFAULT 'active',
  opposing_party TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cases_organization_id ON public.cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON public.cases (client_id);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.cases (case_number);
DROP TRIGGER IF EXISTS trigger_cases_updated_at ON public.cases;
CREATE TRIGGER trigger_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NULL,
  client_id UUID NULL,
  type public.document_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  llm_provider public.llm_provider_type NOT NULL,
  llm_model TEXT NOT NULL,
  prompt_used TEXT NOT NULL DEFAULT '',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  status public.document_status NOT NULL DEFAULT 'draft',
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents (type);

-- ai_usage_log
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_estimated DECIMAL(10,6) NOT NULL DEFAULT 0,
  document_id UUID NULL REFERENCES public.documents(id) ON DELETE SET NULL,
  prompt_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_organization_id ON public.ai_usage_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_profile_id ON public.ai_usage_log (profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider ON public.ai_usage_log (provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log (created_at);

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'media' CONSTRAINT tasks_priority_check CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CONSTRAINT tasks_status_check CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  due_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks (organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks (organization_id, priority);
DROP TRIGGER IF EXISTS trigger_tasks_updated_at ON public.tasks;
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- finances
CREATE TABLE IF NOT EXISTS public.finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID,
  client_id UUID,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente')),
  payment_method TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finances_organization_id ON public.finances (organization_id);
CREATE INDEX IF NOT EXISTS idx_finances_type ON public.finances (type);
CREATE INDEX IF NOT EXISTS idx_finances_status ON public.finances (status);
CREATE INDEX IF NOT EXISTS idx_finances_due_date ON public.finances (due_date);
CREATE INDEX IF NOT EXISTS idx_finances_created_by ON public.finances (created_by);
DROP TRIGGER IF EXISTS trigger_finances_updated_at ON public.finances;
CREATE TRIGGER trigger_finances_updated_at BEFORE UPDATE ON public.finances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- client_interactions
CREATE TABLE IF NOT EXISTS public.client_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  interaction_date TIMESTAMPTZ NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_interactions_client_date ON public.client_interactions (client_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_interactions_organization_id ON public.client_interactions (organization_id);
DROP TRIGGER IF EXISTS trigger_client_interactions_updated_at ON public.client_interactions;
CREATE TRIGGER trigger_client_interactions_updated_at BEFORE UPDATE ON public.client_interactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- client_files
CREATE TABLE IF NOT EXISTS public.client_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_files_client_id ON public.client_files (client_id);
CREATE INDEX IF NOT EXISTS idx_client_files_organization_id ON public.client_files (organization_id);

-- case_movements
CREATE TABLE IF NOT EXISTS public.case_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CONSTRAINT case_movements_type_check CHECK (type IN ('peticao', 'despacho', 'decisao', 'sentenca', 'audiencia', 'recurso', 'outro')),
  description TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_movements_case_id ON public.case_movements (case_id);
CREATE INDEX IF NOT EXISTS idx_case_movements_movement_date ON public.case_movements (movement_date);
CREATE INDEX IF NOT EXISTS idx_case_movements_organization_id ON public.case_movements (organization_id);

-- publications
CREATE TABLE IF NOT EXISTS public.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  lawyer_name TEXT NOT NULL,
  publication_date DATE NOT NULL,
  content TEXT NOT NULL,
  source public.publication_source NOT NULL DEFAULT 'djen',
  read BOOLEAN NOT NULL DEFAULT false,
  external_id TEXT,
  matched_case_number TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_org_external_id ON public.publications (organization_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publications_org_read ON public.publications (organization_id, read);
CREATE INDEX IF NOT EXISTS idx_publications_org_date ON public.publications (organization_id, publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_publications_case_id ON public.publications (case_id);

-- jurisprudence_cache
CREATE TABLE IF NOT EXISTS public.jurisprudence_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  court TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_jurisprudence_cache_lookup ON public.jurisprudence_cache (query_hash, court);
CREATE INDEX IF NOT EXISTS idx_jurisprudence_cache_expires ON public.jurisprudence_cache (expires_at);

-- notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  notify_publications BOOLEAN NOT NULL DEFAULT true,
  notify_deadlines BOOLEAN NOT NULL DEFAULT true,
  notify_tasks BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile ON public.notification_preferences (profile_id);

-- RLS: organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated USING (id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY profiles_admin_delete ON public.profiles FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RLS: clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (deleted_at IS NULL AND organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- RLS: cases
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_org_isolation ON public.cases FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY cases_insert ON public.cases FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary')));
CREATE POLICY cases_update ON public.cases FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary'))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary')));
CREATE POLICY cases_delete ON public.cases FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RLS: documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_select_org ON public.documents FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY documents_insert_org ON public.documents FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY documents_update_org ON public.documents FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY documents_delete_org ON public.documents FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- RLS: ai_usage_log
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_log_select_org ON public.ai_usage_log FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY ai_usage_log_insert_org ON public.ai_usage_log FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY ai_usage_log_update_org ON public.ai_usage_log FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY ai_usage_log_delete_org ON public.ai_usage_log FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- RLS: tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_select_org ON public.tasks FOR SELECT USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_insert_org ON public.tasks FOR INSERT WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_update_org ON public.tasks FOR UPDATE USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY tasks_delete_admin_or_creator ON public.tasks FOR DELETE USING (assigned_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.organization_id = tasks.organization_id AND p.role = 'admin'));

-- RLS: finances
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
CREATE POLICY finances_select ON public.finances FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY finances_insert ON public.finances FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()) AND created_by = auth.uid());
CREATE POLICY finances_update ON public.finances FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY finances_delete ON public.finances FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RLS: client_interactions
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_interactions_select ON public.client_interactions FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY client_interactions_insert ON public.client_interactions FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY client_interactions_update ON public.client_interactions FOR UPDATE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())) WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY client_interactions_delete ON public.client_interactions FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- RLS: client_files
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_files_select ON public.client_files FOR SELECT TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY client_files_insert ON public.client_files FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY client_files_delete ON public.client_files FOR DELETE TO authenticated USING (organization_id IN (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- RLS: case_movements
ALTER TABLE public.case_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_movements_org_isolation ON public.case_movements FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY case_movements_insert ON public.case_movements FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary')));
CREATE POLICY case_movements_update ON public.case_movements FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary'))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary')));
CREATE POLICY case_movements_delete ON public.case_movements FOR DELETE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RLS: publications
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY publications_org_isolation ON public.publications FOR SELECT TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY publications_insert_service ON public.publications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY publications_update ON public.publications FOR UPDATE TO authenticated USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary'))) WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lawyer', 'secretary')));

-- RLS: jurisprudence_cache
ALTER TABLE public.jurisprudence_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY jurisprudence_cache_select ON public.jurisprudence_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY jurisprudence_cache_service ON public.jurisprudence_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS: notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_select_own ON public.notification_preferences FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY notification_preferences_update_own ON public.notification_preferences FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY notification_preferences_service_all ON public.notification_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Additional triggers
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_notification_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (profile_id) VALUES (NEW.id) ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_profiles_create_notification_preferences AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();

CREATE OR REPLACE FUNCTION cleanup_expired_jurisprudence_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN DELETE FROM jurisprudence_cache WHERE expires_at < now(); END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publications;