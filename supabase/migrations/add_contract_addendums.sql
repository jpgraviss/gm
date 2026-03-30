-- ─── Contract Addendums ──────────────────────────────────────────────────────
create table if not exists public.contract_addendums (
  id          text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  status      text not null default 'Draft',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

alter table public.contract_addendums enable row level security;
create policy "auth_read_contract_addendums"  on public.contract_addendums for select to authenticated using (true);
create policy "auth_write_contract_addendums" on public.contract_addendums for all    to authenticated using (true) with check (true);
create policy "service_all_contract_addendums" on public.contract_addendums for all to service_role using (true) with check (true);
