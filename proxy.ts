import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ── Rate limiters ────────────────────────────────────────────────────────────
// Uses Upstash Redis in production (persistent across instances).
// Falls back to in-memory when UPSTASH env vars are not set (local dev).

const isUpstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

function createLimiter(requests: number, window: string) {
  if (isUpstashConfigured) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, window as `${number} ${'s' | 'm' | 'h' | 'd'}`),
      analytics: true,
      prefix: 'gravhub',
    })
  }
  return null // fallback below
}

const adminLimiter   = createLimiter(5, '1 h')
const bookingLimiter = createLimiter(20, '1 h')
const apiLimiter     = createLimiter(200, '1 m')

// In-memory fallback for local dev (no Upstash)
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
    const { success } = await limiter.limit(key)
    return !success
  }
  return memoryLimited(key, fallbackMax, fallbackWindowMs)
}

// ── Public routes that don't require authentication ─────────────────────────
const PUBLIC_PREFIXES = [
  '/api/auth/google-verify',
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
]

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // ── CSRF protection for state-changing requests ─────────────────────────
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

  // ── Public routes: no auth required ──────────────────────────────────────
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
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

export const config = {
  matcher: '/api/:path*',
}
