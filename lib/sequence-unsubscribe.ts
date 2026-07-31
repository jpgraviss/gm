import { signToken, verifyToken } from '@/lib/signed-token'

// AUDIT #608 — POST /api/sequences/unsubscribe (the real, live unsubscribe
// link embedded in every sequence/broadcast send) previously took a raw
// {email, seq} body with zero proof the caller ever received that email —
// no signature, no token. Anyone who knew or scripted through a list of
// addresses could permanently suppress them from all future sequence and
// broadcast delivery org-wide. Every real link-building call site now goes
// through buildSequenceUnsubscribeUrl() instead of hand-assembling the query
// string, matching the signed-token convention already used for broadcast
// click tracking (lib/email-tracking.ts) and /api/unsubscribe/[token] (#327).
export interface SequenceUnsubscribeTokenPayload {
  email: string
  seq?: string
}

export function buildSequenceUnsubscribeUrl(appUrl: string, email: string, seq?: string): string {
  const token = signToken<SequenceUnsubscribeTokenPayload>({ email: email.toLowerCase(), seq })
  return `${appUrl}/api/sequences/unsubscribe?token=${token}`
}

export function verifySequenceUnsubscribeToken(token: string): SequenceUnsubscribeTokenPayload | null {
  const payload = verifyToken<SequenceUnsubscribeTokenPayload>(token)
  if (payload && payload.email) return payload
  return null
}
