-- ─── Social media posts + scheduling ───────────────────────────────────────
-- Each post can target multiple platforms. Publishing is handled by the
-- cron job or manual trigger. Approval workflow lets clients review before
-- posts go live.

create table if not exists public.social_posts (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id      text,
  company_name    text not null,
  content         text not null default '',
  media_urls      text[] not null default '{}',
  platforms       text[] not null default '{}',
  scheduled_at    timestamptz,
  published_at    timestamptz,
  status          text not null default 'draft',
  approval_status text not null default 'pending',
  approved_by     text,
  approved_at     timestamptz,
  rejection_reason text,
  platform_post_ids jsonb not null default '{}',
  platform_errors  jsonb not null default '{}',
  hashtags        text[] not null default '{}',
  link_url        text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_social_posts_workspace on public.social_posts(workspace_id);
create index if not exists idx_social_posts_company on public.social_posts(company_name);
create index if not exists idx_social_posts_status on public.social_posts(status);
create index if not exists idx_social_posts_scheduled on public.social_posts(scheduled_at);

alter table public.social_posts enable row level security;
drop policy if exists "auth_read_social_posts" on public.social_posts;
drop policy if exists "auth_write_social_posts" on public.social_posts;
create policy "auth_read_social_posts"  on public.social_posts for select to authenticated using (true);
create policy "auth_write_social_posts" on public.social_posts for all to authenticated using (true) with check (true);

-- ─── Brand kits / asset library per client ─────────────────────────────────
create table if not exists public.brand_kits (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id      text,
  company_name    text not null,
  logo_url        text,
  primary_color   text,
  secondary_color text,
  fonts           text[] not null default '{}',
  tone_of_voice   text,
  hashtags        text[] not null default '{}',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, company_name)
);

create index if not exists idx_brand_kits_workspace on public.brand_kits(workspace_id);

alter table public.brand_kits enable row level security;
drop policy if exists "auth_read_brand_kits" on public.brand_kits;
drop policy if exists "auth_write_brand_kits" on public.brand_kits;
create policy "auth_read_brand_kits"  on public.brand_kits for select to authenticated using (true);
create policy "auth_write_brand_kits" on public.brand_kits for all to authenticated using (true) with check (true);
