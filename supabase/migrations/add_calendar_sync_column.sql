-- Add last_calendar_sync column to app_settings if it doesn't exist
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS last_calendar_sync timestamptz;
-- Add gcal_links column for storing Google Appointment Scheduling links per user
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS gcal_links jsonb DEFAULT '{}';
