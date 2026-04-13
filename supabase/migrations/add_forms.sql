-- ─── Lead forms ─────────────────────────────────────────────────────────────
-- Embeddable lead-capture forms. Fields stored as JSONB so users can add/
-- remove/reorder without schema migrations. Submissions create CRM contacts.

create table if not exists public.forms (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  name            text not null,
  slug            text unique not null,
  description     text,
  fields          jsonb not null default '[]',
  submit_label    text not null default 'Submit',
  success_message text not null default 'Thanks! We''ll be in touch.',
  redirect_url    text,
  notify_emails   text[] not null default '{}',
  create_contact  boolean not null default true,
  create_deal     boolean not null default false,
  deal_stage      text,
  tags            text[] not null default '{}',
  owner           text,
  status          text not null default 'Active',
  submissions_count integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_forms_workspace on public.forms(workspace_id);
create index if not exists idx_forms_status on public.forms(status);

alter table public.forms enable row level security;
create policy "auth_read_forms"   on public.forms for select to authenticated using (true);
create policy "auth_write_forms"  on public.forms for all to authenticated using (true) with check (true);
create policy "anon_read_forms"   on public.forms for select to anon using (true);

-- Form submissions — one row per client-side submit
create table if not exists public.form_submissions (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  form_id       text not null references public.forms(id) on delete cascade,
  data          jsonb not null default '{}',
  source_url    text,
  ip_address    text,
  user_agent    text,
  contact_id    text,
  status        text not null default 'new',
  created_at    timestamptz not null default now()
);

create index if not exists idx_form_submissions_form on public.form_submissions(form_id);
create index if not exists idx_form_submissions_workspace on public.form_submissions(workspace_id);
create index if not exists idx_form_submissions_created on public.form_submissions(created_at desc);

alter table public.form_submissions enable row level security;
create policy "auth_read_form_submissions"  on public.form_submissions for select to authenticated using (true);
create policy "auth_write_form_submissions" on public.form_submissions for all to authenticated using (true) with check (true);
create policy "anon_insert_form_submissions" on public.form_submissions for insert to anon with check (true);
