/**
 * Broadcast audience filter — a simple field/operator/value grammar for
 * segmenting CRM contacts. Translated into a Supabase query at send time.
 */

export interface AudienceFilter {
  lifecycleStage?: string
  tags?: string[]
  owner?: string
  hasEmail?: boolean
  companyStatus?: string
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
