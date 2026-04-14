-- ─── Client integration bindings ───────────────────────────────────────────
-- Map a CRM company (client) to specific integration property IDs so the
-- client portal can show their own Search Console, Analytics, Ads, Business
-- Profile, and Meta Ads data. Admins assign these bindings on the company
-- detail page. Portal clients only see data bound to their company.

create table if not exists public.client_integrations (
  id               text primary key,
  workspace_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  company_id       text,
  company_name     text not null,
  gsc_site_url     text,
  ga4_property_id  text,
  ga4_property_label text,
  ads_customer_id  text,
  ads_customer_label text,
  meta_ad_account_id text,
  meta_ad_account_label text,
  gbp_location_name text,
  gbp_location_label text,
  portal_enabled   boolean not null default false,
  portal_widgets   text[] not null default array['seo','traffic','ads','reputation','uptime','rankings'],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (workspace_id, company_name)
);

create index if not exists idx_client_integrations_workspace on public.client_integrations(workspace_id);
create index if not exists idx_client_integrations_company on public.client_integrations(company_name);

alter table public.client_integrations enable row level security;
create policy "auth_read_client_integrations"  on public.client_integrations for select to authenticated using (true);
create policy "auth_write_client_integrations" on public.client_integrations for all to authenticated using (true) with check (true);
-- Portal clients read their own binding (scoped by company in the API layer)
create policy "anon_read_client_integrations" on public.client_integrations for select to anon using (true);
