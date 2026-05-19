-- Migration: 00015_create_notification_preferences
-- Description: Creates the notification_preferences table for per-user notification settings.
-- Story 8.1 — Email & WhatsApp Notifications

-- =============================================================================
-- 1. Table: notification_preferences
-- Stores per-user notification channel and type preferences.
-- 1:1 relationship with profiles via profile_id UNIQUE.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled           BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled        BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number         TEXT,
  notify_publications     BOOLEAN NOT NULL DEFAULT true,
  notify_deadlines        BOOLEAN NOT NULL DEFAULT true,
  notify_tasks            BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'Preferências de notificação por usuário (email, WhatsApp, tipos)';
COMMENT ON COLUMN public.notification_preferences.profile_id IS 'Referência ao perfil do usuário (1:1)';
COMMENT ON COLUMN public.notification_preferences.email_enabled IS 'Habilita notificações por email';
COMMENT ON COLUMN public.notification_preferences.whatsapp_enabled IS 'Habilita notificações por WhatsApp';
COMMENT ON COLUMN public.notification_preferences.whatsapp_number IS 'Número de WhatsApp do usuário (formato brasileiro)';
COMMENT ON COLUMN public.notification_preferences.notify_publications IS 'Receber notificações de novas publicações';
COMMENT ON COLUMN public.notification_preferences.notify_deadlines IS 'Receber notificações de prazos próximos';
COMMENT ON COLUMN public.notification_preferences.notify_tasks IS 'Receber notificações de tarefas atribuídas';

-- =============================================================================
-- 2. Index
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notification_preferences_profile
  ON public.notification_preferences (profile_id);

-- =============================================================================
-- 3. Enable RLS
-- =============================================================================
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS Policies — user can only read/update their own preferences
-- =============================================================================

-- 4.1 SELECT: user can only read their own preferences
CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 4.2 INSERT: user can only insert their own preferences
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- 4.3 UPDATE: user can only update their own preferences
CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- 4.4 Service role has full access (for Edge Functions)
CREATE POLICY notification_preferences_service_all ON public.notification_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- 5. Trigger: auto-update updated_at on modification
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- =============================================================================
-- 6. Trigger: auto-create default preferences when a new profile is created
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_profiles_create_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();
