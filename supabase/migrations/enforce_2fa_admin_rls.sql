-- AUDIT.md #507 — four RLS policies bypass the #439/#440 2FA-RLS fix
-- entirely: admin_delete_projects, admin_delete_maintenance,
-- admin_delete_tickets, and admin_all_app_settings (all in
-- tighten_authenticated_rls.sql) call public.auth_user_is_admin()
-- directly instead of going through public.is_staff() — the single
-- choke-point enforce_2fa_session_rls.sql patched with the
-- staff_two_factor_ok() check. same_unit_or_admin() (used by several
-- other policies) also calls auth_user_is_admin() directly, so it shares
-- the same gap. All of these remained completely unaware of 2FA state
-- even after enforce_2fa_session_rls.sql is applied.
--
-- NOT applied — no live Supabase dashboard/CLI access this session. Run
-- this file's contents manually in the Supabase SQL editor, AFTER
-- enforce_2fa_session_rls.sql (this migration calls the
-- staff_two_factor_ok() function that one creates — applying this first
-- would fail with "function staff_two_factor_ok() does not exist").
--
-- ── MECHANISM ───────────────────────────────────────────────────────────
-- Same fix as #439/#440, applied to the other admin choke-point: fold
-- staff_two_factor_ok() directly into auth_user_is_admin() itself, so
-- every policy/function that calls it (the 4 named above, plus
-- same_unit_or_admin() and anything else in the future) automatically
-- inherits the 2FA gate with nothing else to edit. Fails CLOSED (denies
-- admin access) if Two-Factor Auth is Required and the calling session
-- hasn't completed a real 2FA check — identical fail-closed posture to
-- is_staff() in enforce_2fa_session_rls.sql.
--
-- ── WHY A SEPARATE MIGRATION, NOT A ONE-LINE EDIT TO tighten_authenticated_
--    rls.sql ────────────────────────────────────────────────────────────
-- supabase/migrations/*.sql files in this repo are applied once, in
-- order, and never edited after the fact (see enforce_2fa_session_rls.sql's
-- own header) — a fresh `create or replace function` here is the
-- established pattern for patching an already-shipped function, not
-- editing the original migration file in place.

create or replace function public.auth_user_is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(
    (select is_admin from public.team_members where id = auth.uid()::text limit 1),
    false
  ) then
    return false;
  end if;

  -- Same 2FA gate as is_staff() — an admin whose session hasn't completed
  -- a real 2FA check (while Two-Factor Auth is Required) is not treated
  -- as admin for RLS purposes, closing the #507 gap across every policy
  -- that calls auth_user_is_admin() (directly, or via same_unit_or_admin()).
  return public.staff_two_factor_ok();
end;
$$;

comment on function public.auth_user_is_admin() is
  'AUDIT.md #507 — now requires staff_two_factor_ok() in addition to team_members.is_admin, closing the 2FA-RLS bypass that admin_delete_projects/admin_delete_maintenance/admin_delete_tickets/admin_all_app_settings/same_unit_or_admin() all had via this function. Must be applied after enforce_2fa_session_rls.sql (depends on staff_two_factor_ok()).';
