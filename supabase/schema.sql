-- ─── GravHub Database Schema ──────────────────────────────────────────────────
-- Run this in your Supabase SQL editor to set up the database.

-- ── Team Members ──────────────────────────────────────────────────────────────
create table if not exists team_members (
  id          text primary key,
  name        text not null,
  email       text unique not null,
  role        text not null,
  unit        text not null,
  initials    text not null,
  created_at  timestamptz default now()
);

-- ── CRM Companies ─────────────────────────────────────────────────────────────
create table if not exists crm_companies (
  id               text primary key,
  name             text not null,
  industry         text,
  website          text,
  phone            text,
  hq               text,
  size             text,
  annual_revenue   bigint,
  status           text not null default 'Prospect',
  owner            text,
  description      text,
  tags             text[] default '{}',
  contact_ids      text[] default '{}',
  deal_ids         text[] default '{}',
  total_deal_value bigint default 0,
  created_at       timestamptz default now(),
  last_activity    timestamptz
);

-- ── CRM Contacts ──────────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id               text primary key,
  company_id       text references crm_companies(id) on delete set null,
  company_name     text,
  first_name       text not null,
  last_name        text not null,
  full_name        text not null,
  title            text,
  emails           text[] default '{}',
  phones           text[] default '{}',
  linked_in        text,
  website          text,
  is_primary       boolean default false,
  lifecycle_stage  text,
  owner            text,
  tags             text[] default '{}',
  notes            text,
  contact_notes    jsonb default '[]',
  contact_tasks    jsonb default '[]',
  created_at       timestamptz default now(),
  last_activity    timestamptz
);

-- ── Deals ─────────────────────────────────────────────────────────────────────
create table if not exists deals (
  id            text primary key,
  company       text not null,
  stage         text not null default 'Lead',
  value         bigint default 0,
  service_type  text,
  close_date    date,
  assigned_rep  text,
  probability   int default 0,
  notes         text[] default '{}',
  last_activity text,
  contact       jsonb,
  created_at    timestamptz default now()
);

-- ── Proposals ─────────────────────────────────────────────────────────────────
create table if not exists proposals (
  id                          text primary key,
  deal_id                     text,
  company                     text not null,
  status                      text not null default 'Draft',
  value                       bigint default 0,
  service_type                text,
  assigned_rep                text,
  items                       jsonb default '[]',
  submitted_for_approval_date date,
  approved_by                 text,
  approved_date               date,
  rejected_by                 text,
  rejected_date               date,
  is_renewal                  boolean default false,
  internal_only               boolean default false,
  renewal_notes               text,
  sent_date                   date,
  viewed_date                 date,
  responded_date              date,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- ── Contracts ─────────────────────────────────────────────────────────────────
create table if not exists contracts (
  id                text primary key,
  proposal_id       text references proposals(id) on delete set null,
  company           text not null,
  status            text not null default 'Draft',
  value             bigint default 0,
  billing_structure text,
  start_date        date,
  duration          int default 12,
  renewal_date      date,
  assigned_rep      text,
  service_type      text,
  client_signed     date,
  internal_signed   date,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── Invoices ──────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id           text primary key,
  contract_id  text references contracts(id) on delete set null,
  company      text not null,
  amount       bigint default 0,
  status       text not null default 'Pending',
  due_date     date,
  issued_date  date,
  paid_date    date,
  service_type text,
  created_at   timestamptz default now()
);

-- ── Projects ──────────────────────────────────────────────────────────────────
create table if not exists projects (
  id                    text primary key,
  contract_id           text references contracts(id) on delete set null,
  company               text not null,
  service_type          text,
  status                text not null default 'Not Started',
  start_date            date,
  launch_date           date,
  maintenance_start_date date,
  assigned_team         text[] default '{}',
  progress              int default 0,
  milestones            jsonb default '[]',
  tasks                 jsonb default '[]',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── Maintenance Records ───────────────────────────────────────────────────────
create table if not exists maintenance_records (
  id                  text primary key,
  company             text not null,
  service_type        text,
  start_date          date,
  monthly_fee         bigint default 0,
  contract_duration   int default 12,
  cancellation_window int default 30,
  status              text not null default 'Active',
  next_billing_date   date,
  documents           jsonb default '[]',
  created_at          timestamptz default now()
);

-- ── Renewals ──────────────────────────────────────────────────────────────────
create table if not exists renewals (
  id               text primary key,
  company          text not null,
  contract_id      text references contracts(id) on delete set null,
  expiration_date  date,
  renewal_value    bigint default 0,
  assigned_rep     text,
  status           text not null default 'Upcoming',
  days_until_expiry int default 0,
  service_type     text,
  created_at       timestamptz default now()
);

-- ── Time Entries ──────────────────────────────────────────────────────────────
create table if not exists time_entries (
  id           text primary key,
  date         date not null,
  project_id   text,
  project_name text,
  description  text not null,
  team_member  text not null,
  service_type text,
  hours        int default 0,
  minutes      int default 0,
  billable     boolean default true,
  created_at   timestamptz default now()
);

-- ── App Tasks ─────────────────────────────────────────────────────────────────
create table if not exists app_tasks (
  id                text primary key,
  title             text not null,
  description       text,
  category          text,
  priority          text default 'Medium',
  status            text default 'Pending',
  company           text,
  assigned_to       text,
  due_date          date,
  created_date      date,
  completed_date    date,
  linked_id         text,
  team_service_line text,
  created_at        timestamptz default now()
);

-- ── CRM Activities ────────────────────────────────────────────────────────────
create table if not exists crm_activities (
  id           text primary key,
  type         text not null,
  title        text not null,
  body         text,
  company_id   text,
  company_name text,
  contact_id   text,
  contact_name text,
  deal_id      text,
  "user"       text,
  timestamp    timestamptz default now(),
  duration     int,
  outcome      text,
  next_step    text,
  pinned       boolean default false
);

-- ── Row Level Security (optional — enable when adding auth) ───────────────────
-- alter table proposals enable row level security;
-- alter table contracts enable row level security;
-- alter table time_entries enable row level security;

-- ── Updated_at trigger ────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger proposals_updated_at before update on proposals
  for each row execute function update_updated_at();

create trigger contracts_updated_at before update on contracts
  for each row execute function update_updated_at();

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();
