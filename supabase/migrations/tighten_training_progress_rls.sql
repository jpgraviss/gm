-- AUDIT.md #47 — RLS tightening, scoped to the two tables added this
-- session as a proof of concept (not the systemic ~24-table pattern,
-- which is a separate, larger project — see AUDIT.md's note on this).
--
-- Both tables had "using (true) to authenticated" — any user who ever
-- completed the magic-link/Google login flow holds a real Supabase Auth
-- session in their browser (confirmed: lib/supabase.ts's getSupabaseClient
-- is used in app/login, app/team-login, app/auth/confirm), so this was a
-- real, not theoretical, gap: any staff member could call the Supabase
-- REST API directly and read every row, bypassing the API layer's own
-- per-user scoping (app/api/training/progress/route.ts already restricts
-- non-admins to their own user_email — the DB just didn't enforce it too).
--
-- The app's own reads/writes go through createServiceClient() (the
-- service-role key), which bypasses RLS entirely — this change only
-- affects a direct Supabase REST call using a real user session, not the
-- app's normal operation. No INSERT/UPDATE policy exists for
-- `authenticated` on either table, so writes were already denied by
-- default (RLS enabled, no matching policy) — only SELECT needed tightening.
drop policy if exists "auth_read_training_progress" on public.training_progress;
create policy "own_or_admin_read_training_progress" on public.training_progress
  for select to authenticated
  using (
    user_email = (auth.jwt() ->> 'email')
    or exists (
      select 1 from public.team_members tm
      where tm.email = (auth.jwt() ->> 'email')
        and (tm.is_admin or tm.role in ('Leadership', 'Super Admin'))
    )
  );

-- rotation_state holds no personal data (just automation_id -> rotation
-- index) — lower sensitivity than training_progress, but "any
-- authenticated user" is still wider than necessary; tighten to staff only.
drop policy if exists "auth_read_rotation_state" on public.rotation_state;
create policy "staff_read_rotation_state" on public.rotation_state
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.email = (auth.jwt() ->> 'email')
    )
  );
