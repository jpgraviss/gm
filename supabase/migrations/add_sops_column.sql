ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS sops jsonb NOT NULL DEFAULT '[]';
