/**
 * Link rewriting for per-link click tracking in broadcast emails.
 * Replaces every href in the HTML (except mailto: and # links) with a
 * tracking redirect URL that records the click before forwarding.
 */

const HREF_RE = /href="([^"]+)"/gi

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
    const token = Buffer.from(
      JSON.stringify({ broadcastId, contactId, email, url: trimmed }),
    ).toString('base64url')
    return `href="/api/track/click/${token}"`
  })
}
