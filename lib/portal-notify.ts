import { createServiceClient } from './supabase'
import { sendEmail } from './email'
import { wrapBrandedEmail } from './email-template'
import { getSettings } from './settings'

// AUDIT — title/message are interpolated straight into an HTML email body
// below with zero escaping, unlike the established convention elsewhere in
// this codebase (lib/rank-tracker.ts, lib/review-campaigns.ts). The only
// caller in this file's scope, PATCH /api/tickets/[id], builds `title` from
// a ticket's own subject — and app/api/tickets/from-email/route.ts sets
// that verbatim from a raw inbound email's Subject header with no
// sanitization, so this was reachable by anyone who emails a monitored
// support inbox with HTML in the subject line.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function notifyPortalClient(
  portalClientId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
) {
  const db = createServiceClient()
  const id = `pn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // Insert notification
  await db.from('portal_notifications').insert({
    id, portal_client_id: portalClientId, type, title, message, link,
  })

  // Get client email for sending notification email
  const { data: client } = await db.from('portal_clients')
    .select('email, contact, company')
    .eq('id', portalClientId)
    .single()

  if (!client?.email) return

  // Send email directly via lib/email — this previously round-tripped
  // through POST /api/email/portal-notification, but that route is gated by
  // requireAdmin() (a real session cookie / Supabase bearer token), which a
  // bare server-to-server fetch() from here can never supply (no req to
  // forward credentials from, and nothing else ever called that route). The
  // email half of this function was therefore silent dead code from the
  // moment it was written — every call 401'd inside the try/catch below and
  // was swallowed. Sending directly matches the pattern already used by
  // lib/automations-engine.ts (sendEmail + wrapBrandedEmail) and actually
  // works.
  try {
    const settings = await getSettings()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const portalLink = link ? `${appUrl}${link.startsWith('/') ? link : `/${link}`}` : `${appUrl}/client`
    const clientName = escapeHtml(client.contact || client.company || 'there')
    const safeTitle = escapeHtml(title)
    const safeMessage = message ? escapeHtml(message) : ''
    const body = `
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:700;">Hi ${clientName},</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">You have a new update from ${settings.company.name}.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827;">${safeTitle}</h3>
          ${safeMessage ? `<p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">${safeMessage}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:0;"><a href="${portalLink}" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">View in Portal &rarr;</a></p>
    `
    const html = await wrapBrandedEmail(body, 'CLIENT NOTIFICATION')
    // Email subject lines aren't HTML-rendered — the raw (unescaped) title
    // is correct there, same as every other sendEmail() call in this repo.
    const result = await sendEmail({ to: client.email, subject: title, html })
    if (!result.success) {
      console.error('[portal-notify] email failed:', result.error)
    }
  } catch (err) {
    console.error('[portal-notify] email failed:', err)
  }
}
