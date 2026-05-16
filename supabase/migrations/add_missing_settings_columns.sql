-- Add missing app_settings columns for engagement, navigation, and notification preferences
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS engagement jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS navigation_config jsonb,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}';

-- Add missing forms column for popup embed configuration
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS popup_config jsonb;
