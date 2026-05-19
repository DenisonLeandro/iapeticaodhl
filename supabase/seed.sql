-- =============================================================================
-- Seed Data — Optional test data for development
-- This file is NOT required for production. It provides sample data for
-- testing the application locally or in Lovable Cloud.
-- =============================================================================

-- 1. Sample organization
-- Note: In production, organizations are created through the registration flow.
INSERT INTO public.organizations (id, name, slug, plan, llm_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Escritório Modelo',
  'escritorio-modelo',
  'professional',
  '{"provider": "openai", "model": "gpt-4o-mini", "api_key": ""}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Document type reference (informational — these are application-level constants)
-- The application defines these types in src/types/ai.ts:
--   petition    — Petição Inicial, Réplica, Alegações Finais
--   appeal      — Recurso de Apelação, Agravo de Instrumento, Agravo Interno,
--                 Embargos de Declaração, REsp, RE
--   contract    — Contrato (diversos tipos)
--   notification — Notificação Extrajudicial
--   opinion     — Parecer Jurídico
--   power_of_attorney — Procuração
--   other       — Outros documentos

-- 3. Note on Edge Functions
-- The following Edge Functions need manual deployment (not auto-deployed by Lovable):
--   - ai-generate: LLM generation (has client-side fallback)
--   - tribunal-search: Court jurisprudence search (has client-side fallback)
--   - djen-scraper: DJEN publication scraping (server-only, no fallback)
--   - email-notify: Email notifications via Resend (server-only)
--   - whatsapp-notify: WhatsApp notifications (server-only)
