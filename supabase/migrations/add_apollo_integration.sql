ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS apollo jsonb NOT NULL DEFAULT '{}';
