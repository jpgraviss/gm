import { NextRequest } from 'next/server'

// Shared by proxy.ts (rate limiting) and lib/rbac.ts (IP Restriction,
// AUDIT.md #207) so both read the client IP the same way.
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
