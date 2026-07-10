import { NextRequest } from 'next/server'
import * as crypto from 'crypto'

/**
 * Verifies a Resend webhook signature. Resend signs webhooks via Svix
 * (svix-id/svix-timestamp/svix-signature headers); some setups instead send
 * a simpler resend-signature HMAC header, so both are checked.
 */
export function verifyResendSignature(body: string, req: NextRequest, secret: string): boolean {
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (svixId && svixTimestamp && svixSignature) {
    const signedContent = `${svixId}.${svixTimestamp}.${body}`
    const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    const signatures = svixSignature.split(' ')
    for (const sig of signatures) {
      const sigValue = sig.startsWith('v1,') ? sig.slice(3) : sig
      try {
        if (crypto.timingSafeEqual(Buffer.from(sigValue), Buffer.from(expectedSignature))) {
          return true
        }
      } catch {
        // Length mismatch — try the next signature
      }
    }
    return false
  }

  const resendSig = req.headers.get('resend-signature')
  if (resendSig) {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(resendSig), Buffer.from(expected))
    } catch {
      return false
    }
  }

  return false
}
