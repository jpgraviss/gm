-- AUDIT.md #47 — systemic tightening of the "any authenticated user can
-- read/write every row" pattern (`to authenticated using (true)`), applied
-- as a proof of concept to training_progress/rotation_state/
-- granola_meeting_notes earlier this session. This migration extends the
-- same fix across every other table found with the same pattern.
--
-- Confirmed safe: the app's own server-side code exclusively uses
-- createServiceClient() (the service-role key, bypasses RLS) — spot-checked
-- across dozens of routes. This is pure defense-in-depth against a
-- DIFFERENT attack: a staff member's browser holds a real Supabase Auth
-- session (used during login), which could otherwise call Supabase's REST
-- API directly and read/write ANY row in ANY of these tables, bypassing
-- this app's own API-layer authorization entirely (role checks, unit
-- scoping, etc.).
--
-- IMPORTANT — this migration went through a full reconciliation pass
-- against the actual chronological policy history (not just schema.sql,
-- which is a hand-maintained "fresh install" reference that has drifted
-- from live state — e.g. it never picked up add_rls_write_policies.sql or
-- add_unit_rls_policies.sql for `deals`). Two real bug classes were found
-- and are specifically avoided below:
--   1. `deals`/`proposals`/`contracts`/`renewals`/`projects`/
--      `maintenance_records`/`tickets` had their original blanket
--      insert/update/delete policies already replaced by
--      add_unit_rls_policies.sql under `unit_*` names — a naive "drop the
--      original auth_* name, add one staff-only `for all` policy" would
--      have (a) no-op'd on names that no longer exist, leaving the real
--      `unit_*` policies live and OR'd against the new one, and (b) for
--      deals/proposals/contracts/renewals specifically, completely erased
--      the real unit-scoping those policies enforce (`is_staff()` is a
--      strict superset of `same_unit_or_admin(...)`, so OR-ing them
--      together widens access to "any staff, any unit"). For
--      projects/maintenance_records/tickets, a blanket `for all` would
--      have similarly widened DELETE from admin-only to any-staff.
--   2. ~16 tables (crm_companies, crm_contacts, crm_activities, invoices,
--      portal_clients, app_tasks, time_entries, calendar_settings,
--      bookings, revenue_months, automations, sequences,
--      sequence_enrollments, audit_logs, processed_emails,
--      bcc_processed_emails) have a genuinely separate `auth_insert_*` /
--      `authenticated_insert` policy (from add_rls_write_policies.sql)
--      distinct from their `auth_read_*` policy — an earlier draft of this
--      migration only dropped the read/update/delete names and never
--      touched insert, which would have left INSERT wide open to any
--      authenticated session. Also, some of these tables
--      (calendar_settings, bookings, revenue_months, audit_logs,
--      processed_emails, bcc_processed_emails) never had an update and/or
--      delete policy at all — using a blanket `for all` replacement for
--      those would have newly GRANTED a command that's currently
--      default-denied (no policy = no access for that command), which is
--      a widening, not a tightening. Each such table below gets exactly
--      the set of per-command policies that existed live, no more.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm where tm.id = auth.uid()::text
  );
$$;

-- Re-hardens the pre-existing unit-scoping helpers (add_unit_rls_policies.sql)
-- with `set search_path = public` — they already fully qualify every
-- reference with `public.`, so this changes no behavior, just closes a
-- search-path-injection hardening gap consistent with is_staff() above.
create or replace function public.auth_user_unit()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select unit from public.team_members where id = auth.uid()::text limit 1
$$;

create or replace function public.auth_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.team_members where id = auth.uid()::text limit 1),
    false
  )
$$;

create or replace function public.same_unit_or_admin(rep_name text)
returns boolean
language sql
stable
security definer
set search_path = public
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

-- ── team_members ─────────────────────────────────────────────────────────
-- Self-insert/self-update-own-row policies are untouched (already narrow).
-- Only the blanket SELECT gets staff-gated.
drop policy if exists "auth_read_team_members" on public.team_members;
create policy "staff_read_team_members" on public.team_members for select to authenticated using (public.is_staff());

-- ── Unit-scoped tables (deals/proposals/contracts/renewals) ─────────────
-- SELECT never had unit-scoping (auth_read_X used (true)) — tighten to
-- staff-only, matching the rest of this migration. INSERT/UPDATE/DELETE
-- already carry real unit-scoping via `unit_*` policies — preserve that
-- exactly, adding the staff gate as an additional AND condition (also
-- closes a real pre-existing gap: same_unit_or_admin() returns true for a
-- null/empty assigned_rep regardless of whether the caller is even staff).
drop policy if exists "auth_read_deals" on public.deals;
drop policy if exists "unit_insert_deals" on public.deals;
drop policy if exists "unit_update_deals" on public.deals;
drop policy if exists "unit_delete_deals" on public.deals;
create policy "staff_select_deals" on public.deals for select to authenticated using (public.is_staff());
create policy "staff_unit_insert_deals" on public.deals for insert to authenticated with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_update_deals" on public.deals for update to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep)) with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_delete_deals" on public.deals for delete to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep));

