import { NextRequest, NextResponse } from 'next/server'

// ── Rate limiters ────────────────────────────────────────────────────────────
// In-memory only. Upstash Redis was removed because module-load failures
// (bad URL/token, edge runtime issues) were crashing the entire proxy with
// MIDDLEWARE_INVOCATION_FAILED, blocking every request to the site.
//
// In-memory is fine for a small team — single Vercel instance handles
// requests serially per-region. If you need cross-instance rate limiting,
// re-introduce Upstash inside a try/catch with proven config.

const memoryMap = new Map<string, { count: number; resetAt: number }>()

function memoryLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memoryMap.get(key)
  if (!entry || now > entry.resetAt) {
    memoryMap.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/calendar/settings/',
  '/api/calendar/slots',
  '/api/calendar/callback',
  '/api/calendar/feed/',
  '/api/bookings',
  '/api/portal-clients/magic-link',
  '/api/portal-clients/verify-code',
  '/api/portal-clients/reset-password',
  '/api/portal-clients/check-approval',
  '/api/portal-clients/complete-setup',
  '/api/drive/callback',
  '/api/signatures/',
  '/api/forms/public/',
  '/api/sequences/webhooks',
  '/api/sequences/unsubscribe',
  '/api/unsubscribe/',
  '/api/track/',
  '/api/chatbots/',
  '/api/push/subscribe',
  '/api/portal/',
  '/api/intelligence/track',
  '/api/intelligence/script',
]

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function proxyImpl(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  const isPublicRoute = PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  // ── CSRF protection for state-changing requests ─────────────────────────
  // Public routes are intentionally exempt — they're embedded on external
  // sites (forms, booking widgets) and must allow cross-origin POSTs.
  if (!isPublicRoute && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
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

  // ── Public routes: no auth required ──────────────────────────────────────
  if (isPublicRoute) {
    if (pathname.startsWith('/api/bookings') && req.method === 'POST') {
      const ip = getClientIp(req)
      if (memoryLimited(`booking:${ip}`, 20, 60 * 60 * 1000)) {
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
  if (memoryLimited(`api:${ip}`, 200, 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

/**
 * Proxy entry point — wraps proxyImpl in try/catch so any unhandled
 * exception logs and returns NextResponse.next() instead of crashing
 * with MIDDLEWARE_INVOCATION_FAILED. The proxy MUST never block the
 * entire site.
 */
export function proxy(req: NextRequest): NextResponse {
  try {
    return proxyImpl(req)
  } catch (err) {
    console.error('[proxy] unhandled error, falling through:', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/api/:path*',
}
