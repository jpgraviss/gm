-- ─────────────────────────────────────────────────────────────────────────────
-- GravHub — Complete Supabase Schema
-- Run this entire file in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─── Team Members ─────────────────────────────────────────────────────────────
create table if not exists public.team_members (
  id          text primary key,
  name        text not null,
  email       text not null unique,
  role        text not null default 'Team Member',
  unit        text not null default 'Leadership/Admin',
  initials    text,
  status      text not null default 'Active',
  is_admin    boolean not null default false,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

-- ─── CRM Companies ────────────────────────────────────────────────────────────
create table if not exists public.crm_companies (
  id               text primary key,
  name             text not null,
  industry         text not null default '',
  website          text,
  phone            text,
  hq               text not null default '',
  size             text not null default '1-10',
  annual_revenue   numeric,
  status           text not null default 'Prospect',
  owner            text not null default '',
  description      text,
  tags             text[] not null default '{}',
  contact_ids      text[] not null default '{}',
  deal_ids         text[] not null default '{}',
  total_deal_value numeric not null default 0,
  created_date     text,
  last_activity    text,
  created_at       timestamptz not null default now()
);

-- ─── CRM Contacts ─────────────────────────────────────────────────────────────
create table if not exists public.crm_contacts (
  id              text primary key,
  company_id      text references public.crm_companies(id) on delete set null,
  company_name    text not null default '',
  first_name      text not null default '',
  last_name       text not null default '',
  full_name       text not null default '',
  title           text,
  emails          text[] not null default '{}',
  phones          text[] not null default '{}',
  linked_in       text,
  website         text,
  is_primary      boolean not null default false,
  lifecycle_stage text,
  owner           text not null default '',
  tags            text[] not null default '{}',
  notes           text,
  contact_notes   jsonb not null default '[]',
  contact_tasks   jsonb not null default '[]',
  created_date    text,
  last_activity   text,
  created_at      timestamptz not null default now()
);

-- ─── CRM Activities ───────────────────────────────────────────────────────────
create table if not exists public.crm_activities (
  id           text primary key,
  type         text not null,
  title        text not null,
  body         text,
  company_id   text,
  company_name text,
  contact_id   text,
  contact_name text,
  deal_id      text,
  user_name    text not null default '',
  timestamp    text not null,
  duration     integer,
  outcome      text,
  next_step    text,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ─── Deals ────────────────────────────────────────────────────────────────────
create table if not exists public.deals (
  id            text primary key,
  company       text not null default '',
  contact       jsonb,
  stage         text not null default 'Lead',
  value         numeric not null default 0,
  service_type  text not null default 'General',
  close_date    text,
  assigned_rep  text not null default '',
  probability   integer not null default 0,
  notes         text[] not null default '{}',
  last_activity text,
  created_at    timestamptz not null default now()
);

-- ─── Proposals ────────────────────────────────────────────────────────────────
create table if not exists public.proposals (
  id                          text primary key,
  deal_id                     text references public.deals(id) on delete set null,
  company                     text not null default '',
  status                      text not null default 'Draft',
  value                       numeric not null default 0,
  service_type                text not null default 'General',
  assigned_rep                text not null default '',
  items                       jsonb not null default '[]',
  is_renewal                  boolean not null default false,
  internal_only               boolean not null default false,
  renewal_notes               text,
  sent_date                   text,
  viewed_date                 text,
  responded_date              text,
  submitted_for_approval_date text,
  approved_by                 text,
  approved_date               text,
  rejected_by                 text,
  rejected_date               text,
  created_date                text,
  created_at                  timestamptz not null default now()
);

-- ─── Contracts ────────────────────────────────────────────────────────────────
create table if not exists public.contracts (
  id                text primary key,
  proposal_id       text references public.proposals(id) on delete set null,
  company           text not null default '',
  status            text not null default 'Draft',
  value             numeric not null default 0,
  billing_structure text not null default 'Monthly',
  start_date        text,
  duration          integer not null default 12,
  renewal_date      text,
  assigned_rep      text not null default '',
  service_type      text not null default 'General',
  client_signed     text,
  internal_signed   text,
  created_at        timestamptz not null default now()
);

-- ─── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id             text primary key,
  contract_id    text references public.contracts(id) on delete set null,
  company        text not null default '',
  amount         numeric not null default 0,
  status         text not null default 'Pending',
  due_date       text,
  issued_date    text,
  paid_date      text,
  service_type   text not null default 'General',
  qb_invoice_id  text unique,
  client         text,
  amount_paid    numeric not null default 0,
  issue_date     text,
  source         text not null default 'manual',
  created_at     timestamptz not null default now()
);

-- ─── Projects ─────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id                     text primary key,
  contract_id            text references public.contracts(id) on delete set null,
  company                text not null default '',
  service_type           text not null default 'General',
  status                 text not null default 'Not Started',
  start_date             text,
  launch_date            text,
  maintenance_start_date text,
  assigned_team          text[] not null default '{}',
  progress               integer not null default 0,
  milestones             jsonb not null default '[]',
  tasks                  jsonb not null default '[]',
  notes                  jsonb not null default '[]',
  overview               text not null default '',
  created_at             timestamptz not null default now()
);