drop policy if exists "auth_read_proposals" on public.proposals;
drop policy if exists "unit_insert_proposals" on public.proposals;
drop policy if exists "unit_update_proposals" on public.proposals;
drop policy if exists "unit_delete_proposals" on public.proposals;
create policy "staff_select_proposals" on public.proposals for select to authenticated using (public.is_staff());
create policy "staff_unit_insert_proposals" on public.proposals for insert to authenticated with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_update_proposals" on public.proposals for update to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep)) with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_delete_proposals" on public.proposals for delete to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep));

drop policy if exists "auth_read_contracts" on public.contracts;
drop policy if exists "unit_insert_contracts" on public.contracts;
drop policy if exists "unit_update_contracts" on public.contracts;
drop policy if exists "unit_delete_contracts" on public.contracts;
create policy "staff_select_contracts" on public.contracts for select to authenticated using (public.is_staff());
create policy "staff_unit_insert_contracts" on public.contracts for insert to authenticated with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_update_contracts" on public.contracts for update to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep)) with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_delete_contracts" on public.contracts for delete to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep));

drop policy if exists "auth_read_renewals" on public.renewals;
drop policy if exists "unit_insert_renewals" on public.renewals;
drop policy if exists "unit_update_renewals" on public.renewals;
drop policy if exists "unit_delete_renewals" on public.renewals;
create policy "staff_select_renewals" on public.renewals for select to authenticated using (public.is_staff());
create policy "staff_unit_insert_renewals" on public.renewals for insert to authenticated with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_update_renewals" on public.renewals for update to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep)) with check (public.is_staff() and public.same_unit_or_admin(assigned_rep));
create policy "staff_unit_delete_renewals" on public.renewals for delete to authenticated using (public.is_staff() and public.same_unit_or_admin(assigned_rep));

-- ── projects / maintenance_records / tickets ─────────────────────────────
-- SELECT/INSERT/UPDATE were blanket `using/check (true)` (no real unit
-- scoping despite the `unit_*` name) — tighten all three to staff-only.
-- DELETE was genuinely admin-only (auth_user_is_admin()) — preserved
-- exactly, NOT folded into a `for all` policy (which would widen delete
-- to any staff member via the OR of two permissive policies).
drop policy if exists "auth_read_projects" on public.projects;
drop policy if exists "unit_insert_projects" on public.projects;
drop policy if exists "unit_update_projects" on public.projects;
drop policy if exists "unit_delete_projects" on public.projects;
create policy "staff_select_projects" on public.projects for select to authenticated using (public.is_staff());
create policy "staff_insert_projects" on public.projects for insert to authenticated with check (public.is_staff());
create policy "staff_update_projects" on public.projects for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin_delete_projects" on public.projects for delete to authenticated using (public.auth_user_is_admin());

drop policy if exists "auth_read_maintenance" on public.maintenance_records;
drop policy if exists "unit_insert_maintenance" on public.maintenance_records;
drop policy if exists "unit_update_maintenance" on public.maintenance_records;
drop policy if exists "unit_delete_maintenance" on public.maintenance_records;
create policy "staff_select_maintenance" on public.maintenance_records for select to authenticated using (public.is_staff());
create policy "staff_insert_maintenance" on public.maintenance_records for insert to authenticated with check (public.is_staff());
create policy "staff_update_maintenance" on public.maintenance_records for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin_delete_maintenance" on public.maintenance_records for delete to authenticated using (public.auth_user_is_admin());

drop policy if exists "auth_read_tickets" on public.tickets;
drop policy if exists "unit_insert_tickets" on public.tickets;
drop policy if exists "unit_update_tickets" on public.tickets;
drop policy if exists "unit_delete_tickets" on public.tickets;
create policy "staff_select_tickets" on public.tickets for select to authenticated using (public.is_staff());
create policy "staff_insert_tickets" on public.tickets for insert to authenticated with check (public.is_staff());
create policy "staff_update_tickets" on public.tickets for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin_delete_tickets" on public.tickets for delete to authenticated using (public.auth_user_is_admin());

