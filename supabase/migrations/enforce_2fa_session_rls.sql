-- AUDIT.md #439 / #440 — "Two-Factor Auth: Required" (AUDIT #343/#207) only
-- ever gated this app's own httpOnly gravhub-auth cookie/API layer
-- (app/api/auth/session/route.ts). It had zero relationship to the
-- underlying Supabase Auth session/JWT that becomes fully live the instant
-- a magic link is clicked (app/team-login/page.tsx's
-- supabase.auth.signInWithOtp -> app/auth/confirm/page.tsx), well before
-- the 2FA code is entered. Every is_staff()-gated RLS policy across
-- tighten_authenticated_rls.sql / _part2.sql / every table created since
-- authorizes purely on "is this auth.uid() a row in team_members" — zero
-- 2FA awareness. Since the Supabase anon key ships in the client bundle by
-- design and the real access_token is retrievable client-side the moment
-- the magic link is clicked, anyone holding the magic-link email could
-- query the Supabase REST API directly with that token and read/write
-- most of the app's real business data before ever completing (or even
-- seeing) the 2FA prompt.
--
-- NOT applied — no live Supabase dashboard/CLI access this session. Run
-- this file's contents manually in the Supabase SQL editor, same
-- convention as every other migration in this directory.
--
-- ── MECHANISM CHOSEN ────────────────────────────────────────────────────
-- Correlate the STANDARD `session_id` claim Supabase Auth already embeds
-- in every access-token JWT (auth.jwt()->>'session_id', referencing the
-- auth.sessions row for that specific browser sign-in — the same
-- auth.jwt() function this schema already relies on elsewhere, see
-- add_granola_integration.sql's `auth.jwt() ->> 'email'`) against a new
-- server-only table (two_factor_verified_sessions) that
-- app/api/auth/2fa-verify/route.ts writes to the instant a real code is
-- checked. RLS policies read this table LIVE, at query-evaluation time,
-- via a new staff_two_factor_ok() function folded directly into
-- is_staff() itself — the single choke point every staff-gated policy in
-- this schema already calls, so this migration closes the gap across
-- every one of those tables in one place, with nothing else to edit.
-- Because the check is a live table lookup (not a claim baked into the
-- JWT at mint time), the exact same Supabase access token the browser
-- already holds becomes usable for RLS-gated reads the instant 2FA is
-- verified — no JWT re-mint / refreshSession() call required.
--
-- ── ALTERNATIVE CONSIDERED AND REJECTED ────────────────────────────────
-- A Supabase "Custom Access Token Hook" (a Postgres function that mints a
-- custom `two_factor_verified` JWT claim) is the more commonly-documented
-- pattern for this class of problem and was seriously considered first.
-- Rejected because enabling a Custom Access Token Hook is NOT a pure-SQL
-- operation — it additionally requires toggling it on in the Supabase
-- Dashboard (Authentication -> Hooks) or a supabase/config.toml + CLI
-- deploy, neither of which this session can do or verify with no live
-- Supabase dashboard/CLI access. It would also only take effect on the
-- NEXT JWT mint (a fresh login or an access-token refresh), requiring the
-- app to force a refreshSession() call right after 2FA passes and trust
-- the hook re-fires correctly — an extra moving part this session has no
-- way to confirm end-to-end. The session_id-correlation approach below
-- needs nothing beyond this migration file plus the accompanying
-- app-code changes to app/api/auth/2fa-verify/route.ts and
-- contexts/AuthContext.tsx.
--
-- ── CONFIDENCE NOTE — please read before treating this as fully verified ──
-- `session_id` being a stable, always-present claim on every
-- Supabase-issued access token (constant across access-token refreshes for
-- the same sign-in, only changing on a genuinely new sign-in/session) is
-- standard, longstanding Supabase Auth (GoTrue) behavior and is the
-- documented basis for Supabase's own "sign out of other sessions" /
-- single-active-session RLS recipes — but it has NOT been verified against
-- a live JWT in this environment (no live Supabase access this session).
-- staff_two_factor_ok() below fails CLOSED (denies access) if the claim is
-- ever missing/null while Two-Factor Auth is Required, so a wrong
-- assumption here shows up as staff being unable to read is_staff()-gated
-- tables via a direct client-side Supabase call while "Required" is on —
-- NOT as a silent bypass. All of the app's own server-side routes use the
-- service role (bypasses RLS entirely) and are completely unaffected
-- either way. Recommended smoke test after applying: with Two-Factor Auth
-- set to Required, sign in via magic link, complete the 2FA code, and
-- confirm the app's UI (which reads team_members via the anon-key client
-- in contexts/AuthContext.tsx) still loads the profile normally on a page
-- reload afterward.

create table if not exists public.two_factor_verified_sessions (
  session_id  uuid primary key,
  user_id     uuid not null,
  verified_at timestamptz not null default now()
);

comment on table public.two_factor_verified_sessions is
  'AUDIT.md #439 — one row per Supabase Auth session (auth.jwt()->>''session_id'') that has completed a real 2FA code check via app/api/auth/2fa-verify/route.ts. Written only by that route using the service role. No authenticated/anon RLS policies are defined below — direct client access is fully denied by default (RLS enabled, zero permissive policies for those roles); only the service role (bypasses RLS) and security definer functions can read/write it.';

create index if not exists idx_2fa_verified_sessions_user on public.two_factor_verified_sessions(user_id);

alter table public.two_factor_verified_sessions enable row level security;
-- Deliberately no policies for `authenticated`/`anon` — RLS enabled with
-- zero permissive policies means those roles get zero access by default.
-- The 2fa-verify route writes via createServiceClient() (service role,
-- bypasses RLS); staff_two_factor_ok() below reads via a security definer
-- function (also bypasses RLS, same pattern as is_staff() itself reading
-- team_members).

create or replace function public.staff_two_factor_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_required boolean;
  v_session_id text;
begin
  select coalesce((security ->> 'twoFactor') = 'required', false)
  into v_required
  from public.app_settings
  where id = 'global';

  -- Two-Factor Auth isn't Required (or app_settings has no row yet) —
  -- nothing to gate. Mirrors app/api/auth/session/route.ts's own
  -- `security.twoFactor === 'required'` check exactly, so RLS and the
  -- app-layer cookie gate always agree.
  if not coalesce(v_required, false) then
    return true;
  end if;

  v_session_id := auth.jwt() ->> 'session_id';
  -- Fail CLOSED: no session_id claim on this JWT means we can't prove this
  -- specific session completed 2FA, so it does not count as staff for RLS
  -- purposes while Required is on.
  if v_session_id is null then
    return false;
  end if;

  return exists (
    select 1 from public.two_factor_verified_sessions s
    where s.session_id = v_session_id::uuid
  );
exception when others then
  -- Fail closed on any unexpected error (e.g. a malformed/non-uuid
  -- session_id) rather than raising and breaking every is_staff()-gated
  -- query app-wide.
  return false;
end;
$$;

-- Fold the 2FA check directly into is_staff() — the single choke-point
-- function every staff-gated policy in tighten_authenticated_rls.sql /
-- _part2.sql / every table created since already calls (self-contained
-- create-or-replace, matching this schema's established
-- load-order-independence convention — see tighten_authenticated_rls_
-- part2.sql's own comment on why). This closes AUDIT.md #439 across every
-- one of those tables in one place, with no need to touch each policy
-- individually — is_staff() is confirmed (grep across every migration
-- file) to have zero callers outside RLS `using`/`with check` clauses, so
-- this cannot affect any other stored procedure or app code path.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm where tm.id = auth.uid()::text
  )
  and public.staff_two_factor_ok();
$$;
