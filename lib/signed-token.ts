import crypto from 'crypto'

// Shared HMAC-signing helper for short-lived, self-contained tokens embedded
// in public URLs (click-tracking redirects, unsubscribe links). Before this,
// several call sites minted `base64url(JSON.stringify(payload))` with no
// signature — anyone could decode one to read its fields, or construct a
// new one with arbitrary fields (forged contactId/email/url) since nothing
// server-side ever verified the token was actually issued by GravHub.
//
// Reuses TOKEN_ENCRYPTION_KEY (already required in production, already set
// in Vercel) rather than introducing a new env var — derived through a
// distinct hash label so the signing key isn't literally the same bytes as
// the AES key in lib/encryption.ts.

function getSigningKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY must be set in production')
    }
    console.warn('[signed-token] TOKEN_ENCRYPTION_KEY not set — using insecure dev fallback')
    return crypto.createHash('sha256').update('gravhub-dev-key|signed-token').digest()
  }
  return crypto.createHash('sha256').update(`${key}|signed-token`).digest()
}

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64url')
}

export function signToken<T extends object>(payload: T): string {
  const bodyB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = crypto.createHmac('sha256', getSigningKey()).update(bodyB64).digest()
  return `${bodyB64}.${base64UrlEncode(sig)}`
}

export function verifyToken<T>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [bodyB64, sigB64] = parts

  try {
    const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(bodyB64).digest()
    const actualSig = Buffer.from(sigB64, 'base64url')
    if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
      return null
    }
    return JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
