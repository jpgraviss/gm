import { NextRequest } from 'next/server'

// Shared by proxy.ts (rate limiting) and lib/rbac.ts (IP Restriction,
// AUDIT.md #207) so both read the client IP the same way.
//
// AUDIT #653 — this used to take the FIRST (leftmost) entry of
// x-forwarded-for, which is exactly the part of the header a client fully
// controls (Vercel's edge appends the real connecting IP as a later entry
// rather than overwriting a client-supplied value). That let any caller
// bypass the IP Restriction admin feature and defeat every IP-keyed rate
// limiter by sending a forged header. x-vercel-forwarded-for is set by
// Vercel's edge itself and can't be spoofed by the client; x-real-ip is
// the next-best platform-set fallback. Only as a last resort do we fall
// back to x-forwarded-for, and there we take the LAST hop (closest to the
// edge, not attacker-appended) rather than the first.
export function getClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0]?.trim() || 'unknown'

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map(h => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return 'unknown'
}
