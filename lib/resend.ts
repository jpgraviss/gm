import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Lazily instantiate the Resend client. Throws only when actually used without
 * a configured API key, so build-time and unrelated routes don't crash.
 */
export function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    client = new Resend(key)
  }
  return client
}
