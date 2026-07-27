/**
 * Broadcast audience filter — a simple field/operator/value grammar for
 * segmenting CRM contacts. Translated into a Supabase query at send time.
 */

import { sendEmail } from '@/lib/email'

export interface AudienceFilter {
  lifecycleStage?: string
  tags?: string[]
  owner?: string
  createdAfter?: string
  createdBefore?: string
  lastActivityAfter?: string
  lastActivityBefore?: string
  hasOpenedPrevious?: boolean
  hasClickedPrevious?: boolean
  neverContacted?: boolean
  industry?: string
  companySize?: string
  excludeTags?: string[]
  excludeRecentRecipientsDays?: number
}

export interface Broadcast {
  id: string
  name: string
  subject: string
  fromName: string
  fromEmail: string
  replyTo?: string
  htmlBody: string
  plainBody?: string
  previewText?: string
  audienceFilter: AudienceFilter
  audienceCount: number
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduledAt?: string
  sentAt?: string
  resendId?: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalUnsubscribed: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * Apply audience filter to the crm_contacts table query.
 * Returns the Supabase query builder, ready to await.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAudienceFilter(query: any, filter: AudienceFilter): any {
  let q = query
  if (filter.lifecycleStage) q = q.eq('lifecycle_stage', filter.lifecycleStage)
  if (filter.owner) q = q.eq('owner', filter.owner)
  if (filter.tags && filter.tags.length > 0) q = q.contains('tags', filter.tags)
  if (filter.createdAfter) q = q.gte('created_date', filter.createdAfter)
  if (filter.createdBefore) q = q.lte('created_date', filter.createdBefore)
  if (filter.lastActivityAfter) q = q.gte('last_activity', filter.lastActivityAfter)
  if (filter.lastActivityBefore) q = q.lte('last_activity', filter.lastActivityBefore)
  if (filter.neverContacted) q = q.is('last_activity', null)
  if (filter.industry) q = q.eq('industry', filter.industry)
  if (filter.companySize) q = q.eq('company_size', filter.companySize)
  if (filter.excludeTags && filter.excludeTags.length > 0) {
    for (const tag of filter.excludeTags) {
      q = q.not('tags', 'cs', `{${tag}}`)
    }
  }
  return q
}

/**
 * Resolve the `hasOpenedPrevious`/`hasClickedPrevious`/
 * `excludeRecentRecipientsDays` audience filters, which can't be expressed
 * as a simple column filter on crm_contacts — they require a lookup against
 * broadcast_recipients first. Shared by the audience-preview endpoint and
 * the real send route so the two can never drift out of sync again (send
 * previously ignored all three, silently mailing an unfiltered list while
 * the preview count looked correctly narrowed).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveEngagementFilters(db: any, filter: AudienceFilter): Promise<{
  includeContactIds: Set<string> | null
  excludeContactIds: Set<string>
}> {
  let includeContactIds: Set<string> | null = null

  if (filter.hasOpenedPrevious || filter.hasClickedPrevious) {
    const conditions: string[] = []
    if (filter.hasOpenedPrevious) conditions.push('opened_at')
    if (filter.hasClickedPrevious) conditions.push('clicked_at')

    let recipientQuery = db.from('broadcast_recipients').select('contact_id')
    recipientQuery = conditions.length === 1
      ? recipientQuery.not(conditions[0], 'is', null)
      : recipientQuery.or(conditions.map(c => `${c}.not.is.null`).join(','))

    const { data: engaged } = await recipientQuery
    includeContactIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (engaged ?? []).map((r: any) => r.contact_id).filter(Boolean) as string[]
    )
  }

  let excludeContactIds = new Set<string>()

  if (filter.excludeRecentRecipientsDays && filter.excludeRecentRecipientsDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.excludeRecentRecipientsDays)
    const { data: recentRecipients } = await db
      .from('broadcast_recipients')
      .select('contact_id')
      .gte('sent_at', cutoff.toISOString())

    excludeContactIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recentRecipients ?? []).map((r: any) => r.contact_id).filter(Boolean) as string[]
    )
  }

  return { includeContactIds, excludeContactIds }
}

/**
 * Replace merge tags in the HTML body with recipient data.
 * Supports: {{first_name}}, {{last_name}}, {{full_name}}, {{company}}
 */
export function renderMergeFields(
  html: string,
  contact: { firstName?: string; lastName?: string; fullName?: string; companyName?: string },
): string {
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, contact.firstName ?? '')
    .replace(/\{\{\s*last_name\s*\}\}/gi, contact.lastName ?? '')
    .replace(/\{\{\s*full_name\s*\}\}/gi, contact.fullName ?? contact.firstName ?? '')
    .replace(/\{\{\s*company\s*\}\}/gi, contact.companyName ?? '')
}

/**
 * Wrap the broadcast HTML with a footer that includes the unsubscribe link.
 * The link points at the existing /api/sequences/unsubscribe endpoint which
 * handles both sequences and broadcasts (any mass send is suppressible).
 */