-- ── crm_companies / crm_contacts / crm_activities / invoices /
--    portal_clients / app_tasks / time_entries / automations / sequences /
--    sequence_enrollments ────────────────────────────────────────────────
-- Each has real, live select/insert/update/delete policies (all `(true)`)
-- — safe to fold into one `for all` staff-only policy.
drop policy if exists "auth_read_crm_companies" on public.crm_companies;
drop policy if exists "auth_insert_crm_companies" on public.crm_companies;
drop policy if exists "auth_update_crm_companies" on public.crm_companies;
drop policy if exists "auth_delete_crm_companies" on public.crm_companies;
create policy "staff_all_crm_companies" on public.crm_companies for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_crm_contacts" on public.crm_contacts;
drop policy if exists "auth_insert_crm_contacts" on public.crm_contacts;
drop policy if exists "auth_update_crm_contacts" on public.crm_contacts;
drop policy if exists "auth_delete_crm_contacts" on public.crm_contacts;
create policy "staff_all_crm_contacts" on public.crm_contacts for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_crm_activities" on public.crm_activities;
drop policy if exists "auth_insert_crm_activities" on public.crm_activities;
drop policy if exists "auth_update_crm_activities" on public.crm_activities;
drop policy if exists "auth_delete_crm_activities" on public.crm_activities;
create policy "staff_all_crm_activities" on public.crm_activities for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_invoices" on public.invoices;
drop policy if exists "auth_insert_invoices" on public.invoices;
drop policy if exists "auth_update_invoices" on public.invoices;
drop policy if exists "auth_delete_invoices" on public.invoices;
create policy "staff_all_invoices" on public.invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_portal_clients" on public.portal_clients;
drop policy if exists "auth_insert_portal_clients" on public.portal_clients;
drop policy if exists "auth_update_portal_clients" on public.portal_clients;
drop policy if exists "auth_delete_portal_clients" on public.portal_clients;
create policy "staff_all_portal_clients" on public.portal_clients for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_app_tasks" on public.app_tasks;
drop policy if exists "auth_insert_app_tasks" on public.app_tasks;
drop policy if exists "auth_update_app_tasks" on public.app_tasks;
drop policy if exists "auth_delete_app_tasks" on public.app_tasks;
create policy "staff_all_app_tasks" on public.app_tasks for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_time_entries" on public.time_entries;
drop policy if exists "auth_insert_time_entries" on public.time_entries;
drop policy if exists "auth_update_time_entries" on public.time_entries;
drop policy if exists "auth_delete_time_entries" on public.time_entries;
create policy "staff_all_time_entries" on public.time_entries for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_automations" on public.automations;
drop policy if exists "auth_insert_automations" on public.automations;
drop policy if exists "auth_update_automations" on public.automations;
drop policy if exists "auth_delete_automations" on public.automations;
create policy "staff_all_automations" on public.automations for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_sequences" on public.sequences;
drop policy if exists "auth_insert_sequences" on public.sequences;
drop policy if exists "auth_update_sequences" on public.sequences;
drop policy if exists "auth_delete_sequences" on public.sequences;
create policy "staff_all_sequences" on public.sequences for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_enrollments" on public.sequence_enrollments;
drop policy if exists "auth_insert_enrollments" on public.sequence_enrollments;
drop policy if exists "auth_update_enrollments" on public.sequence_enrollments;
drop policy if exists "auth_delete_enrollments" on public.sequence_enrollments;
create policy "staff_all_sequence_enrollments" on public.sequence_enrollments for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── calendar_settings / bookings / revenue_months ────────────────────────
-- Only select+insert+update ever existed live — no delete policy at all
-- (default-deny). A `for all` replacement would newly grant delete.
drop policy if exists "auth_read_calendar_settings" on public.calendar_settings;
drop policy if exists "auth_insert_calendar_settings" on public.calendar_settings;
drop policy if exists "auth_update_calendar_settings" on public.calendar_settings;
create policy "staff_select_calendar_settings" on public.calendar_settings for select to authenticated using (public.is_staff());
create policy "staff_insert_calendar_settings" on public.calendar_settings for insert to authenticated with check (public.is_staff());
create policy "staff_update_calendar_settings" on public.calendar_settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_bookings" on public.bookings;
drop policy if exists "auth_insert_bookings" on public.bookings;
drop policy if exists "auth_update_bookings" on public.bookings;
create policy "staff_select_bookings" on public.bookings for select to authenticated using (public.is_staff());
create policy "staff_insert_bookings" on public.bookings for insert to authenticated with check (public.is_staff());
create policy "staff_update_bookings" on public.bookings for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_revenue_months" on public.revenue_months;
drop policy if exists "auth_insert_revenue_months" on public.revenue_months;
drop policy if exists "auth_update_revenue_months" on public.revenue_months;
create policy "staff_select_revenue_months" on public.revenue_months for select to authenticated using (public.is_staff());
create policy "staff_insert_revenue_months" on public.revenue_months for insert to authenticated with check (public.is_staff());
create policy "staff_update_revenue_months" on public.revenue_months for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── audit_logs / processed_emails / bcc_processed_emails ─────────────────
-- Select+insert only, no update/delete ever existed. All writes in
-- practice come from service-role cron/webhook code, not a client session.
drop policy if exists "auth_read_audit_logs" on public.audit_logs;
drop policy if exists "auth_insert_audit_logs" on public.audit_logs;
create policy "staff_select_audit_logs" on public.audit_logs for select to authenticated using (public.is_staff());
create policy "staff_insert_audit_logs" on public.audit_logs for insert to authenticated with check (public.is_staff());

