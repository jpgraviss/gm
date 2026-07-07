-- ─── 6-month re-sign-in requirement on OAuth connections ──────────────────
-- Adds a `connected_at` column to every OAuth-backed integration table so
-- we can enforce a 180-day re-auth policy across Google (calendar, drive,
-- gmail, marketing products) and Meta Ads. Tokens still refresh normally
-- inside the window; after 180 days, the library layer treats the token
-- as expired and returns null → the UI prompts a fresh consent flow.

alter table public.google_integrations
  add column if not exists connected_at timestamptz not null default now();

alter table public.meta_integration
  add column if not exists connected_at timestamptz not null default now();

-- Existing Calendar / Drive / Gmail tables get the same column so the
-- 180-day policy applies universally. Nullable since older installs may
-- not know when they first connected.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'calendar_settings') then
    alter table public.calendar_settings add column if not exists connected_at timestamptz;
  end if;
end $$;

-- app_settings stores Google Drive OAuth tokens as JSONB. No column change
-- needed there — the library layer reads the existing `connected_at` key
-- from the JSONB payload (or writes it on next reconnect).

-- Backfill for existing connected rows so they aren't immediately expired
update public.google_integrations set connected_at = now() where connected_at is null;
update public.meta_integration   set connected_at = now() where connected_at is null;
update public.calendar_settings   set connected_at = now() where connected_at is null;
