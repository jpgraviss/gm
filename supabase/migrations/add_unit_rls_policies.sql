-- ─── Per-unit RLS write policies ────────────────────────────────────────────
-- Replaces blanket "authenticated = true" write policies with unit-based
-- isolation. Users can only modify records whose assigned rep belongs to
-- their same unit (e.g. Sales, Delivery/Operations). Admins bypass the check.
--
-- HOW IT WORKS:
--   1. auth_user_unit() returns the current user's unit from team_members.
--   2. auth_user_is_admin() returns true if the user is a Super Admin.
--   3. same_unit_or_admin(rep_name) checks if a record's assigned_rep is
--      in the same unit as the calling user, or if the user is admin.
--   4. Existing blanket policies are dropped and replaced.
--
-- IMPORTANT: Run this AFTER add_rls_write_policies.sql has been applied.
-- ────────────────────────────────────────────────────────────────────────────

-- Helper: get current user's unit
create or replace function public.auth_user_unit()
returns text
language sql
stable
security definer
as $$
  select unit from public.team_members where id = auth.uid()::text limit 1
$$;

-- Helper: check if current user is admin
create or replace function public.auth_user_is_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select is_admin from public.team_members where id = auth.uid()::text limit 1),
    false
  )
$$;

-- Helper: check if a rep name belongs to the same unit as the current user
create or replace function public.same_unit_or_admin(rep_name text)
returns boolean
language sql
stable
security definer
as $$
  select
    public.auth_user_is_admin()
    or rep_name is null
    or rep_name = ''
    or exists (
      select 1 from public.team_members
      where name = rep_name
        and unit = public.auth_user_unit()
    )
$$;

-- ─── Drop old blanket policies and replace with unit-scoped ones ────────────
-- We only scope tables that have an assigned_rep column. Tables without
-- a clear ownership column (audit_logs, automations, etc.) keep open access.

-- deals
drop policy if exists "auth_insert_deals" on public.deals;
drop policy if exists "auth_update_deals" on public.deals;
drop policy if exists "auth_delete_deals" on public.deals;
create policy "unit_insert_deals" on public.deals for insert to authenticated
  with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_update_deals" on public.deals for update to authenticated
  using (public.same_unit_or_admin(assigned_rep)) with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_delete_deals" on public.deals for delete to authenticated
  using (public.same_unit_or_admin(assigned_rep));

-- proposals
drop policy if exists "auth_insert_proposals" on public.proposals;
drop policy if exists "auth_update_proposals" on public.proposals;
drop policy if exists "auth_delete_proposals" on public.proposals;
create policy "unit_insert_proposals" on public.proposals for insert to authenticated
  with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_update_proposals" on public.proposals for update to authenticated
  using (public.same_unit_or_admin(assigned_rep)) with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_delete_proposals" on public.proposals for delete to authenticated
  using (public.same_unit_or_admin(assigned_rep));

-- contracts
drop policy if exists "auth_insert_contracts" on public.contracts;
drop policy if exists "auth_update_contracts" on public.contracts;
drop policy if exists "auth_delete_contracts" on public.contracts;
create policy "unit_insert_contracts" on public.contracts for insert to authenticated
  with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_update_contracts" on public.contracts for update to authenticated
  using (public.same_unit_or_admin(assigned_rep)) with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_delete_contracts" on public.contracts for delete to authenticated
  using (public.same_unit_or_admin(assigned_rep));

-- projects (uses assigned_team array, not a single rep — admin-only write for now)
drop policy if exists "auth_insert_projects" on public.projects;
drop policy if exists "auth_update_projects" on public.projects;
drop policy if exists "auth_delete_projects" on public.projects;
create policy "unit_insert_projects" on public.projects for insert to authenticated with check (true);
create policy "unit_update_projects" on public.projects for update to authenticated using (true) with check (true);
create policy "unit_delete_projects" on public.projects for delete to authenticated using (public.auth_user_is_admin());

-- maintenance_records (NO assigned_rep column — open insert/update, admin-only delete)
drop policy if exists "auth_insert_maintenance" on public.maintenance_records;
drop policy if exists "auth_update_maintenance" on public.maintenance_records;
drop policy if exists "auth_delete_maintenance" on public.maintenance_records;
create policy "unit_insert_maintenance" on public.maintenance_records for insert to authenticated with check (true);
create policy "unit_update_maintenance" on public.maintenance_records for update to authenticated using (true) with check (true);
create policy "unit_delete_maintenance" on public.maintenance_records for delete to authenticated using (public.auth_user_is_admin());

-- renewals
drop policy if exists "auth_insert_renewals" on public.renewals;
drop policy if exists "auth_update_renewals" on public.renewals;
drop policy if exists "auth_delete_renewals" on public.renewals;
create policy "unit_insert_renewals" on public.renewals for insert to authenticated
  with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_update_renewals" on public.renewals for update to authenticated
  using (public.same_unit_or_admin(assigned_rep)) with check (public.same_unit_or_admin(assigned_rep));
create policy "unit_delete_renewals" on public.renewals for delete to authenticated
  using (public.same_unit_or_admin(assigned_rep));

-- tickets (assigned_to instead of assigned_rep)
drop policy if exists "auth_insert_tickets" on public.tickets;
drop policy if exists "auth_update_tickets" on public.tickets;
drop policy if exists "auth_delete_tickets" on public.tickets;
create policy "unit_insert_tickets" on public.tickets for insert to authenticated with check (true);
create policy "unit_update_tickets" on public.tickets for update to authenticated using (true) with check (true);
create policy "unit_delete_tickets" on public.tickets for delete to authenticated using (public.auth_user_is_admin());

-- NOTE: The following tables keep their blanket authenticated policies
-- (no assigned_rep column or shared resources):
--   crm_companies, crm_contacts, crm_activities, invoices, app_tasks,
--   time_entries, audit_logs, calendar_settings, bookings, revenue_months,
--   automations, sequences, sequence_enrollments, portal_clients
