-- Gmail tracking browser extension (HubSpot-style open/click tracking for
-- mail sent from a staff member's REAL Gmail, not GravHub's own send
-- pipeline). This is genuinely new infrastructure — sequence/broadcast
-- tracking is Resend-webhook-based and can't see anything Gmail sends
-- directly, so opens/clicks here come from a self-hosted tracking pixel +
-- click-redirect endpoint the extension embeds into the compose body
-- before Gmail sends it.
--
-- A browser extension can't share GravHub's session cookie (different
-- origin), so it authenticates with its own long-lived Bearer token —
-- extension_tokens stores only a SHA-256 hash of the real token, never the
-- token itself, same principle as an API key table.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm where tm.id = auth.uid()::text
  );
$$;

create table if not exists public.extension_tokens (
  id text primary key,
  team_member_id text not null references public.team_members(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_extension_tokens_team_member on public.extension_tokens(team_member_id);

create table if not exists public.tracked_emails (
  id text primary key,
  team_member_id text not null references public.team_members(id) on delete cascade,
  recipient_email text not null,
  contact_id text references public.crm_contacts(id) on delete set null,
  company_id text references public.crm_companies(id) on delete set null,
  subject text,
  sent_at timestamptz not null default now(),
  open_count int not null default 0,
  last_opened_at timestamptz,
  click_count int not null default 0,
  last_clicked_at timestamptz
);

create index if not exists idx_tracked_emails_team_member on public.tracked_emails(team_member_id, sent_at desc);
create index if not exists idx_tracked_emails_recipient on public.tracked_emails(recipient_email);

create table if not exists public.tracked_email_opens (
  id text primary key,
  tracked_email_id text not null references public.tracked_emails(id) on delete cascade,
  opened_at timestamptz not null default now(),
  user_agent text
);

create index if not exists idx_tracked_email_opens_email on public.tracked_email_opens(tracked_email_id);

create table if not exists public.tracked_email_clicks (
  id text primary key,
  tracked_email_id text not null references public.tracked_emails(id) on delete cascade,
  url text not null,
  clicked_at timestamptz not null default now()
);

create index if not exists idx_tracked_email_clicks_email on public.tracked_email_clicks(tracked_email_id);

alter table public.extension_tokens enable row level security;
alter table public.tracked_emails enable row level security;
alter table public.tracked_email_opens enable row level security;
alter table public.tracked_email_clicks enable row level security;

create policy "staff_all_extension_tokens" on public.extension_tokens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_tracked_emails" on public.tracked_emails for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_tracked_email_opens" on public.tracked_email_opens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_tracked_email_clicks" on public.tracked_email_clicks for all to authenticated using (public.is_staff()) with check (public.is_staff());
