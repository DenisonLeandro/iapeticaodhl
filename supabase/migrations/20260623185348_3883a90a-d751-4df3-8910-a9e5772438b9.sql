-- PR-3.7 — Telemetria Financeira da IA
-- Estende ai_usage_log (existente). Idempotente. Sem mudança de RLS.

ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS operation          text    NOT NULL DEFAULT 'generation',
  ADD COLUMN IF NOT EXISTS case_id            uuid    NULL,
  ADD COLUMN IF NOT EXISTS client_id          uuid    NULL,
  ADD COLUMN IF NOT EXISTS file_id            uuid    NULL,
  ADD COLUMN IF NOT EXISTS processing_time_ms integer NULL,
  ADD COLUMN IF NOT EXISTS units              integer NULL,
  ADD COLUMN IF NOT EXISTS metadata           jsonb   NOT NULL DEFAULT '{}'::jsonb;

-- Backfill para linhas pré-existentes (DEFAULT só vale a partir do ALTER)
UPDATE public.ai_usage_log
   SET operation = 'generation'
 WHERE operation IS NULL;

-- Foreign keys idempotentes (DO block + pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_log_case_id_fkey') THEN
    ALTER TABLE public.ai_usage_log
      ADD CONSTRAINT ai_usage_log_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_log_client_id_fkey') THEN
    ALTER TABLE public.ai_usage_log
      ADD CONSTRAINT ai_usage_log_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_log_file_id_fkey') THEN
    ALTER TABLE public.ai_usage_log
      ADD CONSTRAINT ai_usage_log_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES public.client_files(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índices para o dashboard
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_operation      ON public.ai_usage_log(operation);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_case_id        ON public.ai_usage_log(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_client_id      ON public.ai_usage_log(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_file_id        ON public.ai_usage_log(file_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_org_created_at ON public.ai_usage_log(organization_id, created_at DESC);