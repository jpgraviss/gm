alter table public.portal_clients
  add column if not exists portal_config jsonb default '{}'::jsonb,
  add column if not exists services text[] default '{}',
  add column if not exists company_id text;

create index if not exists idx_portal_clients_company_id on public.portal_clients (company_id);
