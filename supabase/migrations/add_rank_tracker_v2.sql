-- Rank tracker v2: tags, target URL, search engine, location, search volume, competitors, scheduled reports

alter table public.tracked_keywords
  add column if not exists tags text[] not null default '{}',
  add column if not exists target_url text,
  add column if not exists search_engine text not null default 'google',
  add column if not exists location text,
  add column if not exists search_volume integer;

create index if not exists idx_tracked_keywords_tags on public.tracked_keywords using gin(tags);
create index if not exists idx_tracked_keywords_company_id on public.tracked_keywords(company_id);

-- Competitor domains per workspace
create table if not exists public.rank_tracker_competitors (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  domain        text not null,
  label         text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, domain)
);

alter table public.rank_tracker_competitors enable row level security;
create policy "auth_read_rt_competitors"  on public.rank_tracker_competitors for select to authenticated using (true);
create policy "auth_write_rt_competitors" on public.rank_tracker_competitors for all to authenticated using (true) with check (true);

-- Competitor rank snapshots (one per competitor + keyword check)
create table if not exists public.competitor_rank_snapshots (
  id                text primary key,
  workspace_id      uuid not null default '00000000-0000-0000-0000-000000000001',
  competitor_id     text not null references public.rank_tracker_competitors(id) on delete cascade,
  tracked_keyword_id text not null references public.tracked_keywords(id) on delete cascade,
  position          numeric,
  url               text,
  checked_at        timestamptz not null default now()
);

create index if not exists idx_competitor_snapshots_kw on public.competitor_rank_snapshots(tracked_keyword_id, checked_at desc);

alter table public.competitor_rank_snapshots enable row level security;
create policy "auth_read_competitor_snaps"  on public.competitor_rank_snapshots for select to authenticated using (true);
create policy "auth_write_competitor_snaps" on public.competitor_rank_snapshots for all to authenticated using (true) with check (true);

-- Scheduled rank reports
create table if not exists public.rank_tracker_reports (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  name          text not null,
  frequency     text not null default 'weekly',
  recipients    text[] not null default '{}',
  filters       jsonb not null default '{}',
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.rank_tracker_reports enable row level security;
create policy "auth_read_rt_reports"  on public.rank_tracker_reports for select to authenticated using (true);
create policy "auth_write_rt_reports" on public.rank_tracker_reports for all to authenticated using (true) with check (true);
