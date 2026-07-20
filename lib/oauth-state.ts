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

// Per-user OAuth flows (calendar) need to carry a small payload (which
// booking-page slug this connection is for) through Google's redirect,
// unlike the workspace-singleton integrations above which only need an
// opaque anti-CSRF nonce. `state` here is `<nonce>.<base64url(payload)>` —
// the nonce half is what's bound to the httpOnly cookie and verified
// (proving this callback is a continuation of a flow this server itself
// issued, in the same browser), the payload half is just along for the
// ride and is NOT itself a trust boundary — callers must still re-derive
// any identity-bearing fields (e.g. which user this connection belongs to)
// from the caller's own verified session, never from the payload, since
// nothing stops an attacker who reaches this far with a stolen/replayed
// nonce from swapping out the payload undetected.
export function issueOAuthStateWithPayload(
  provider: string,
  payload: Record<string, unknown>,
): { state: string; setCookie: (res: NextResponse) => NextResponse } {
  const nonce = crypto.randomBytes(24).toString('base64url')
  const state = `${nonce}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
  const setCookie = (res: NextResponse): NextResponse => {
    res.cookies.set(cookieName(provider), nonce, {
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

export function verifyOAuthStateWithPayload<T = Record<string, unknown>>(
  req: NextRequest,
  provider: string,
  stateParam: string | null,
): { valid: boolean; payload: T | null; clearCookie: (res: NextResponse) => NextResponse } {
  const cookieValue = req.cookies.get(cookieName(provider))?.value ?? null
  const clearCookie = (res: NextResponse): NextResponse => {
    res.cookies.set(cookieName(provider), '', { maxAge: 0, path: '/' })
    return res
  }

  if (!cookieValue || !stateParam) {
    return { valid: false, payload: null, clearCookie }
  }

  const dotIndex = stateParam.indexOf('.')
  if (dotIndex === -1) {
    return { valid: false, payload: null, clearCookie }
  }

  const nonce = stateParam.slice(0, dotIndex)
  if (nonce !== cookieValue) {
    return { valid: false, payload: null, clearCookie }
  }

  try {
    const payload = JSON.parse(Buffer.from(stateParam.slice(dotIndex + 1), 'base64url').toString('utf-8')) as T
    return { valid: true, payload, clearCookie }
  } catch {
    return { valid: false, payload: null, clearCookie }
  }
}