-- ─── Maintenance Records ──────────────────────────────────────────────────────
create table if not exists public.maintenance_records (
  id                  text primary key,
  company             text not null default '',
  service_type        text not null default 'Website',
  start_date          text,
  monthly_fee         numeric not null default 0,
  contract_duration   integer not null default 12,
  cancellation_window integer not null default 30,
  status              text not null default 'Active',
  next_billing_date   text,
  documents           jsonb not null default '[]',
  created_at          timestamptz not null default now()
);

-- ─── Renewals ─────────────────────────────────────────────────────────────────
create table if not exists public.renewals (
  id                text primary key,
  company           text not null default '',
  contract_id       text references public.contracts(id) on delete set null,
  expiration_date   text,
  renewal_value     numeric not null default 0,
  assigned_rep      text not null default '',
  status            text not null default 'Upcoming',
  days_until_expiry integer not null default 0,
  service_type      text not null default 'General',
  created_at        timestamptz not null default now()
);

-- ─── App Tasks ────────────────────────────────────────────────────────────────
create table if not exists public.app_tasks (
  id                text primary key,
  title             text not null,
  description       text,
  category          text not null default 'General',
  priority          text not null default 'Medium',
  status            text not null default 'Pending',
  company           text,
  assigned_to       text not null default '',
  due_date          text,
  created_date      text,
  completed_date    text,
  linked_id         text,
  team_service_line text,
  created_at        timestamptz not null default now()
);

