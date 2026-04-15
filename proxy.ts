import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ── Rate limiters ────────────────────────────────────────────────────────────
// Uses Upstash Redis when env vars are valid. Falls back to in-memory if
// Upstash init throws (bad URL, malformed token, edge runtime issue).
//
// CRITICAL: every line below is wrapped in try/catch because an unhandled
// throw at module load makes the entire proxy crash with
// MIDDLEWARE_INVOCATION_FAILED, breaking EVERY request to the app.

const isUpstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

function createLimiter(requests: number, window: string): Ratelimit | null {
  if (!isUpstashConfigured) return null
  try {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, window as `${number} ${'s' | 'm' | 'h' | 'd'}`),
      analytics: false, // disable analytics (saves Redis commands)
      prefix: 'gravhub',
    })
  } catch (err) {
    // Upstash init failed (invalid URL, edge runtime issue, etc.) —
    // fall back to in-memory limiting silently. Don't crash the proxy.
    console.error('[proxy] Upstash init failed, falling back to memory:', err)
    return null
  }
}

let adminLimiter:   Ratelimit | null = null
let bookingLimiter: Ratelimit | null = null
let apiLimiter:     Ratelimit | null = null
try {
  adminLimiter   = createLimiter(5, '1 h')
  bookingLimiter = createLimiter(20, '1 h')
  apiLimiter     = createLimiter(200, '1 m')
} catch (err) {
  console.error('[proxy] limiter setup failed:', err)
}

// In-memory fallback for local dev (no Upstash) and for when Upstash init fails
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

async function isRateLimited(limiter: Ratelimit | null, key: string, fallbackMax: number, fallbackWindowMs: number): Promise<boolean> {
  if (limiter) {
    try {
      const { success } = await limiter.limit(key)
      return !success
    } catch (err) {
      // Upstash call failed at runtime — fall through to memory limiter
      console.error('[proxy] limiter.limit failed, falling back to memory:', err)
      return memoryLimited(key, fallbackMax, fallbackWindowMs)
    }
  }
  return memoryLimited(key, fallbackMax, fallbackWindowMs)
}

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_PREFIXES = [
  '/api/auth/google-verify',
  '/api/auth/health',            // Diagnostic endpoint — masked env var view
  '/api/calendar/settings/',
  '/api/calendar/slots',
  '/api/calendar/callback',
  '/api/bookings',
  '/api/portal-clients/reset-password',
  '/api/quickbooks/callback',
  '/api/drive/callback',
  '/api/auth/auto-provision',
  '/api/auth/profile',
  '/api/auth/verify-email',
  '/api/signatures/',
  '/api/email/sign-request',
  '/api/forms/public/',          // Public form embed endpoints
  '/api/sequences/webhooks',     // Resend webhook
  '/api/sequences/unsubscribe',
  '/api/portal/insights',        // Portal client read-only insights
]

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

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
    // Rate-limit public booking creation (20 per hour per IP)
    if (pathname.startsWith('/api/bookings') && req.method === 'POST') {
      const ip = getClientIp(req)
      if (await isRateLimited(bookingLimiter, `booking:${ip}`, 20, 60 * 60 * 1000)) {
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
  if (await isRateLimited(apiLimiter, `api:${ip}`, 200, 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

/**
 * Public proxy entry point. Wraps proxyImpl in a try/catch so any
 * unhandled error returns NextResponse.next() instead of crashing
 * with MIDDLEWARE_INVOCATION_FAILED. The proxy MUST never block the
 * entire site — security checks fail open to a 401 from the route
 * itself, never to a 500 here.
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
