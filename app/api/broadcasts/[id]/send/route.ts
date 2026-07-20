import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { sendEmail } from '@/lib/email'
import { applyAudienceFilter, renderMergeFields, wrapWithFooter, resolveEngagementFilters } from '@/lib/broadcasts'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

const CHUNK_SIZE = 50 // Resend allows batches — we throttle to 50 per batch

/**
 * Send a broadcast to its audience. Paginated through the matched contacts,
 * individual email sends (not Resend Broadcasts API — we want per-contact
 * merge fields + suppression checks).
 */
export const POST = withErrorHandler('broadcasts/[id]/send POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()

  const { data: broadcast } = await db
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .single()

  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
  if (broadcast.status === 'sent' || broadcast.status === 'sending') {
    return NextResponse.json({ error: `Broadcast is already ${broadcast.status}` }, { status: 400 })
  }

  // Mark as sending
  await db.from('broadcasts').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', id)

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

  // hasOpenedPrevious/hasClickedPrevious/excludeRecentRecipientsDays can't be
  // expressed as a column filter — apply the same lookup-based logic the
  // audience-preview endpoint uses, or a broadcast configured to skip
  // recently-emailed contacts would silently send to the full list anyway.
  const { includeContactIds, excludeContactIds } = await resolveEngagementFilters(db, audienceFilter)
  const contacts = (rawContacts ?? []).filter((c: { id: string }) => {
    if (includeContactIds !== null && !includeContactIds.has(c.id)) return false
    if (excludeContactIds.has(c.id)) return false
    return true
  })

  // Suppression list
  const allEmails = (contacts ?? [])
    .flatMap((c: { emails: string[] | null }) => (c.emails ?? []))
    .map(e => e.toLowerCase())
  const { data: suppressedRows } = await db
    .from('sequence_suppression_list')
    .select('email')
    .in('email', allEmails)
  const suppressedSet = new Set((suppressedRows ?? []).map((s: { email: string }) => s.email))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  let sent = 0
  let skipped = 0
  let failed = 0

  // Chunk the sends so we don't overwhelm the API
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

  // Final status
  await db
    .from('broadcasts')
    .update({
      status: 'sent',
      total_sent: sent,
    })
    .eq('id', id)

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'broadcast_sent',
    module: 'email_marketing',
    type: 'warning',
    metadata: { broadcastId: id, sent, skipped, failed, total: contactList.length },
  })

  return NextResponse.json({ sent, skipped, failed, total: contactList.length })
})
