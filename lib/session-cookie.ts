// Signed, tamper-proof replacement for the old `gravhub-auth=1` static flag
// cookie. The old cookie's mere presence (any value) was treated as proof of
// authentication — anyone could forge it with `Cookie: gravhub-auth=1`. This
// module signs the cookie's payload with an HMAC so the server can verify it
// actually came from a real login, not just check that a cookie exists.
//
// Uses Web Crypto (`crypto.subtle`) instead of Node's `crypto` module so the
// same code works in `proxy.ts`, which may run on the Edge runtime.

export const SESSION_COOKIE_NAME = 'gravhub-auth'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days — matches the old cookie's lifetime

export interface SessionPayload {
  id: string
  email: string
  role: string
  isAdmin: boolean
  userType: 'staff' | 'client'
}

interface SignedBody extends SessionPayload {
  iat: number
  exp: number
}

function getKeyMaterial(): string {
  const key = process.env.SESSION_SIGNING_KEY
  if (key) return key
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SIGNING_KEY must be set in production')
  }
  console.warn('[session-cookie] SESSION_SIGNING_KEY not set — using insecure dev fallback')
  return 'gravhub-dev-session-key-insecure'
}

async function getHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getKeyMaterial()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let str = ''
  for (const b of arr) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  const bin = atob(padded)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export async function signSessionCookie(payload: SessionPayload, maxAgeSeconds: number = MAX_AGE_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const body: SignedBody = { ...payload, iat: now, exp: now + maxAgeSeconds }
  const encoder = new TextEncoder()
  const bodyB64 = base64UrlEncode(encoder.encode(JSON.stringify(body)))
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyB64))
  return `${bodyB64}.${base64UrlEncode(sig)}`
}

export async function verifySessionCookie(value: string | undefined | null): Promise<SessionPayload | null> {
  if (!value) return null
  const parts = value.split('.')
  if (parts.length !== 2) return null
  const [bodyB64, sigB64] = parts

  try {
    const key = await getHmacKey()
    const encoder = new TextEncoder()
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sigB64) as BufferSource, encoder.encode(bodyB64))
    if (!valid) return null

    const body = JSON.parse(new TextDecoder().decode(base64UrlDecode(bodyB64))) as SignedBody
    if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return null
    if (!body.email) return null

    return body
  } catch {
    return null
  }
}

// AUDIT.md #207 — `maxAgeSeconds` lets callers apply the configured
// Session Timeout security setting instead of always getting the fixed
// 7-day default. Optional and defaulted so this stays edge-runtime-safe
// (no DB dependency in this file itself) — callers that need the real
// configured value fetch it themselves via getSecuritySettings() and pass
// it in; callers that don't care keep the old fixed-lifetime behavior.
export async function buildSessionCookie(payload: SessionPayload, maxAgeSeconds: number = MAX_AGE_SECONDS) {
  return {
    name: SESSION_COOKIE_NAME,
    value: await signSessionCookie(payload, maxAgeSeconds),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

// AUDIT.md #207 — translates the Security Settings "Session Timeout"
// dropdown value into seconds. 'never' maps to the same 7-day default this
// cookie always used before this setting had any real effect, not a
// literal infinite cookie.
export function sessionTimeoutToSeconds(timeout: '1h' | '4h' | '8h' | '24h' | 'never'): number {
  switch (timeout) {
    case '1h': return 60 * 60
    case '4h': return 60 * 60 * 4
    case '8h': return 60 * 60 * 8
    case '24h': return 60 * 60 * 24
    case 'never':
    default: return MAX_AGE_SECONDS
  }
}
