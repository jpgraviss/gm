create table if not exists public.delivery_workflows (
  id                text primary key,
  company_id        text,
  project_id        text,
  company_name      text not null,
  project_name      text,
  service_type      text not null default 'Website',
  step_01_agreement       text not null default 'Pending',
  step_01_contract_id     text,
  step_01_completed_at    timestamptz,
  step_02_invoice         text not null default 'Pending',
  step_02_invoice_id      text,
  step_02_completed_at    timestamptz,
  step_03_welcome         text not null default 'Pending',
  step_03_email_sent_at   timestamptz,
  step_03_opened_at       timestamptz,
  step_04_portal          text not null default 'Pending',
  step_04_first_login     timestamptz,
  step_05_strategy_call   text not null default 'Pending',
  step_05_booking_id      text,
  step_05_completed_at    timestamptz,
  step_05_notes           text,
  step_06_usage_guide     text not null default 'Pending',
  step_06_email_sent_at   timestamptz,
  step_06_opened_at       timestamptz,
  step_07_fulfillment     text not null default 'Pending',
  step_07_deliverables    jsonb not null default '[]',
  step_07_completed_at    timestamptz,
  step_08_monthly_report  text not null default 'Pending',
  step_08_last_sent_at    timestamptz,
  step_08_send_day        integer default 5,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_delivery_workflows_company on public.delivery_workflows(company_id);
create index if not exists idx_delivery_workflows_project on public.delivery_workflows(project_id);

create table if not exists public.delivery_templates (
  id              text primary key,
  step            integer not null,
  template_type   text not null,
  name            text not null,
  file_path       text not null,
  file_size       integer,
  version         text default 'v1',
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id              text primary key,
  workflow_id     text references public.delivery_workflows(id) on delete cascade,
  company_id      text,
  step            integer,
  event_type      text not null,
  description     text,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_delivery_events_workflow on public.delivery_events(workflow_id);
create index if not exists idx_delivery_events_company on public.delivery_events(company_id);

alter table public.delivery_workflows enable row level security;
alter table public.delivery_templates enable row level security;
alter table public.delivery_events enable row level security;
create policy "auth_all_delivery_workflows" on public.delivery_workflows for all to authenticated using (true) with check (true);
create policy "auth_all_delivery_templates" on public.delivery_templates for all to authenticated using (true) with check (true);
create policy "auth_all_delivery_events" on public.delivery_events for all to authenticated using (true) with check (true);
