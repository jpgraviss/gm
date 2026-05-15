-- Add email defaults and dashboard config to app_settings
alter table public.app_settings
  add column if not exists email_defaults jsonb not null default '{}',
  add column if not exists dashboard_config jsonb not null default '{}';
