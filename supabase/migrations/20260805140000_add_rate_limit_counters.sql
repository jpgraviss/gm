-- Durable, cross-instance counters for account lockout and rate limiting.
--
-- `lib/login-attempts.ts` (account lockout for Google Sign-In, the staff and
-- portal onboarding verification codes, and the 2FA code) used an in-process
-- Map.
-- The file honestly documented the tradeoff, but on Vercel it isn't a small
-- one: functions run as many short-lived, independently-scaled instances,
-- so an attacker hitting different instances effectively resets the
-- counter, and a cold start clears it outright. That leaves brute-force
-- protection substantially weaker than the Security Settings UI implies.
--
-- Scope note: `proxy.ts`'s IP limiter deliberately stays in-memory. It runs
-- in middleware on EVERY request, so backing it with Postgres would add a
-- database round trip to every page load to tighten a coarse 200-req/min
-- ceiling. The account lockout is the one that actually gates credentials,
-- and it only writes on FAILED attempts.
--
-- Backed by Postgres rather than Redis/Upstash on purpose: Supabase is
-- already here, so this needs no new paid dependency or infra decision,
-- and lockout writes are low-volume (only on FAILED auth attempts).
--
-- `reset_at` makes each row self-expiring; `increment_rate_limit_counter`
-- does the read-modify-write inside a single atomic UPSERT so two
-- concurrent attempts can't both read the same count and under-count.

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key        text primary key,
  count      integer not null default 0,
  reset_at   timestamptz not null,
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_reset_at
  ON public.rate_limit_counters(reset_at);

-- Atomically bump a counter, resetting it first if its window has passed.
-- Returns the post-increment count so the caller can decide in one round
-- trip. Same atomic-UPSERT pattern as next_rotation_index() (AUDIT #43).
CREATE OR REPLACE FUNCTION public.increment_rate_limit_counter(
  p_key text,
  p_window_seconds integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_counters (key, count, reset_at, updated_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds), now())
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
                  WHEN public.rate_limit_counters.reset_at < now() THEN 1
                  ELSE public.rate_limit_counters.count + 1
                END,
        reset_at = CASE
                     WHEN public.rate_limit_counters.reset_at < now()
                       THEN now() + make_interval(secs => p_window_seconds)
                     ELSE public.rate_limit_counters.reset_at
                   END,
        updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- No client-role access at all: this table is only ever touched by the
-- service-role key from server-side auth code. Deliberately no policy for
-- `authenticated` — a signed-in user has no business reading or clearing
-- their own lockout counter.
