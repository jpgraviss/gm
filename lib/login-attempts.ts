// AUDIT.md #207 — "Login Attempts" (brute-force protection) had zero
// enforcement. Real account-level lockout for the auth surfaces where a
// failure is actually observable server-side: Google Sign-In against an
// unrecognized/disabled account, the portal magic-link token, and the
// portal onboarding verification code. Password-based login for portal
// clients goes straight to Supabase Auth client-side — a wrong password
// never reaches this backend at all, so it can't be tracked here; Supabase
// has its own independent brute-force protection on that path regardless.
//
// In-memory only, same tradeoff proxy.ts's rate limiter already documents
// ("fine for a small team," resets per server instance/restart) — this
// isn't the sole line of defense for the surfaces above, since verify-code
// endpoints are also IP-rate-limited (AUDIT.md #198).

const attempts = new Map<string, { count: number; resetAt: number }>()
const LOCKOUT_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

function key(identifier: string): string {
  return identifier.toLowerCase().trim()
}

export function isLockedOut(identifier: string, maxAttempts: number | 'unlimited'): boolean {
  if (maxAttempts === 'unlimited') return false
  const entry = attempts.get(key(identifier))
  if (!entry) return false
  if (Date.now() > entry.resetAt) {
    attempts.delete(key(identifier))
    return false
  }
  return entry.count >= maxAttempts
}

export function recordFailedAttempt(identifier: string): void {
  const k = key(identifier)
  const now = Date.now()
  const entry = attempts.get(k)
  if (!entry || now > entry.resetAt) {
    attempts.set(k, { count: 1, resetAt: now + LOCKOUT_WINDOW_MS })
    return
  }
  entry.count++
}

export function clearAttempts(identifier: string): void {
  attempts.delete(key(identifier))
}
