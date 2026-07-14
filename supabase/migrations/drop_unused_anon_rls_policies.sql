-- AUDIT.md #47 follow-up — a systemic review found every "public-facing"
-- flow in this app (booking widget, form embeds, signature signing,
-- proposal viewing, review requests, the WordPress plugin) actually goes
-- through this app's own Next.js API routes using the SERVICE-ROLE client
-- (createServiceClient(), which bypasses RLS entirely), not a direct
-- browser call to Supabase's REST API with the anon key.
--
-- Confirmed exhaustively: NEXT_PUBLIC_SUPABASE_ANON_KEY is referenced in
-- exactly 2 files in this entire repo — lib/supabase.ts (only used by the
-- 3 staff login/auth-confirm pages) and a health-check route. No form
-- embed script, booking widget, signature page, or WordPress plugin call
-- ever uses it. That means every "to anon" RLS policy in this schema is
-- simultaneously (a) dead code — the app's real functionality does not
-- depend on it working — and (b) pure attack surface, since the anon key
-- itself is public (baked into the client bundle), so `to anon using
-- (true)` on a table is equivalent to "world-readable with no auth at
-- all," via a direct Supabase REST call that bypasses this app entirely.
--
-- Two of these are severe: calendar_settings stores live Google OAuth
-- access/refresh tokens per staff member (anon_read_calendar_settings);
-- signature_requests stores e-signature data plus the signing token
-- itself, and its "by_token" policies don't actually check the caller
-- supplied that token (Postgres RLS `using (true)` can't compare against
-- a value the client claims — every row is exposed regardless of which
-- token, if any, the requester has).
--
-- Not touched: `anon_read_funnels` (funnels, status = 'Published') is
-- correctly scoped to intentionally-public content and left as-is.
-- `anon_read_funnel_pages` (funnel_pages) was NOT similarly scoped —
-- tightened below to match its own sibling policy's intent instead of
-- dropped outright, since funnel pages are a genuine, deliberate
-- public-facing feature (unlike everything else in this file, which was
-- accidental over-exposure with zero real usage).

drop policy if exists "anon_read_bookings" on public.bookings;
drop policy if exists "anon_insert_bookings" on public.bookings;

drop policy if exists "anon_read_calendar_settings" on public.calendar_settings;

drop policy if exists "anon_write_wordpress_site_health" on public.wordpress_site_health;
drop policy if exists "anon_write_wordpress_seo_settings" on public.wordpress_seo_settings;
drop policy if exists "anon_write_wordpress_seo_scores" on public.wordpress_seo_scores;

drop policy if exists "anon_read_automation_runs" on public.automation_runs;

drop policy if exists "anon_read_client_integrations" on public.client_integrations;

drop policy if exists "anon_read_forms" on public.forms;
drop policy if exists "anon_insert_form_submissions" on public.form_submissions;

drop policy if exists "anon_read" on public.portal_notifications;

drop policy if exists "anon_read_proposals_by_token" on public.proposals;

drop policy if exists "anon_read_review_requests" on public.review_requests;
drop policy if exists "anon_update_review_requests" on public.review_requests;

drop policy if exists "anon_read_courses" on public.courses;

drop policy if exists "anon_read_by_token" on public.signature_requests;
drop policy if exists "anon_update_by_token" on public.signature_requests;

-- funnel_pages — tighten to match anon_read_funnels' existing intent
-- (published-parent-only) instead of dropping, since this is a real
-- public-facing feature.
drop policy if exists "anon_read_funnel_pages" on public.funnel_pages;
create policy "anon_read_funnel_pages" on public.funnel_pages
  for select to anon
  using (
    exists (
      select 1 from public.funnels f
      where f.id = funnel_pages.funnel_id
        and f.status = 'Published'
    )
  );
