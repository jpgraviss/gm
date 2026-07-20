import { NextRequest, NextResponse } from 'next/server'
import { verifySessionCookie } from '@/lib/session-cookie'
import { getClientIp } from '@/lib/request-ip'

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
  '/api/calendar/booking-types',
  '/api/calendar/bookings',
  '/api/bookings',
  '/api/portal-clients/magic-link',
  '/api/portal-clients/verify-code',
  '/api/portal-clients/check-approval',
  '/api/portal-clients/complete-setup',
  '/api/team-members/check-approval',
  '/api/drive/callback',
  '/api/signatures/',
  '/api/proposals/view/',
  '/api/forms/public/',
  '/api/sequences/webhooks',
  '/api/sequences/unsubscribe',
  '/api/email/inbound',
  '/api/unsubscribe/',
  '/api/track/',
  '/api/chatbots/',
  '/api/push/subscribe',
  '/api/portal/',
  '/api/intelligence/track',
  '/api/intelligence/script',
  '/api/reputation/review-request/',
  '/api/stripe/webhook',
]

async function proxyImpl(req: NextRequest): Promise<NextResponse> {
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
    // Unauthenticated widget endpoint that calls a real LLM per message —
    // otherwise the only public route with zero request throttling,
    // a real cost/DoS vector (unlimited scripted requests run up live
    // AI-provider spend with no server-side limit at all).
    if (/^\/api\/chatbots\/[^/]+\/chat$/.test(pathname) && req.method === 'POST') {
      const ip = getClientIp(req)
      if (memoryLimited(`chatbot-chat:${ip}`, 30, 60 * 1000)) {
        return NextResponse.json(
          { error: 'Too many messages. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
    }
    // Onboarding 6-digit codes (~900k possibilities, 24h validity) are
    // otherwise unthrottled brute-force targets — success here feeds
    // directly into setting a real account password.
    if ((pathname === '/api/auth/verify-code' || pathname === '/api/auth/setup-account') && req.method === 'POST') {
      const ip = getClientIp(req)
      if (memoryLimited(`auth-code:${ip}`, 15, 60 * 60 * 1000)) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a while and try again.' },
          { status: 429 }
        )
      }
    }
    // AUDIT.md #198 — the portal-client equivalent of the staff onboarding
    // flow above (verify-code's ~900k-combination code, complete-setup's
    // real password write via db.auth.admin.updateUserById) had no matching
    // throttle at all, despite being the identical class of brute-forceable
    // account-takeover surface.
    if ((pathname === '/api/portal-clients/verify-code' || pathname === '/api/portal-clients/complete-setup') && req.method === 'POST') {
      const ip = getClientIp(req)
      if (memoryLimited(`portal-auth-code:${ip}`, 15, 60 * 60 * 1000)) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a while and try again.' },
          { status: 429 }
        )
      }
    }
    // AUDIT.md #207 — the 2FA sign-in code is the same brute-forceable
    // 6-digit-code class of surface as the two above.
    if (pathname === '/api/auth/2fa-verify' && req.method === 'POST') {
      const ip = getClientIp(req)
      if (memoryLimited(`2fa-code:${ip}`, 15, 60 * 60 * 1000)) {
        return NextResponse.json(
          { error: 'Too many attempts. Please wait a while and try again.' },
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
  // This is a fast outer gate, not the sole line of defense — route handlers
  // that need real identity/role (requireAdmin, requireRole, requirePortalClient)
  // independently re-verify. But the gravhub-auth cookie itself must be
  // cryptographically verified here too, not just checked for presence —
  // otherwise `Cookie: gravhub-auth=1` would forge past this gate entirely.
  const hasSupabaseCookie = req.cookies.getAll().some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  const hasValidBridgeCookie = (await verifySessionCookie(req.cookies.get('gravhub-auth')?.value)) !== null
  const hasAuthHeader = !!req.headers.get('authorization')
  // AUDIT.md #32 — the WordPress plugin authenticates every /api/wordpress/
  // route via a pre-shared key in this header (lib/wordpress-auth.ts), not
  // a cookie or Authorization header. Presence-only here, same as
  // hasAuthHeader above — actual key validation happens downstream in
  // requireWordPressAuth. This lets those routes stay OFF the public-route
  // list (so CSRF/auth actually apply to their staff-cookie-authenticated
  // paths) while still letting the plugin's key-only server calls through.
  const hasGravHubKey = !!req.headers.get('x-gravhub-key')

  if (!hasSupabaseCookie && !hasValidBridgeCookie && !hasAuthHeader && !hasGravHubKey) {
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
export async function proxy(req: NextRequest): Promise<NextResponse> {
  try {
    return await proxyImpl(req)
  } catch (err) {
    console.error('[proxy] unhandled error, falling through:', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/api/:path*',
}

export default proxy
