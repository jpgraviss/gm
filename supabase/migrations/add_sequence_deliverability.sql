-- Migration: add_sequence_deliverability
-- Adds sequence activities, suppression list, and deliverability columns

-- 1. sequence_activities table
create table if not exists public.sequence_activities (
  id            text primary key,
  sequence_id   text not null references public.sequences(id) on delete cascade,
  enrollment_id text references public.sequence_enrollments(id) on delete set null,
  contact_id    text,
  contact_email text not null,
  step_index    integer not null default 0,
  event_type    text not null, -- 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'unsubscribed', 'failed'
  metadata      jsonb default '{}', -- link clicked, bounce reason, etc
  message_id    text, -- email provider message ID for threading
  created_at    timestamptz not null default now()
);

create index if not exists idx_seq_activities_seq_event
  on public.sequence_activities (sequence_id, event_type);

create index if not exists idx_seq_activities_enrollment
  on public.sequence_activities (enrollment_id);

-- 2. sequence_suppression_list table
create table if not exists public.sequence_suppression_list (
  id         text primary key,
  email      text not null unique,
  reason     text not null, -- 'unsubscribed', 'bounced', 'complained'
  source     text, -- which sequence caused it
  created_at timestamptz not null default now()
);

-- 3. Add columns to sequences table
alter table public.sequences
  add column if not exists send_via text default 'gmail',
  add column if not exists from_name text,
  add column if not exists from_email text,
  add column if not exists assigned_rep_id text,
  add column if not exists meeting_rate numeric default 0,
  add column if not exists bounce_rate numeric default 0,
  add column if not exists unsubscribe_rate numeric default 0,
  add column if not exists owner text,
  add column if not exists daily_send_limit integer default 200,
  add column if not exists per_minute_limit integer default 3,
  add column if not exists send_window_start integer default 8, -- hour in UTC
  add column if not exists send_window_end integer default 18,
  add column if not exists send_on_weekends boolean default false,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists thread_mode boolean default true,
  add column if not exists sharing text default 'private', -- 'private', 'team', 'everyone'
  add column if not exists folder text;

-- 4. Add columns to sequence_enrollments table
alter table public.sequence_enrollments
  add column if not exists assigned_rep_id text,
  add column if not exists company text,
  add column if not exists deal_id text,
  add column if not exists unenroll_reason text, -- 'replied', 'bounced', 'unsubscribed', 'meeting_booked', 'manual', 'company_reply'
  add column if not exists message_ids jsonb default '[]', -- array of email message IDs for threading
  add column if not exists ab_variant text; -- 'A' or 'B' for A/B test tracking

-- 5. Add columns to crm_contacts table
alter table public.crm_contacts
  add column if not exists in_sequence boolean default false,
  add column if not exists current_sequence_id text,
  add column if not exists last_sequence_id text,
  add column if not exists last_sequence_date timestamptz;

-- 6. Enable RLS on new tables with authenticated read policies
alter table public.sequence_activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'auth_read_seq_activities' and tablename = 'sequence_activities'
  ) then
    create policy "auth_read_seq_activities" on public.sequence_activities for select to authenticated using (true);
  end if;
end$$;

alter table public.sequence_suppression_list enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'auth_read_suppression' and tablename = 'sequence_suppression_list'
  ) then
    create policy "auth_read_suppression" on public.sequence_suppression_list for select to authenticated using (true);
  end if;
end$$;

-- 7. Write policies for new tables
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'auth_write_seq_activities' and tablename = 'sequence_activities'
  ) then
    create policy "auth_write_seq_activities" on public.sequence_activities for all to authenticated using (true) with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'auth_write_suppression' and tablename = 'sequence_suppression_list'
  ) then
    create policy "auth_write_suppression" on public.sequence_suppression_list for all to authenticated using (true) with check (true);
  end if;
end$$;
