-- Per-link click tracking for email broadcasts
create table if not exists public.broadcast_link_clicks (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  broadcast_id    text not null references public.broadcasts(id) on delete cascade,
  contact_id      text,
  email           text,
  original_url    text,
  clicked_at      timestamptz not null default now()
);

create index if not exists idx_broadcast_link_clicks_broadcast on public.broadcast_link_clicks(broadcast_id);
create index if not exists idx_broadcast_link_clicks_email on public.broadcast_link_clicks(email);

alter table public.broadcast_link_clicks enable row level security;
create policy "auth_read_broadcast_link_clicks"  on public.broadcast_link_clicks for select to authenticated using (true);
create policy "auth_write_broadcast_link_clicks" on public.broadcast_link_clicks for all to authenticated using (true) with check (true);
