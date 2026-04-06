import { NextRequest, NextResponse } from 'next/server'

// ── Rate-limit state (in-memory, per-instance) ─────────────────────────────
// In production with multiple instances, replace with Redis/Upstash.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > maxRequests
}

// Periodically clean up expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 5 * 60 * 1000)

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_PREFIXES = [
  '/api/auth/google-verify',   // Google SSO login verification (staff + clients)
  '/api/calendar/settings/',   // Public booking page slug lookup
  '/api/calendar/slots',       // Public availability check
  '/api/calendar/callback',    // Google OAuth callback
  '/api/bookings',             // Public booking creation (POST) & list
  '/api/portal-clients/reset-password',
  '/api/quickbooks/callback',  // QB OAuth callback
  '/api/drive/callback',       // Google Drive OAuth callback
  '/api/auth/auto-provision',  // Auto-create team_members profile on first login
  '/api/auth/profile',         // Server-side profile lookup during login
  '/api/auth/verify-email',    // Check if email exists (magic link pre-check)
  '/api/signatures/',           // Public signature fetch/submit by token
  '/api/email/sign-request',    // Signing email (called from signatures POST)
]

const ADMIN_SETUP_PREFIXES = [
  '/api/admin/setup',
  '/api/admin/fix-passwords',
]

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // ── CSRF protection for state-changing requests ─────────────────────────
  // Verify that the Origin/Referer header matches the host to prevent
  // cross-site request forgery on non-GET/HEAD/OPTIONS requests.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin && host) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'Cross-origin request blocked' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid origin header' },
          { status: 403 }
        )
      }
    }
  }

  // ── Rate-limit admin setup endpoints (5 requests per hour per IP) ────────
  if (ADMIN_SETUP_PREFIXES.some(p => pathname.startsWith(p))) {
    const ip = getClientIp(req)
    if (isRateLimited(`admin:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }
    // Admin setup uses x-setup-secret header, handled in route — let it through
    return NextResponse.next()
  }

  // ── Public routes: no auth required ──────────────────────────────────────
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    // Rate-limit public booking creation (20 per hour per IP)
    if (pathname.startsWith('/api/bookings') && req.method === 'POST') {
      const ip = getClientIp(req)
      if (isRateLimited(`booking:${ip}`, 20, 60 * 60 * 1000)) {
        return NextResponse.json(
          { error: 'Too many booking requests. Try again later.' },
          { status: 429 }
        )
      }
    }
    return NextResponse.next()
  }

  // ── Calendar auth is semi-public (initiates OAuth) ───────────────────────
  if (pathname === '/api/calendar/auth') {
    return NextResponse.next()
  }

  // ── All other API routes: require authentication ─────────────────────────
  // Check for Supabase auth cookie, gravhub session cookie, or Authorization header.
  const hasAuthCookie = req.cookies.getAll().some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  const hasGravhubCookie = req.cookies.has('gravhub-auth')
  const hasAuthHeader = !!req.headers.get('authorization')

  if (!hasAuthCookie && !hasGravhubCookie && !hasAuthHeader) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // General API rate limit: 200 requests per minute per IP
  const ip = getClientIp(req)
  if (isRateLimited(`api:${ip}`, 200, 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
