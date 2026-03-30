-- ─── RLS Write Policies ──────────────────────────────────────────────────────
-- Adds INSERT / UPDATE / DELETE policies for authenticated users.
-- The service-role key already bypasses RLS, but these provide defense-in-depth
-- so that the anon key can never mutate data.
-- Run this in Supabase SQL Editor after enabling RLS on all tables.

-- Helper: create all three write policies for a table
-- (Supabase doesn't support DO blocks with policy DDL easily, so we enumerate.)

-- ─── team_members ────────────────────────────────────────────────────────────
-- Self-insert already exists. Add update (self only) and admin-level policies.
create policy "auth_update_own_team_member" on public.team_members
  for update to authenticated using (id = auth.uid()::text) with check (id = auth.uid()::text);

-- ─── crm_companies ──────────────────────────────────────────────────────────
create policy "auth_insert_crm_companies" on public.crm_companies for insert to authenticated with check (true);
create policy "auth_update_crm_companies" on public.crm_companies for update to authenticated using (true) with check (true);
create policy "auth_delete_crm_companies" on public.crm_companies for delete to authenticated using (true);

-- ─── crm_contacts ───────────────────────────────────────────────────────────
create policy "auth_insert_crm_contacts" on public.crm_contacts for insert to authenticated with check (true);
create policy "auth_update_crm_contacts" on public.crm_contacts for update to authenticated using (true) with check (true);
create policy "auth_delete_crm_contacts" on public.crm_contacts for delete to authenticated using (true);

-- ─── crm_activities ─────────────────────────────────────────────────────────
create policy "auth_insert_crm_activities" on public.crm_activities for insert to authenticated with check (true);
create policy "auth_update_crm_activities" on public.crm_activities for update to authenticated using (true) with check (true);
create policy "auth_delete_crm_activities" on public.crm_activities for delete to authenticated using (true);

-- ─── deals ──────────────────────────────────────────────────────────────────
create policy "auth_insert_deals" on public.deals for insert to authenticated with check (true);
create policy "auth_update_deals" on public.deals for update to authenticated using (true) with check (true);
create policy "auth_delete_deals" on public.deals for delete to authenticated using (true);

-- ─── proposals ──────────────────────────────────────────────────────────────
create policy "auth_insert_proposals" on public.proposals for insert to authenticated with check (true);
create policy "auth_update_proposals" on public.proposals for update to authenticated using (true) with check (true);
create policy "auth_delete_proposals" on public.proposals for delete to authenticated using (true);

-- ─── contracts ──────────────────────────────────────────────────────────────
create policy "auth_insert_contracts" on public.contracts for insert to authenticated with check (true);
create policy "auth_update_contracts" on public.contracts for update to authenticated using (true) with check (true);
create policy "auth_delete_contracts" on public.contracts for delete to authenticated using (true);

-- ─── invoices ───────────────────────────────────────────────────────────────
create policy "auth_insert_invoices" on public.invoices for insert to authenticated with check (true);
create policy "auth_update_invoices" on public.invoices for update to authenticated using (true) with check (true);
create policy "auth_delete_invoices" on public.invoices for delete to authenticated using (true);

-- ─── projects ───────────────────────────────────────────────────────────────
create policy "auth_insert_projects" on public.projects for insert to authenticated with check (true);
create policy "auth_update_projects" on public.projects for update to authenticated using (true) with check (true);
create policy "auth_delete_projects" on public.projects for delete to authenticated using (true);

-- ─── maintenance_records ────────────────────────────────────────────────────
create policy "auth_insert_maintenance" on public.maintenance_records for insert to authenticated with check (true);
create policy "auth_update_maintenance" on public.maintenance_records for update to authenticated using (true) with check (true);
create policy "auth_delete_maintenance" on public.maintenance_records for delete to authenticated using (true);

-- ─── renewals ───────────────────────────────────────────────────────────────
create policy "auth_insert_renewals" on public.renewals for insert to authenticated with check (true);
create policy "auth_update_renewals" on public.renewals for update to authenticated using (true) with check (true);
create policy "auth_delete_renewals" on public.renewals for delete to authenticated using (true);

-- ─── app_tasks ──────────────────────────────────────────────────────────────
create policy "auth_insert_app_tasks" on public.app_tasks for insert to authenticated with check (true);
create policy "auth_update_app_tasks" on public.app_tasks for update to authenticated using (true) with check (true);
create policy "auth_delete_app_tasks" on public.app_tasks for delete to authenticated using (true);

-- ─── time_entries ───────────────────────────────────────────────────────────
create policy "auth_insert_time_entries" on public.time_entries for insert to authenticated with check (true);
create policy "auth_update_time_entries" on public.time_entries for update to authenticated using (true) with check (true);
create policy "auth_delete_time_entries" on public.time_entries for delete to authenticated using (true);

-- ─── tickets ────────────────────────────────────────────────────────────────
create policy "auth_insert_tickets" on public.tickets for insert to authenticated with check (true);
create policy "auth_update_tickets" on public.tickets for update to authenticated using (true) with check (true);
create policy "auth_delete_tickets" on public.tickets for delete to authenticated using (true);

-- ─── audit_logs ─────────────────────────────────────────────────────────────
create policy "auth_insert_audit_logs" on public.audit_logs for insert to authenticated with check (true);
-- No update/delete on audit logs — they are immutable

-- ─── calendar_settings ──────────────────────────────────────────────────────
create policy "auth_insert_calendar_settings" on public.calendar_settings for insert to authenticated with check (true);
create policy "auth_update_calendar_settings" on public.calendar_settings for update to authenticated using (true) with check (true);

-- ─── bookings ───────────────────────────────────────────────────────────────
-- Anon insert already exists for public booking. Add authenticated write.
create policy "auth_insert_bookings" on public.bookings for insert to authenticated with check (true);
create policy "auth_update_bookings" on public.bookings for update to authenticated using (true) with check (true);

-- ─── revenue_months ─────────────────────────────────────────────────────────
create policy "auth_insert_revenue_months" on public.revenue_months for insert to authenticated with check (true);
create policy "auth_update_revenue_months" on public.revenue_months for update to authenticated using (true) with check (true);

-- ─── automations ────────────────────────────────────────────────────────────
create policy "auth_insert_automations" on public.automations for insert to authenticated with check (true);
create policy "auth_update_automations" on public.automations for update to authenticated using (true) with check (true);
create policy "auth_delete_automations" on public.automations for delete to authenticated using (true);

-- ─── sequences ──────────────────────────────────────────────────────────────
create policy "auth_insert_sequences" on public.sequences for insert to authenticated with check (true);
create policy "auth_update_sequences" on public.sequences for update to authenticated using (true) with check (true);
create policy "auth_delete_sequences" on public.sequences for delete to authenticated using (true);

-- ─── sequence_enrollments ───────────────────────────────────────────────────
create policy "auth_insert_enrollments" on public.sequence_enrollments for insert to authenticated with check (true);
create policy "auth_update_enrollments" on public.sequence_enrollments for update to authenticated using (true) with check (true);
create policy "auth_delete_enrollments" on public.sequence_enrollments for delete to authenticated using (true);

-- ─── portal_clients ─────────────────────────────────────────────────────────
create policy "auth_insert_portal_clients" on public.portal_clients for insert to authenticated with check (true);
create policy "auth_update_portal_clients" on public.portal_clients for update to authenticated using (true) with check (true);
create policy "auth_delete_portal_clients" on public.portal_clients for delete to authenticated using (true);
