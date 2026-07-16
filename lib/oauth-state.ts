import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

// These integrations (Google Marketing, LinkedIn, Meta, Drive) are
// workspace-wide singletons — one connection per product, not per-user —
// and their callback routes previously never validated the OAuth `state`
// param at all (it was generated and sent, but nothing checked it came
// back unchanged from the same flow). That let an attacker complete their
// own OAuth consent, capture the resulting code/state redirect URL, and
// get a logged-in staff member to open it, silently swapping the org's
// integration to the attacker's account. Binding state to a short-lived,
// httpOnly cookie set at connect-time and compared at callback-time closes
// that: the callback only succeeds in the same browser that started it.

const STATE_COOKIE_MAX_AGE = 600 // seconds — long enough for a consent screen, short enough to limit replay window

function cookieName(provider: string): string {
  return `oauth_state_${provider}`
}

export function issueOAuthState(provider: string): { state: string; setCookie: (res: NextResponse) => NextResponse } {
  const state = crypto.randomBytes(24).toString('base64url')
  const setCookie = (res: NextResponse): NextResponse => {
    res.cookies.set(cookieName(provider), state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE,
      path: '/',
    })
    return res
  }
  return { state, setCookie }
}

export function verifyOAuthState(
  req: NextRequest,
  provider: string,
  stateParam: string | null,
): { valid: boolean; clearCookie: (res: NextResponse) => NextResponse } {
  const cookieValue = req.cookies.get(cookieName(provider))?.value ?? null
  const valid = !!cookieValue && !!stateParam && cookieValue === stateParam
  const clearCookie = (res: NextResponse): NextResponse => {
    res.cookies.set(cookieName(provider), '', { maxAge: 0, path: '/' })
    return res
  }
  return { valid, clearCookie }
}
