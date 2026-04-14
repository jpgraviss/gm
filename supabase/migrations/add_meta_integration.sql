create table if not exists public.meta_integration (
  id text primary key,
  workspace_id uuid not null default '00000000-0000-0000-0000-000000000001',
  account_email text,
  access_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  ad_account_id text,
  metadata jsonb not null default '{}',
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);
create index if not exists idx_meta_integration_workspace on public.meta_integration(workspace_id);
alter table public.meta_integration enable row level security;
create policy "auth_read_meta" on public.meta_integration for select to authenticated using (true);
create policy "auth_write_meta" on public.meta_integration for all to authenticated using (true) with check (true);
