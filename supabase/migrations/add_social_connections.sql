-- ─── Social publishing connections ─────────────────────────────────────────
-- One row per (workspace, platform). Stores which specific account/page/
-- location/org a workspace publishes to, plus the platform-specific access
-- token (encrypted at the app layer via lib/encryption). Publishing looks this
-- up to know where to post; the settings/social UI reads status from here.
--
-- platform      : 'facebook' | 'instagram' | 'linkedin' | 'google_business'
-- external_id   : Facebook Page id / IG business account id / LinkedIn org URN /
--                 GBP location name ("accounts/{a}/locations/{l}")
-- access_token  : encrypted page/user token (NULL for google_business, which
--                 posts through the shared Google Marketing OAuth token)

create table if not exists public.social_connections (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  platform      text not null,
  account_label text,
  external_id   text,
  access_token  text,
  metadata      jsonb not null default '{}',
  status        text not null default 'connected',
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, platform)
);

create index if not exists idx_social_connections_workspace on public.social_connections(workspace_id);
create index if not exists idx_social_connections_platform on public.social_connections(platform);

alter table public.social_connections enable row level security;
drop policy if exists "auth_read_social_connections" on public.social_connections;
drop policy if exists "auth_write_social_connections" on public.social_connections;
create policy "auth_read_social_connections"  on public.social_connections for select to authenticated using (true);
create policy "auth_write_social_connections" on public.social_connections for all to authenticated using (true) with check (true);