drop policy if exists "authenticated_read" on public.processed_emails;
drop policy if exists "authenticated_insert" on public.processed_emails;
create policy "staff_select_processed_emails" on public.processed_emails for select to authenticated using (public.is_staff());
create policy "staff_insert_processed_emails" on public.processed_emails for insert to authenticated with check (public.is_staff());

drop policy if exists "authenticated_read" on public.bcc_processed_emails;
drop policy if exists "authenticated_insert" on public.bcc_processed_emails;
create policy "staff_select_bcc_processed_emails" on public.bcc_processed_emails for select to authenticated using (public.is_staff());
create policy "staff_insert_bcc_processed_emails" on public.bcc_processed_emails for insert to authenticated with check (public.is_staff());

-- ── audits (single combined for-all policy, confirmed clean) ─────────────
drop policy if exists "auth_read_audits" on public.audits;
drop policy if exists "auth_write_audits" on public.audits;
create policy "staff_all_audits" on public.audits for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── automation_runs / automation_pending_steps / sequence_activities /
--    sequence_suppression_list (single combined for-all, confirmed clean) ─
drop policy if exists "authenticated_read_automation_runs" on public.automation_runs;
drop policy if exists "authenticated_manage_automation_runs" on public.automation_runs;
create policy "staff_all_automation_runs" on public.automation_runs for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated_read_pending" on public.automation_pending_steps;
drop policy if exists "authenticated_manage_pending" on public.automation_pending_steps;
create policy "staff_all_automation_pending_steps" on public.automation_pending_steps for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_seq_activities" on public.sequence_activities;
drop policy if exists "auth_write_seq_activities" on public.sequence_activities;
create policy "staff_all_sequence_activities" on public.sequence_activities for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_suppression" on public.sequence_suppression_list;
drop policy if exists "auth_write_suppression" on public.sequence_suppression_list;
create policy "staff_all_sequence_suppression_list" on public.sequence_suppression_list for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Settings / templates (single combined for-all, confirmed clean) ──────
-- app_settings is admin-only, not staff-only: it holds a plaintext Apollo
-- API key (app_settings.apollo.apiKey) and other config that
-- app/api/settings/route.ts already gates behind requireAdmin, not just
-- any staff login.
drop policy if exists "auth_read_app_settings" on public.app_settings;
drop policy if exists "auth_write_app_settings" on public.app_settings;
create policy "admin_all_app_settings" on public.app_settings for all to authenticated using (public.auth_user_is_admin()) with check (public.auth_user_is_admin());

