// AUDIT.md #207 — "Login Attempts" (brute-force protection) had zero
// enforcement. Real account-level lockout for the auth surfaces where a
// failure is actually observable server-side: Google Sign-In against an
// unrecognized/disabled account, and the staff and portal onboarding
// verification codes (plus the 2FA code). The portal magic-link redemption
// route is deliberately NOT tracked here — its token is 32 bytes of
// crypto.randomBytes and single-use, so there is no small guess space to
// lock out, and it is IP-rate-limited in proxy.ts regardless. (An earlier
// version of this comment claimed it was covered; it never was.)
// Password-based login for portal
// clients goes straight to Supabase Auth client-side — a wrong password
// never reaches this backend at all, so it can't be tracked here; Supabase
// has its own independent brute-force protection on that path regardless.
//
// Originally an in-process Map. On Vercel that isn't a small tradeoff:
// routes run as many short-lived, independently-scaled instances, so an
// attacker spreading attempts across instances effectively resets the
// counter and a cold start clears it outright — leaving the lockout
// materially weaker than the Security Settings UI implies. Counters now
// live in Postgres (`rate_limit_counters`, migration
// 20260805140000_add_rate_limit_counters.sql), incremented through an
// atomic UPSERT so two concurrent failures can't both read the same count.
//
// The in-process Map is kept as a *second* layer, not a replacement: if the
// database write fails, behavior degrades to exactly what it was before
// rather than to no protection at all. A caller is locked out if EITHER
// layer says so, so the two can only ever tighten each other.

import { createServiceClient } from '@/lib/supabase'

const LOCKOUT_WINDOW_SECONDS = 30 * 60 // 30 minutes
const LOCKOUT_WINDOW_MS = LOCKOUT_WINDOW_SECONDS * 1000

const attempts = new Map<string, { count: number; resetAt: number }>()

function key(identifier: string): string {
  return `login:${identifier.toLowerCase().trim()}`
}

/** Current in-process count, treating an elapsed window as zero. */
function localCount(k: string): number {
  const entry = attempts.get(k)
  if (!entry) return 0
  if (Date.now() > entry.resetAt) {
    attempts.delete(k)
    return 0
  }
  return entry.count
}

export async function isLockedOut(
  identifier: string,
  maxAttempts: number | 'unlimited',
): Promise<boolean> {
  if (maxAttempts === 'unlimited') return false
  const k = key(identifier)

  // Local layer first — free, and authoritative when it already trips.
  if (localCount(k) >= maxAttempts) return true

  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('rate_limit_counters')
      .select('count, reset_at')
      .eq('key', k)
      .maybeSingle()

    if (error || !data) return false
    // An expired window is not a lockout; the row is rewritten (not read)
    // on the next failed attempt, so there's nothing to clean up here.
    if (new Date(data.reset_at).getTime() <= Date.now()) return false
    return (Number(data.count) || 0) >= maxAttempts
  } catch {
    // Fail open rather than locking every account out of the product when
    // the database is unreachable — the auth lookup immediately after this
    // check needs the same database anyway, so a DB outage already blocks
    // the login. The in-process layer above still applies.
    return false
  }
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  const k = key(identifier)
  const now = Date.now()
  const entry = attempts.get(k)
  if (!entry || now > entry.resetAt) {
    attempts.set(k, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS })
  } else {
    entry.count++
  }

  try {
    const db = createServiceClient()
    await db.rpc('increment_rate_limit_counter', {
      p_key: k,
      p_window_seconds: LOCKOUT_WINDOW_SECONDS,
    })
  } catch {
    // Best effort: the local counter above already recorded this attempt.
  }
}

export async function clearAttempts(identifier: string): Promise<void> {
  const k = key(identifier)
  attempts.delete(k)

  try {
    const db = createServiceClient()
    await db.from('rate_limit_counters').delete().eq('key', k)
  } catch {
    // Best effort. A stale row only expires the counter late, and only for
    // an identifier that has *just* authenticated successfully.
  }
}

/** Test-only: drop the in-process layer between cases. */
export function __resetLocalAttempts(): void {
  attempts.clear()
}
