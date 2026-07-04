-- Add dismissed_duplicates column for ignoring duplicate groups in CRM
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS dismissed_duplicates jsonb NOT NULL DEFAULT '{}';
