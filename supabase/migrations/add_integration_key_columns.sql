ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mercury jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maverick jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS twilio jsonb NOT NULL DEFAULT '{}';
