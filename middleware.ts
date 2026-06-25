import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/forms/public/',
  '/api/sequences/webhooks',
  '/api/sequences/unsubscribe',
  '/api/unsubscribe/',
  '/api/track/',
  '/api/portal-clients/magic-link',
  '/api/portal-clients/verify-code',
  '/api/portal-clients/reset-password',
  '/api/portal-clients/check-approval',
  '/api/portal-clients/complete-setup',
  '/api/calendar/callback',
  '/api/calendar/feed/',
  '/api/calendar/slots',
  '/api/drive/callback',
  '/api/chatbots/',
  '/api/push/subscribe',
  '/api/signatures/',
  '/api/bookings',
  '/api/portal/',
]

const PUBLIC_GET_ONLY = [
  '/api/settings',
  '/api/dashboard',
  '/api/search',
]

function isPublicRoute(pathname: string, method: string): boolean {
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) return true
  if (method === 'GET' && PUBLIC_GET_ONLY.some(p => pathname.startsWith(p))) return true
  return false
}

function hasAuthCredentials(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return true

  const hasSbCookie = req.cookies.getAll().some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (hasSbCookie) return true

  if (req.cookies.has('gravhub-auth')) return true

  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()

  if (isPublicRoute(pathname, req.method)) return NextResponse.next()

  if (!hasAuthCredentials(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
