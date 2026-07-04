-- Add training_modules JSONB column to app_settings for sales enablement LMS
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS training_modules jsonb NOT NULL DEFAULT '[]';
