-- AUDIT #507 — four RLS policies bypassed the 2FA gate entirely.
--
-- `enforce_2fa_session_rls.sql` closed AUDIT #439 by folding
-- `staff_two_factor_ok()` directly into `is_staff()`, the single choke-point
-- function every staff-gated policy calls. That approach fixes every table
-- at once *provided the policy actually routes through is_staff()*.
--
-- These four don't. They call `auth_user_is_admin()` directly, so they were
-- never touched by that fix and remain completely unaware of 2FA state:
--
--   admin_delete_projects      DELETE on projects
--   admin_delete_maintenance   DELETE on maintenance_records
--   admin_delete_tickets       DELETE on tickets
--   admin_all_app_settings     ALL on app_settings
--
-- The Supabase anon key ships in the client bundle by design and the real
-- access_token is retrievable from the browser, so with "Two-Factor Auth:
-- Required" turned on, an admin session that never completed the 2FA step
-- could still delete projects, maintenance records and tickets, and
-- read/write app_settings — including the security settings that hold the
-- 2FA toggle itself.
--
-- Verified against the live database before writing this (2026-08-05):
--   is_staff_gated        = true   -- the #439 fold is live
--   policies_via_is_staff = 115    -- and covers 115 policies
--   policies_bypassing    = 4      -- exactly these
--
-- Requiring BOTH functions keeps the admin restriction exactly as it was and
-- adds the 2FA gate the other 115 already have. Deliberately not replacing
-- `auth_user_is_admin()` with `is_staff()` alone — that would widen these
-- from admin-only to any staff member.
--
-- Note on failure mode: staff_two_factor_ok() fails CLOSED by design. With
-- 2FA Required on, a session that can't prove verification loses these
-- rights — including client-side writes to app_settings. The app's own admin
-- routes use the service-role key and bypass RLS, so Settings keeps working;
-- this only affects direct PostgREST access from the browser, which is
-- exactly the hole being closed.

BEGIN;

DROP POLICY IF EXISTS "admin_delete_projects" ON public.projects;
CREATE POLICY "admin_delete_projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_staff() AND public.auth_user_is_admin());

DROP POLICY IF EXISTS "admin_delete_maintenance" ON public.maintenance_records;
CREATE POLICY "admin_delete_maintenance" ON public.maintenance_records
  FOR DELETE TO authenticated
  USING (public.is_staff() AND public.auth_user_is_admin());

DROP POLICY IF EXISTS "admin_delete_tickets" ON public.tickets;
CREATE POLICY "admin_delete_tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (public.is_staff() AND public.auth_user_is_admin());

DROP POLICY IF EXISTS "admin_all_app_settings" ON public.app_settings;
CREATE POLICY "admin_all_app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_staff() AND public.auth_user_is_admin())
  WITH CHECK (public.is_staff() AND public.auth_user_is_admin());

COMMIT;

-- Re-run to confirm; policies_bypassing should now be 0:
--
--   SELECT count(*) AS policies_bypassing
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND (qual LIKE '%auth_user_is_admin%'
--        OR with_check LIKE '%auth_user_is_admin%'
--          )
--      AND qual NOT LIKE '%is_staff%';