export function wrapWithFooter(html: string, unsubscribeUrl: string, footerNote = ''): string {
  return `${html}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
      ${footerNote ? `${footerNote}<br/>` : ''}
      Don't want these updates? <a href="${unsubscribeUrl}" style="color:#015035;text-decoration:underline;">Unsubscribe</a> · <a href="/privacy" style="color:#9ca3af;text-decoration:underline;font-size:10px;">Privacy Policy</a>
      <br/><span style="font-size:10px;color:#9ca3af;">Graviss Marketing · 4235 Hillsboro Pike, Nashville, TN 37215</span>
    </p>
  </td></tr>
</table>`
}

const CHUNK_SIZE = 50 // Resend allows batches — we throttle to 50 per batch

/**
 * Send a broadcast to its matched audience. Extracted from the manual-send
 * route so a cron-triggered scheduled dispatch (see app/api/cron/route.ts)
 * can reuse the exact same sending logic instead of duplicating it —
 * matches the dispatchReviewCampaign() shared-function pattern. Assumes
 * the caller has already validated the broadcast is sendable and claimed
 * it (status transitioned away from its prior state) to prevent a double
 * send.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendBroadcastNow(db: any, broadcast: any): Promise<{ sent: number; skipped: number; failed: number; total: number }> {
  const id = broadcast.id

  // Fetch all contacts matching the audience filter
  const audienceFilter = broadcast.audience_filter ?? {}
  let query = db
    .from('crm_contacts')
    .select('id, first_name, last_name, full_name, emails, company_name')
    .not('emails', 'is', null)
  query = applyAudienceFilter(query, audienceFilter)

  const { data: rawContacts, error: contactErr } = await query
  if (contactErr) {
    await db.from('broadcasts').update({ status: 'failed' }).eq('id', id)
    throw new Error(contactErr.message)
  }

  const { includeContactIds, excludeContactIds } = await resolveEngagementFilters(db, audienceFilter)
  const contacts = (rawContacts ?? []).filter((c: { id: string }) => {
    if (includeContactIds !== null && !includeContactIds.has(c.id)) return false
    if (excludeContactIds.has(c.id)) return false
    return true
  })

  // Suppression list
  const allEmails = (contacts ?? [])
    .flatMap((c: { emails: string[] | null }) => (c.emails ?? []))
    .map((e: string) => e.toLowerCase())
  const { data: suppressedRows } = await db
    .from('sequence_suppression_list')
    .select('email')
    .in('email', allEmails)
  const suppressedSet = new Set((suppressedRows ?? []).map((s: { email: string }) => s.email))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  let sent = 0
  let skipped = 0
  let failed = 0

  type ContactRow = { id: string; first_name: string | null; last_name: string | null; full_name: string | null; emails: string[] | null; company_name: string | null }
  const contactList = (contacts ?? []) as ContactRow[]
  for (let i = 0; i < contactList.length; i += CHUNK_SIZE) {
    const chunk = contactList.slice(i, i + CHUNK_SIZE)
    await Promise.all(
      chunk.map(async (contact) => {
        const email = contact.emails?.[0]?.toLowerCase()
        if (!email || suppressedSet.has(email)) {
          skipped++
          return
        }

        const renderedHtml = renderMergeFields(broadcast.html_body ?? '', {
          firstName:   contact.first_name ?? undefined,
          lastName:    contact.last_name ?? undefined,
          fullName:    contact.full_name ?? undefined,
          companyName: contact.company_name ?? undefined,
        })
        const unsubUrl = `${appUrl}/api/sequences/unsubscribe?email=${encodeURIComponent(email)}`
        const finalHtml = wrapWithFooter(renderedHtml, unsubUrl, `Graviss Marketing`)

        const recipientId = `br-${id}-${contact.id}`

        try {
          const sendResult = await sendEmail({
            to: email,
            from: `${broadcast.from_name} <${broadcast.from_email}>`,
            replyTo: broadcast.reply_to ?? undefined,
            subject: broadcast.subject,
            html: finalHtml,
            headers: {
              'X-Broadcast-Id':   id,
              'X-Recipient-Id':   recipientId,
              'List-Unsubscribe': `<${unsubUrl}>`,
            },
          })

          if (!sendResult.success) {
            failed++
            await db.from('broadcast_recipients').insert({
              id: recipientId,
              broadcast_id: id,
              contact_id: contact.id,
              email,
              status: 'failed',
            })
          } else {
            sent++
            await db.from('broadcast_recipients').insert({
              id: recipientId,
              broadcast_id: id,
              contact_id: contact.id,
              email,
              status: 'sent',
              sent_at: new Date().toISOString(),
              resend_message_id: sendResult.id ?? null,
            })
          }
        } catch (err) {
          failed++
          console.error('[broadcast send] error', err)
        }
      }),
    )
  }

  await db
    .from('broadcasts')
    .update({ status: 'sent', total_sent: sent })
    .eq('id', id)

  return { sent, skipped, failed, total: contactList.length }
}
