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
      Don't want these updates? <a href="${unsubscribeUrl}" style="color:#015035;text-decoration:underline;">Unsubscribe</a>
    </p>
  </td></tr>
</table>`
}
