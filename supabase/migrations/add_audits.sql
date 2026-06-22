-- Website & SEO Audits

create table if not exists public.audits (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  website_url   text not null,
  company_id    text,
  company_name  text,
  audit_type    text not null default 'full',
  status        text not null default 'pending',
  overall_score integer,
  overall_grade text,
  summary       text,
  sections      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_by    text
);

create index if not exists idx_audits_workspace on public.audits(workspace_id);
create index if not exists idx_audits_company on public.audits(company_id);
create index if not exists idx_audits_status on public.audits(status);

alter table public.audits enable row level security;
create policy "auth_read_audits"  on public.audits for select to authenticated using (true);
create policy "auth_write_audits" on public.audits for all to authenticated using (true) with check (true);
