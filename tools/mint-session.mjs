/**
 * Mints a `gravhub-auth` cookie for the seeded admin, so a browser can drive
 * the authenticated app. Signs with the same HMAC scheme as
 * lib/session-cookie.ts, reading SESSION_SIGNING_KEY from the environment so
 * it always matches whatever the server under test is using.
 *
 * Prints the cookie value on stdout.
 */
const KEY = process.env.SESSION_SIGNING_KEY || 'gravhub-dev-session-key-insecure'

const b64url = bytes => Buffer.from(bytes).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const now = Math.floor(Date.now() / 1000)
const body = {
  id: 'tm-jonathan',
  email: 'jonathangraviss@gmail.com',
  role: 'Owner',
  isAdmin: true,
  userType: 'staff',
  iat: now,
  exp: now + 60 * 60 * 24,
}

const enc = new TextEncoder()
const bodyB64 = b64url(enc.encode(JSON.stringify(body)))
const key = await crypto.subtle.importKey('raw', enc.encode(KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
const sig = await crypto.subtle.sign('HMAC', key, enc.encode(bodyB64))
process.stdout.write(`${bodyB64}.${b64url(new Uint8Array(sig))}`)
