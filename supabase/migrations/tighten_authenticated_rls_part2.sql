-- AUDIT.md #47 follow-up — an adversarial regression-review agent re-checked
-- tighten_authenticated_rls.sql (already shipped) against the FULL
-- chronological policy history and found it was still incomplete in two
-- distinct ways:
--
--   1. ~23 tables had TWO independent blanket policies from their original
--      migration — a `auth_read_X` (SELECT, using true) and a `auth_write_X`
--      (ALL, using true) — and tighten_authenticated_rls.sql only dropped
--      the write-side name before adding `staff_all_X`. The old
--      `auth_read_X` policy was left live and, since Postgres RLS
--      permissive policies are OR'd, it alone still granted SELECT to any
--      authenticated session, completely bypassing the new staff gate for
--      reads. Two of these are real credential leaks:
--      `google_integrations.access_token`/`refresh_token` (live Google
--      OAuth tokens for Search Console/Analytics/Ads/Business Profile) and
--      `social_connections.access_token` (live social-platform OAuth
--      tokens) were both still fully readable by any authenticated session.
--
--   2. 10 more tables (`calendar_subscriptions`, `chatbots`,
--      `chatbot_conversations`, `company_files`, `contact_timeline`,
--      `funnels`, `funnel_pages`, `gi_events`, `gi_visitors`,
--      `scheduled_emails`, `wordpress_checks`) carry the exact same
--      vulnerable pattern but were defined in a LATER migration
--      (`audit_fix_missing_tables_indexes_rls.sql`,
--      `add_wordpress_monitoring.sql`) using a different naming convention
--      (`auth_all_X` instead of `auth_read_X`/`auth_write_X`) that the
--      original reconciliation pass's grep never matched — these were never
--      touched at all.
--
-- This migration closes both gaps. Safe to run multiple times (all drops
-- are `if exists`).
--
-- Self-contained: redefines is_staff() (idempotent `create or replace`,
-- identical body to tighten_authenticated_rls.sql) so this script doesn't
-- depend on that one having already committed successfully. Supabase's SQL
-- editor runs a pasted script as a single transaction — if any statement in
-- tighten_authenticated_rls.sql errored, the whole script (including the
-- original is_staff() creation) rolls back with nothing applied, which is
-- exactly what produces "function public.is_staff() does not exist" if you
-- then run this file on its own.

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

-- ── Part 1: drop the stale auth_read_X policies whose write-side sibling
--    was already replaced by staff_all_X in tighten_authenticated_rls.sql —
--    staff_all_X's `for all` already covers SELECT once this is gone.
drop policy if exists "auth_read_brand_kits" on public.brand_kits;
drop policy if exists "auth_read_broadcasts" on public.broadcasts;
drop policy if exists "auth_read_broadcast_recipients" on public.broadcast_recipients;
drop policy if exists "auth_read_client_data" on public.client_data_snapshots;
drop policy if exists "auth_read_client_integrations" on public.client_integrations;
drop policy if exists "auth_read_competitor_snaps" on public.competitor_rank_snapshots;
drop policy if exists "auth_read_contract_addendums" on public.contract_addendums;
drop policy if exists "auth_read_courses" on public.courses;
drop policy if exists "auth_read_course_enrollments" on public.course_enrollments;
drop policy if exists "auth_read_forms" on public.forms;
drop policy if exists "auth_read_form_submissions" on public.form_submissions;
drop policy if exists "auth_read_google_integrations" on public.google_integrations;
drop policy if exists "auth_read_rank_history" on public.keyword_rank_history;
drop policy if exists "auth_read_knowledge_articles" on public.knowledge_articles;
drop policy if exists "auth_read_monitored_sites" on public.monitored_sites;
drop policy if exists "auth_read_playbooks" on public.playbooks;
drop policy if exists "auth_read_rt_competitors" on public.rank_tracker_competitors;
drop policy if exists "auth_read_rt_reports" on public.rank_tracker_reports;
drop policy if exists "auth_read_sales_templates" on public.sales_templates;
drop policy if exists "auth_read_social_connections" on public.social_connections;
drop policy if exists "auth_read_social_posts" on public.social_posts;
drop policy if exists "auth_read_tracked_keywords" on public.tracked_keywords;
drop policy if exists "auth_read_uptime_checks" on public.uptime_checks;

-- ── Part 2: tables using the auth_all_X naming convention, never touched —
--    each originally had exactly ONE blanket `for all using (true)` policy,
--    safe to replace 1:1 with a staff-only `for all` policy.
drop policy if exists "auth_all_calendar_subscriptions" on public.calendar_subscriptions;
create policy "staff_all_calendar_subscriptions" on public.calendar_subscriptions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_chatbots" on public.chatbots;
create policy "staff_all_chatbots" on public.chatbots for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_chatbot_conversations" on public.chatbot_conversations;
create policy "staff_all_chatbot_conversations" on public.chatbot_conversations for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_scheduled_emails" on public.scheduled_emails;
create policy "staff_all_scheduled_emails" on public.scheduled_emails for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_gi_visitors" on public.gi_visitors;
create policy "staff_all_gi_visitors" on public.gi_visitors for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_gi_events" on public.gi_events;
create policy "staff_all_gi_events" on public.gi_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_wordpress_checks" on public.wordpress_checks;
create policy "staff_all_wordpress_checks" on public.wordpress_checks for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "auth_all_funnels" on public.funnels;
create policy "staff_all_funnels" on public.funnels for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- anon_read_funnels (status = 'Published') is a separate, correctly-scoped
-- anon-role policy and is untouched by this migration.

drop policy if exists "auth_all_funnel_pages" on public.funnel_pages;
create policy "staff_all_funnel_pages" on public.funnel_pages for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- anon_read_funnel_pages (published-parent-only, from
-- drop_unused_anon_rls_policies.sql) is untouched by this migration.

-- ── Part 3: tables with only SELECT+INSERT (no update/delete ever
--    existed) — using `for all` here would newly GRANT update/delete,
--    which is a widening, not a tightening. Match exact original coverage.
drop policy if exists "auth_read_contact_timeline" on public.contact_timeline;
drop policy if exists "auth_insert_contact_timeline" on public.contact_timeline;
create policy "staff_select_contact_timeline" on public.contact_timeline for select to authenticated using (public.is_staff());
create policy "staff_insert_contact_timeline" on public.contact_timeline for insert to authenticated with check (public.is_staff());

-- ── Part 4: company_files had SELECT+INSERT+DELETE but no UPDATE — same
--    reasoning, split into per-command policies instead of `for all`.
drop policy if exists "auth_read_company_files" on public.company_files;
drop policy if exists "auth_insert_company_files" on public.company_files;
drop policy if exists "auth_delete_company_files" on public.company_files;
create policy "staff_select_company_files" on public.company_files for select to authenticated using (public.is_staff());
create policy "staff_insert_company_files" on public.company_files for insert to authenticated with check (public.is_staff());
create policy "staff_delete_company_files" on public.company_files for delete to authenticated using (public.is_staff());
