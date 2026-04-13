-- ─── Email broadcasts (one-off mass email campaigns) ───────────────────────
-- Distinct from `sequences` which are drip/nurture. Broadcasts are single
-- sends to a defined audience. Sends via Resend Broadcasts API.

create table if not exists public.broadcasts (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  name            text not null,
  subject         text not null,
  from_name       text not null default 'Graviss Marketing',
  from_email      text not null default 'noreply@app.gravissmarketing.com',
  reply_to        text,
  html_body       text not null default '',
  plain_body      text,
  preview_text    text,
  audience_filter jsonb not null default '{}',
  audience_count  integer not null default 0,
  status          text not null default 'draft',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  resend_id       text,
  total_sent      integer not null default 0,
  total_delivered integer not null default 0,
  total_opened    integer not null default 0,
  total_clicked   integer not null default 0,
  total_bounced   integer not null default 0,
  total_unsubscribed integer not null default 0,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_broadcasts_workspace on public.broadcasts(workspace_id);
create index if not exists idx_broadcasts_status on public.broadcasts(status);
create index if not exists idx_broadcasts_created on public.broadcasts(created_at desc);

alter table public.broadcasts enable row level security;
create policy "auth_read_broadcasts"  on public.broadcasts for select to authenticated using (true);
create policy "auth_write_broadcasts" on public.broadcasts for all to authenticated using (true) with check (true);

-- Per-recipient tracking for delivery + engagement reconciliation
create table if not exists public.broadcast_recipients (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  broadcast_id    text not null references public.broadcasts(id) on delete cascade,
  contact_id      text,
  email           text not null,
  status          text not null default 'pending',
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  bounced_at      timestamptz,
  unsubscribed_at timestamptz,
  resend_message_id text
);

create index if not exists idx_broadcast_recipients_broadcast on public.broadcast_recipients(broadcast_id);
create index if not exists idx_broadcast_recipients_email on public.broadcast_recipients(email);
create index if not exists idx_broadcast_recipients_workspace on public.broadcast_recipients(workspace_id);

alter table public.broadcast_recipients enable row level security;
create policy "auth_read_broadcast_recipients"  on public.broadcast_recipients for select to authenticated using (true);
create policy "auth_write_broadcast_recipients" on public.broadcast_recipients for all to authenticated using (true) with check (true);