-- ─── Time Entries ─────────────────────────────────────────────────────────────
create table if not exists public.time_entries (
  id           text primary key,
  date         text not null,
  project_id   text,
  project_name text,
  description  text not null default '',
  team_member  text not null default '',
  service_type text not null default 'General',
  hours        integer not null default 0,
  minutes      integer not null default 0,
  billable     boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─── Tickets ──────────────────────────────────────────────────────────────────
create table if not exists public.tickets (
  id             text primary key,
  subject        text not null,
  company        text not null default '',
  contact_name   text,
  contact_email  text,
  status         text not null default 'Open',
  priority       text not null default 'Medium',
  source         text not null default 'Email',
  service_type   text not null default 'General',
  project_id     text,
  assigned_to    text,
  tags           text[] not null default '{}',
  messages       jsonb not null default '[]',
  linked_task_id text,
  created_date   text,
  updated_date   text,
  created_at     timestamptz not null default now()
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id         text primary key,
  user_name  text not null default '',
  action     text not null,
  module     text not null default '',
  type       text not null default 'action',
  metadata   jsonb,
  created_at timestamptz not null default now()
);

-- ─── Calendar Settings ────────────────────────────────────────────────────────
create table if not exists public.calendar_settings (
  id                   text primary key default gen_random_uuid()::text,
  user_email           text not null unique,
  user_name            text not null default '',
  slug                 text not null unique,
  title                text not null default 'Book a Call',
  description          text,
  duration             int  not null default 30,
  buffer               int  not null default 15,
  timezone             text not null default 'America/New_York',
  available_days       int[] not null default '{1,2,3,4,5}',
  available_start      text not null default '09:00',
  available_end        text not null default '17:00',
  google_access_token  text,
  google_refresh_token text,
  google_token_expiry  timestamptz,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id              text primary key default gen_random_uuid()::text,
  calendar_slug   text not null references public.calendar_settings(slug) on delete cascade,
  client_name     text not null,
  client_email    text not null,
  client_company  text,
  client_phone    text,
  notes           text,
  date            date not null,
  start_time      text not null,
  end_time        text not null,
  timezone        text not null default 'America/New_York',
  status          text not null default 'confirmed',
  google_event_id text,
  meet_link       text,
  created_at      timestamptz not null default now()
);

-- ─── Revenue by Month ─────────────────────────────────────────────────────────
create table if not exists public.revenue_months (
  id         text primary key default gen_random_uuid()::text,
  month      text not null unique,
  revenue    numeric not null default 0,
  recurring  numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- The service role key (used in API routes) bypasses RLS automatically.
-- Enable RLS and allow authenticated users to read all tables.

alter table public.team_members        enable row level security;
alter table public.crm_companies       enable row level security;
alter table public.crm_contacts        enable row level security;
alter table public.crm_activities      enable row level security;
alter table public.deals               enable row level security;
alter table public.proposals           enable row level security;
alter table public.contracts           enable row level security;
alter table public.invoices            enable row level security;
alter table public.projects            enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.renewals            enable row level security;
alter table public.app_tasks           enable row level security;
alter table public.time_entries        enable row level security;
alter table public.tickets             enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.calendar_settings   enable row level security;
alter table public.bookings            enable row level security;
alter table public.revenue_months      enable row level security;

-- Authenticated users: full read access
create policy "auth_read_team_members"        on public.team_members        for select to authenticated using (true);
create policy "auth_read_crm_companies"       on public.crm_companies       for select to authenticated using (true);
create policy "auth_read_crm_contacts"        on public.crm_contacts        for select to authenticated using (true);
create policy "auth_read_crm_activities"      on public.crm_activities      for select to authenticated using (true);
create policy "auth_read_deals"               on public.deals               for select to authenticated using (true);
create policy "auth_read_proposals"           on public.proposals           for select to authenticated using (true);
create policy "auth_read_contracts"           on public.contracts           for select to authenticated using (true);
create policy "auth_read_invoices"            on public.invoices            for select to authenticated using (true);
create policy "auth_read_projects"            on public.projects            for select to authenticated using (true);
create policy "auth_read_maintenance"         on public.maintenance_records for select to authenticated using (true);
create policy "auth_read_renewals"            on public.renewals            for select to authenticated using (true);
create policy "auth_read_app_tasks"           on public.app_tasks           for select to authenticated using (true);
create policy "auth_read_time_entries"        on public.time_entries        for select to authenticated using (true);
create policy "auth_read_tickets"             on public.tickets             for select to authenticated using (true);
create policy "auth_read_audit_logs"          on public.audit_logs          for select to authenticated using (true);
create policy "auth_read_calendar_settings"   on public.calendar_settings   for select to authenticated using (true);
create policy "auth_read_bookings"            on public.bookings            for select to authenticated using (true);
create policy "auth_read_revenue_months"      on public.revenue_months      for select to authenticated using (true);

-- Anon access for public booking page
create policy "anon_read_bookings"           on public.bookings          for select to anon using (true);
create policy "anon_insert_bookings"         on public.bookings          for insert to anon with check (true);
create policy "anon_read_calendar_settings"  on public.calendar_settings for select to anon using (true);

-- ─── Automations ──────────────────────────────────────────────────────────────
create table if not exists public.automations (
  id         text primary key,
  name       text not null,
  trigger    text not null,
  actions    text[] not null default '{}',
  status     text not null default 'Active',
  runs       integer not null default 0,
  last_run   text not null default 'Never',
  created_at timestamptz not null default now()
);

alter table public.automations enable row level security;
create policy "auth_read_automations" on public.automations for select to authenticated using (true);

-- ─── Email Sequences ──────────────────────────────────────────────────────────
create table if not exists public.sequences (
  id              text primary key,
  name            text not null,
  status          text not null default 'Draft',
  trigger         text not null default '',
  target_segment  text not null default '',
  enrolled_count  integer not null default 0,
  active_count    integer not null default 0,
  completed_count integer not null default 0,
  open_rate       numeric not null default 0,
  click_rate      numeric not null default 0,
  reply_rate      numeric not null default 0,
  steps           jsonb not null default '[]',
  created_date    text,
  last_modified   text,
  created_at      timestamptz not null default now()
);

alter table public.sequences enable row level security;
create policy "auth_read_sequences" on public.sequences for select to authenticated using (true);

-- ─── Sequence Enrollments ─────────────────────────────────────────────────────
create table if not exists public.sequence_enrollments (
  id            text primary key,
  sequence_id   text not null references public.sequences(id) on delete cascade,
  contact_id    text,
  contact_name  text not null default '',
  contact_email text not null,
  enrolled_at   timestamptz not null default now(),
  current_step  integer not null default 0,
  status        text not null default 'active',
  next_send_at  timestamptz,
  last_sent_at  timestamptz
);
alter table public.sequence_enrollments enable row level security;
create policy "auth_read_enrollments" on public.sequence_enrollments for select to authenticated using (true);

-- ─── Portal Clients ───────────────────────────────────────────────────────────
create table if not exists public.portal_clients (
  id         text primary key,
  company    text not null,
  service    text not null default '',
  access     text not null default 'Not Setup',
  last_login text not null default 'Never',
  contact    text not null default '',
  email      text not null default '',
  created_at timestamptz not null default now()
);

alter table public.portal_clients enable row level security;
create policy "auth_read_portal_clients" on public.portal_clients for select to authenticated using (true);

-- ─── App Settings ─────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  id               text primary key default 'global',
  company          jsonb not null default '{}',
  notifications    jsonb not null default '[]',
  invoice_defaults jsonb not null default '{}',
  pipeline_stages  jsonb not null default '[]',
  service_types    jsonb not null default '[]',
  contact_tags     jsonb not null default '[]',
  branding         jsonb not null default '{}',
  qb_sync          jsonb not null default '[]',
  updated_at       timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy "auth_read_app_settings"  on public.app_settings for select  to authenticated using (true);
create policy "auth_write_app_settings" on public.app_settings for all     to authenticated using (true) with check (true);

-- ─── QuickBooks Config ─────────────────────────────────────────────────────────
create table if not exists public.quickbooks_config (
  id               uuid        primary key default gen_random_uuid(),
  realm_id         text        not null,
  access_token     text        not null,
  refresh_token    text        not null,
  token_expires_at timestamptz not null,
  last_sync_at     timestamptz,
  invoices_synced  integer     not null default 0,
  payments_synced  integer     not null default 0,
  sync_errors      integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.quickbooks_config enable row level security;
create policy "auth_read_qb_config"  on public.quickbooks_config for select to authenticated using (true);
create policy "auth_write_qb_config" on public.quickbooks_config for all    to authenticated using (true) with check (true);
