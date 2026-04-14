-- ─── Google marketing integrations (GSC, GA4, Ads, GBP) ────────────────────
-- One row per workspace per product. Tokens encrypted at rest (same
-- pattern as calendar_settings). Kept separate from Calendar/Drive/Gmail
-- so existing flows remain untouched.

create table if not exists public.google_integrations (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  product       text not null,              -- 'search_console' | 'analytics' | 'ads' | 'business_profile'
  account_email text,                       -- Google account that granted access
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scopes        text[] not null default '{}',
  metadata      jsonb not null default '{}',
  status        text not null default 'connected',
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, product)
);

create index if not exists idx_google_integrations_workspace on public.google_integrations(workspace_id);
create index if not exists idx_google_integrations_product on public.google_integrations(product);

alter table public.google_integrations enable row level security;
create policy "auth_read_google_integrations"  on public.google_integrations for select to authenticated using (true);
create policy "auth_write_google_integrations" on public.google_integrations for all to authenticated using (true) with check (true);

-- ─── Client reporting data ──────────────────────────────────────────────────
-- Stores per-client snapshots of GSC/GA4/Ads/GBP data for monthly reports.

create table if not exists public.client_data_snapshots (
  id             text primary key,
  workspace_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id     text,
  company_name   text not null,
  product        text not null,              -- 'search_console' | 'analytics' | 'ads' | 'business_profile' | 'uptime' | 'rank_tracker'
  period_start   date not null,
  period_end     date not null,
  metrics        jsonb not null default '{}',
  raw_data       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_client_data_company on public.client_data_snapshots(company_name);
create index if not exists idx_client_data_product on public.client_data_snapshots(product);
create index if not exists idx_client_data_period on public.client_data_snapshots(period_start, period_end);

alter table public.client_data_snapshots enable row level security;
create policy "auth_read_client_data"  on public.client_data_snapshots for select to authenticated using (true);
create policy "auth_write_client_data" on public.client_data_snapshots for all to authenticated using (true) with check (true);

-- ─── Monitored websites (uptime + lighthouse) ──────────────────────────────
create table if not exists public.monitored_sites (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id    text,
  company_name  text not null,
  url           text not null,
  check_interval_minutes integer not null default 15,
  alert_emails  text[] not null default '{}',
  status        text not null default 'up',  -- 'up' | 'down' | 'degraded' | 'paused'
  last_check_at timestamptz,
  last_up_at    timestamptz,
  last_down_at  timestamptz,
  response_time_ms integer,
  uptime_30d    numeric(5,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_monitored_sites_workspace on public.monitored_sites(workspace_id);
create index if not exists idx_monitored_sites_status on public.monitored_sites(status);

alter table public.monitored_sites enable row level security;
create policy "auth_read_monitored_sites"  on public.monitored_sites for select to authenticated using (true);
create policy "auth_write_monitored_sites" on public.monitored_sites for all to authenticated using (true) with check (true);

create table if not exists public.uptime_checks (
  id             text primary key,
  workspace_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  site_id        text not null references public.monitored_sites(id) on delete cascade,
  checked_at     timestamptz not null default now(),
  status_code    integer,
  response_time_ms integer,
  up             boolean not null default true,
  error_message  text
);

create index if not exists idx_uptime_checks_site on public.uptime_checks(site_id, checked_at desc);

alter table public.uptime_checks enable row level security;
create policy "auth_read_uptime_checks"  on public.uptime_checks for select to authenticated using (true);
create policy "auth_write_uptime_checks" on public.uptime_checks for all to authenticated using (true) with check (true);

-- ─── Tracked keywords (for rank tracker) ────────────────────────────────────
create table if not exists public.tracked_keywords (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id    text,
  company_name  text not null,
  site_url      text not null,
  keyword       text not null,
  country       text not null default 'US',
  current_position numeric,
  previous_position numeric,
  best_position numeric,
  last_checked_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_tracked_keywords_workspace on public.tracked_keywords(workspace_id);
create index if not exists idx_tracked_keywords_company on public.tracked_keywords(company_name);

alter table public.tracked_keywords enable row level security;
create policy "auth_read_tracked_keywords"  on public.tracked_keywords for select to authenticated using (true);
create policy "auth_write_tracked_keywords" on public.tracked_keywords for all to authenticated using (true) with check (true);

create table if not exists public.keyword_rank_history (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  tracked_keyword_id text not null references public.tracked_keywords(id) on delete cascade,
  position        numeric,
  checked_at      timestamptz not null default now()
);

create index if not exists idx_rank_history_kw on public.keyword_rank_history(tracked_keyword_id, checked_at desc);

alter table public.keyword_rank_history enable row level security;
create policy "auth_read_rank_history"  on public.keyword_rank_history for select to authenticated using (true);
create policy "auth_write_rank_history" on public.keyword_rank_history for all to authenticated using (true) with check (true);
