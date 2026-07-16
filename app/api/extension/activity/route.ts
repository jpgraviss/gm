import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireExtensionToken, isExtensionCaller } from '@/lib/extension-auth'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * Feeds the extension popup's activity list — only the calling team
 * member's own tracked sends, most recently engaged first. The popup
 * groups these into Priority/Today/Yesterday buckets client-side from
 * lastOpenedAt/lastClickedAt, same as HubSpot's extension.
 */
export const GET = withErrorHandler('extension/activity GET', async (req) => {
  const caller = await requireExtensionToken(req)
  if (!isExtensionCaller(caller)) return caller

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const db = createServiceClient()
  const { data, error } = await db
    .from('tracked_emails')
    .select('id, recipient_email, subject, sent_at, open_count, last_opened_at, click_count, last_clicked_at, contact_id')
    .eq('team_member_id', caller.teamMemberId)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const contactIds = Array.from(new Set((data ?? []).map(d => d.contact_id).filter(Boolean))) as string[]
  const contactMap = new Map<string, string>()
  if (contactIds.length > 0) {
    const { data: contacts } = await db.from('crm_contacts').select('id, full_name').in('id', contactIds)
    for (const c of contacts ?? []) contactMap.set(c.id, c.full_name ?? '')
  }

  const items = (data ?? []).map(d => ({
    id:             d.id,
    recipientEmail: d.recipient_email,
    recipientName:  d.contact_id ? (contactMap.get(d.contact_id) ?? null) : null,
    subject:        d.subject ?? '(no subject)',
    sentAt:         d.sent_at,
    openCount:      d.open_count ?? 0,
    lastOpenedAt:   d.last_opened_at ?? null,
    clickCount:     d.click_count ?? 0,
    lastClickedAt:  d.last_clicked_at ?? null,
  }))

  return NextResponse.json(items)
})