drop policy if exists "auth_read_document_templates" on public.document_templates;
drop policy if exists "auth_write_document_templates" on public.document_templates;
create policy "staff_all_document_templates" on public.document_templates for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_ai_conversations" on public.ai_conversations;
drop policy if exists "auth_write_ai_conversations" on public.ai_conversations;
create policy "staff_all_ai_conversations" on public.ai_conversations for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── WordPress SEO (single combined for-all, confirmed clean) ─────────────
drop policy if exists "auth_read_wordpress_site_health" on public.wordpress_site_health;
drop policy if exists "auth_write_wordpress_site_health" on public.wordpress_site_health;
create policy "staff_all_wordpress_site_health" on public.wordpress_site_health for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_wordpress_seo_settings" on public.wordpress_seo_settings;
drop policy if exists "auth_write_wordpress_seo_settings" on public.wordpress_seo_settings;
create policy "staff_all_wordpress_seo_settings" on public.wordpress_seo_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_wordpress_seo_scores" on public.wordpress_seo_scores;
drop policy if exists "auth_write_wordpress_seo_scores" on public.wordpress_seo_scores;
create policy "staff_all_wordpress_seo_scores" on public.wordpress_seo_scores for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Broadcasts / forms / social (single combined for-all, confirmed clean) ─
drop policy if exists "auth_read_broadcast_link_clicks" on public.broadcast_link_clicks;
drop policy if exists "auth_write_broadcast_link_clicks" on public.broadcast_link_clicks;
create policy "staff_all_broadcast_link_clicks" on public.broadcast_link_clicks for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_broadcasts" on public.broadcasts;
create policy "staff_all_broadcasts" on public.broadcasts for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_broadcast_recipients" on public.broadcast_recipients;
create policy "staff_all_broadcast_recipients" on public.broadcast_recipients for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_forms" on public.forms;
create policy "staff_all_forms" on public.forms for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_form_submissions" on public.form_submissions;
create policy "staff_all_form_submissions" on public.form_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_social_connections" on public.social_connections;
create policy "staff_all_social_connections" on public.social_connections for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_social_posts" on public.social_posts;
create policy "staff_all_social_posts" on public.social_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_brand_kits" on public.brand_kits;
create policy "staff_all_brand_kits" on public.brand_kits for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Marketing / rank tracker / monitoring (single combined for-all,
--    confirmed clean) ────────────────────────────────────────────────────
drop policy if exists "auth_write_client_integrations" on public.client_integrations;
create policy "staff_all_client_integrations" on public.client_integrations for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_google_integrations" on public.google_integrations;
create policy "staff_all_google_integrations" on public.google_integrations for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_client_data" on public.client_data_snapshots;
create policy "staff_all_client_data_snapshots" on public.client_data_snapshots for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_monitored_sites" on public.monitored_sites;
create policy "staff_all_monitored_sites" on public.monitored_sites for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_uptime_checks" on public.uptime_checks;
create policy "staff_all_uptime_checks" on public.uptime_checks for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_tracked_keywords" on public.tracked_keywords;
create policy "staff_all_tracked_keywords" on public.tracked_keywords for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_rank_history" on public.keyword_rank_history;
create policy "staff_all_keyword_rank_history" on public.keyword_rank_history for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_rt_competitors" on public.rank_tracker_competitors;
create policy "staff_all_rank_tracker_competitors" on public.rank_tracker_competitors for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_competitor_snaps" on public.competitor_rank_snapshots;
create policy "staff_all_competitor_rank_snapshots" on public.competitor_rank_snapshots for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_rt_reports" on public.rank_tracker_reports;
create policy "staff_all_rank_tracker_reports" on public.rank_tracker_reports for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_read_meta" on public.meta_integration;
drop policy if exists "auth_write_meta" on public.meta_integration;
create policy "staff_all_meta_integration" on public.meta_integration for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Delivery / knowledge base / sales enablement (single combined for-all,
--    confirmed clean) ────────────────────────────────────────────────────
drop policy if exists "auth_all_delivery_workflows" on public.delivery_workflows;
create policy "staff_all_delivery_workflows" on public.delivery_workflows for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_delivery_templates" on public.delivery_templates;
create policy "staff_all_delivery_templates" on public.delivery_templates for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_delivery_events" on public.delivery_events;
create policy "staff_all_delivery_events" on public.delivery_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_knowledge_articles" on public.knowledge_articles;
create policy "staff_all_knowledge_articles" on public.knowledge_articles for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_playbooks" on public.playbooks;
create policy "staff_all_playbooks" on public.playbooks for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_sales_templates" on public.sales_templates;
create policy "staff_all_sales_templates" on public.sales_templates for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_courses" on public.courses;
create policy "staff_all_courses" on public.courses for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_course_enrollments" on public.course_enrollments;
create policy "staff_all_course_enrollments" on public.course_enrollments for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_write_contract_addendums" on public.contract_addendums;
create policy "staff_all_contract_addendums" on public.contract_addendums for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Reputation / notifications / misc (single combined for-all, confirmed
--    clean) ────────────────────────────────────────────────────────────
drop policy if exists "auth_all_reviews" on public.reviews;
create policy "staff_all_reviews" on public.reviews for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_review_campaigns" on public.review_campaigns;
create policy "staff_all_review_campaigns" on public.review_campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_review_requests" on public.review_requests;
create policy "staff_all_review_requests" on public.review_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated_read" on public.portal_notifications;
drop policy if exists "authenticated_manage" on public.portal_notifications;
create policy "staff_all_portal_notifications" on public.portal_notifications for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated_read" on public.signature_requests;
drop policy if exists "authenticated_insert" on public.signature_requests;
create policy "staff_all_signature_requests" on public.signature_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());
