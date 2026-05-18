create table if not exists public.scheduled_emails (
  id text primary key,
  to_email text not null,
  to_name text,
  subject text not null,
  html text not null,
  send_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'cancelled')),
  type text not null default 'notification',
  recurring text default 'none' check (recurring in ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  metadata jsonb default '{}',
  error text,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists idx_scheduled_emails_send_at on public.scheduled_emails(send_at) where status = 'pending';
create index if not exists idx_scheduled_emails_status on public.scheduled_emails(status);
