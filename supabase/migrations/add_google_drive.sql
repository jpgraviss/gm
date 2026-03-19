-- Add google_drive jsonb column to app_settings for Drive OAuth tokens and config
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS google_drive jsonb not null default '{}';
