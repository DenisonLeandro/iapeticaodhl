ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS publication_config jsonb NOT NULL DEFAULT '{"source": "datajud", "datajud": {"enabled": true}, "djen": {"enabled": false}}'::jsonb;