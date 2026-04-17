-- ─── Sales enablement: playbooks + template library ────────────────────────
create table if not exists public.playbooks (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  title           text not null,
  category        text not null default 'General',
  content         text not null default '',
  tags            text[] not null default '{}',
  status          text not null default 'Active',
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_playbooks_workspace on public.playbooks(workspace_id);
create index if not exists idx_playbooks_category on public.playbooks(category);
alter table public.playbooks enable row level security;
drop policy if exists "auth_read_playbooks" on public.playbooks;
drop policy if exists "auth_write_playbooks" on public.playbooks;
create policy "auth_read_playbooks"  on public.playbooks for select to authenticated using (true);
create policy "auth_write_playbooks" on public.playbooks for all to authenticated using (true) with check (true);

-- ─── Sales template library (email templates, pitch decks, proposals) ──────
create table if not exists public.sales_templates (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  title           text not null,
  category        text not null default 'Email',
  content         text not null default '',
  subject         text,
  tags            text[] not null default '{}',
  usage_count     integer not null default 0,
  status          text not null default 'Active',
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_sales_templates_workspace on public.sales_templates(workspace_id);
create index if not exists idx_sales_templates_category on public.sales_templates(category);
alter table public.sales_templates enable row level security;
drop policy if exists "auth_read_sales_templates" on public.sales_templates;
drop policy if exists "auth_write_sales_templates" on public.sales_templates;
create policy "auth_read_sales_templates"  on public.sales_templates for select to authenticated using (true);
create policy "auth_write_sales_templates" on public.sales_templates for all to authenticated using (true) with check (true);

-- ─── LMS: courses + modules + enrollments ──────────────────────────────────
create table if not exists public.courses (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  title           text not null,
  description     text,
  thumbnail_url   text,
  modules         jsonb not null default '[]',
  status          text not null default 'Draft',
  price           numeric(10,2),
  access_type     text not null default 'free',
  tags            text[] not null default '{}',
  enrolled_count  integer not null default 0,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_courses_workspace on public.courses(workspace_id);
create index if not exists idx_courses_status on public.courses(status);
alter table public.courses enable row level security;
drop policy if exists "auth_read_courses" on public.courses;
drop policy if exists "auth_write_courses" on public.courses;
drop policy if exists "anon_read_courses" on public.courses;
create policy "auth_read_courses"  on public.courses for select to authenticated using (true);
create policy "auth_write_courses" on public.courses for all to authenticated using (true) with check (true);
create policy "anon_read_courses"  on public.courses for select to anon using (true);

create table if not exists public.course_enrollments (
  id              text primary key,
  workspace_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  course_id       text not null references public.courses(id) on delete cascade,
  student_name    text not null,
  student_email   text not null,
  progress        jsonb not null default '{}',
  completed_at    timestamptz,
  certificate_id  text,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_course_enrollments_course on public.course_enrollments(course_id);
create index if not exists idx_course_enrollments_email on public.course_enrollments(student_email);
alter table public.course_enrollments enable row level security;
drop policy if exists "auth_read_course_enrollments" on public.course_enrollments;
drop policy if exists "auth_write_course_enrollments" on public.course_enrollments;
create policy "auth_read_course_enrollments"  on public.course_enrollments for select to authenticated using (true);
create policy "auth_write_course_enrollments" on public.course_enrollments for all to authenticated using (true) with check (true);
