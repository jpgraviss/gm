/**
 * Link rewriting for per-link click tracking in broadcast emails.
 * Replaces every href in the HTML (except mailto: and # links) with a
 * tracking redirect URL that records the click before forwarding.
 */

import { signToken } from './signed-token'

const HREF_RE = /href="([^"]+)"/gi

export interface ClickTokenPayload {
  broadcastId: string
  contactId: string
  email: string
  url: string
}

export function rewriteLinksForTracking(
  html: string,
  broadcastId: string,
  contactId: string,
  email: string,
): string {
  return html.replace(HREF_RE, (_match, url: string) => {
    const trimmed = url.trim()
    if (trimmed.startsWith('mailto:') || trimmed.startsWith('#')) {
      return `href="${url}"`
    }
    // AUDIT — signed so the click endpoint can verify the token was really
    // issued by this send, not forged/altered by a recipient (previously
    // plain unsigned base64 JSON — anyone could decode or fabricate one).
    const token = signToken<ClickTokenPayload>({ broadcastId, contactId, email, url: trimmed })
    return `href="/api/track/click/${token}"`
  })
}
