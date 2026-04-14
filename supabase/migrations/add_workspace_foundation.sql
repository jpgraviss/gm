-- ─── Workspace foundation (single-tenant now, multi-tenant ready) ───────────
-- Creates the workspace primitive so future SaaS conversion requires only
-- swapping the hardcoded DEFAULT_WORKSPACE_ID helper for one that reads from
-- the JWT/session. Every business table gains a workspace_id column with a
-- default pointing to the Graviss Marketing workspace.

-- 1. Workspaces table
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  tier       text not null default 'agency_plus',
  logo_url   text,
  primary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Workspace members (who belongs to which workspace, with role)
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      text not null,
  role         text not null default 'member',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);

-- 3. Seed the Graviss Marketing default workspace
insert into public.workspaces (id, name, slug, tier)
values ('00000000-0000-0000-0000-000000000001', 'Graviss Marketing', 'graviss', 'agency_plus')
on conflict (id) do nothing;

-- 4. Back-fill all existing team_members as members of the default workspace
insert into public.workspace_members (workspace_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', id, case when is_admin then 'admin' else 'member' end
from public.team_members
on conflict (workspace_id, user_id) do nothing;

-- 5. Add workspace_id column to every business table
--    All columns default to the Graviss workspace for zero-migration data flow.

do $$
declare
  tbl text;
  tables text[] := array[
    'crm_companies', 'crm_contacts', 'crm_activities',
    'deals', 'proposals', 'contracts', 'contract_addendums',
    'invoices', 'projects', 'app_tasks', 'time_entries',
    'tickets', 'maintenance_records', 'renewals',
    'automations', 'sequences', 'sequence_enrollments',
    'calendar_settings', 'bookings',
    'document_templates', 'portal_clients',
    'audit_logs'
  ];
begin
  foreach tbl in array tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      execute format(
        'alter table public.%I add column if not exists workspace_id uuid not null default ''00000000-0000-0000-0000-000000000001''',
        tbl
      );
      execute format(
        'create index if not exists idx_%I_workspace on public.%I(workspace_id)',
        tbl, tbl
      );
    end if;
  end loop;
end $$;

-- 6. Optional tables (may not exist depending on migration history)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sequence_activities') then
    alter table public.sequence_activities add column if not exists workspace_id uuid not null default '00000000-0000-0000-0000-000000000001';
    create index if not exists idx_sequence_activities_workspace on public.sequence_activities(workspace_id);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sequence_suppression_list') then
    alter table public.sequence_suppression_list add column if not exists workspace_id uuid not null default '00000000-0000-0000-0000-000000000001';
    create index if not exists idx_sequence_suppression_workspace on public.sequence_suppression_list(workspace_id);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'processed_emails') then
    alter table public.processed_emails add column if not exists workspace_id uuid not null default '00000000-0000-0000-0000-000000000001';
    create index if not exists idx_processed_emails_workspace on public.processed_emails(workspace_id);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'signature_requests') then
    alter table public.signature_requests add column if not exists workspace_id uuid not null default '00000000-0000-0000-0000-000000000001';
    create index if not exists idx_signature_requests_workspace on public.signature_requests(workspace_id);
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portal_notifications') then
    alter table public.portal_notifications add column if not exists workspace_id uuid not null default '00000000-0000-0000-0000-000000000001';
    create index if not exists idx_portal_notifications_workspace on public.portal_notifications(workspace_id);
  end if;
end $$;
