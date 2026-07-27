import { SupabaseClient } from '@supabase/supabase-js'

const HREF_RE = /href="([^"]+)"/gi

/**
 * Server-side equivalent of the browser extension's injectTracking() (see
 * browser-extension/content.js) — same unsigned {trackedEmailId, url}
 * base64url token, so both funnel through the same public redirect
 * (/api/track/click/ext/[token]). Used by app/api/gmail/send/route.ts,
 * which (unlike the extension) controls the outgoing HTML directly on the
 * server and can rewrite links before the Gmail API call instead of
 * mutating Gmail's compose DOM.
 */
export function rewriteLinksForExtensionTracking(html: string, trackedEmailId: string, baseUrl: string): string {
  return html.replace(HREF_RE, (_match, url: string) => {
    const trimmed = url.trim()
    if (trimmed.startsWith('mailto:') || trimmed.startsWith('#') || trimmed.startsWith(`${baseUrl}/api/track/`)) {
      return `href="${url}"`
    }
    const token = Buffer.from(JSON.stringify({ trackedEmailId, url: trimmed })).toString('base64url')
    return `href="${baseUrl}/api/track/click/ext/${token}"`
  })
}

/** Same 1x1 tracking pixel the extension injects into the compose body — see browser-extension/content.js's injectTracking(). */
export function trackingPixelTag(trackedEmailId: string, baseUrl: string): string {
  return `<img src="${baseUrl}/api/track/open/${trackedEmailId}" width="1" height="1" alt="" style="display:none !important;width:1px;height:1px;border:0;" />`
}

/**
 * Mirrors a Gmail-extension tracked-email open/click onto the CRM contact's
 * activity timeline — same integration point sequence/broadcast tracking
 * already writes to, so all three tracking sources show up in one place on
 * the contact record regardless of which channel actually sent the email.
 */
export async function mirrorTrackedEmailActivity(
  db: SupabaseClient,
  trackedEmail: { id: string; contact_id: string | null; company_id: string | null; recipient_email: string; subject: string | null; team_member_id: string },
  title: string,
): Promise<void> {
  if (!trackedEmail.contact_id) return

  const [{ data: contactRow }, { data: memberRow }] = await Promise.all([
    db.from('crm_contacts').select('full_name').eq('id', trackedEmail.contact_id).maybeSingle(),
    db.from('team_members').select('name').eq('id', trackedEmail.team_member_id).maybeSingle(),
  ])

  await db.from('crm_activities').insert({
    id: `act-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'email',
    title,
    company_id: trackedEmail.company_id,
    contact_id: trackedEmail.contact_id,
    contact_name: contactRow?.full_name ?? null,
    user_name: memberRow?.name ?? 'System',
    timestamp: new Date().toISOString(),
  })
}
