import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { applyAudienceFilter } from '@/lib/broadcasts'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * Preview audience — returns count + sample emails for the current
 * broadcast's audience filter.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data: broadcast } = await db
    .from('broadcasts')
    .select('audience_filter')
    .eq('id', id)
    .single()

  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })

  const filter = broadcast.audience_filter ?? {}

  // Build engagement exclusion sets before the main query
  let engagementContactIds: Set<string> | null = null

  if (filter.hasOpenedPrevious || filter.hasClickedPrevious) {
    const conditions: string[] = []
    if (filter.hasOpenedPrevious) conditions.push('opened_at')
    if (filter.hasClickedPrevious) conditions.push('clicked_at')

    let recipientQuery = db.from('broadcast_recipients').select('contact_id')
    if (conditions.length === 1) {
      recipientQuery = recipientQuery.not(conditions[0], 'is', null)
    } else {
      recipientQuery = recipientQuery.or(conditions.map(c => `${c}.not.is.null`).join(','))
    }

    const { data: engaged } = await recipientQuery
    engagementContactIds = new Set(
      (engaged ?? []).map((r: { contact_id: string | null }) => r.contact_id).filter(Boolean) as string[]
    )
  }

  let excludeRecentContactIds: Set<string> | null = null

  if (filter.excludeRecentRecipientsDays && filter.excludeRecentRecipientsDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.excludeRecentRecipientsDays)
    const { data: recentRecipients } = await db
      .from('broadcast_recipients')
      .select('contact_id')
      .gte('sent_at', cutoff.toISOString())

    excludeRecentContactIds = new Set(
      (recentRecipients ?? []).map((r: { contact_id: string | null }) => r.contact_id).filter(Boolean) as string[]
    )
  }

  // Build the query with filter applied
  let query = db.from('crm_contacts').select('id, emails, full_name', { count: 'exact' })
  query = applyAudienceFilter(query, filter)

  // Need non-empty email to receive
  query = query.not('emails', 'is', null)

  // Apply engagement filter (include only contacts who engaged)
  if (engagementContactIds !== null) {
    const ids = Array.from(engagementContactIds)
    if (ids.length > 0) {
      query = query.in('id', ids)
    } else {
      return NextResponse.json({ total: 0, suppressed: 0, estimated: 0, sample: [] })
    }
  }

  const { data: contacts, count, error } = await query.limit(100)
  if (error) {
    console.error('[broadcasts audience GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out recently-contacted contacts client-side
  let filteredContacts = contacts ?? []
  if (excludeRecentContactIds !== null && excludeRecentContactIds.size > 0) {
    filteredContacts = filteredContacts.filter(
      (c: { id: string }) => !excludeRecentContactIds!.has(c.id)
    )
  }

  // Filter out contacts who are suppressed
  const emails = filteredContacts
    .flatMap((c: { emails: string[] | null; full_name: string | null }) => (c.emails ?? []))
    .slice(0, 10)

  const { data: suppressed } = await db
    .from('sequence_suppression_list')
    .select('email')
    .in('email', emails.map(e => e.toLowerCase()))

  const suppressedSet = new Set((suppressed ?? []).map((s: { email: string }) => s.email))

  const totalCount = count ?? 0
  const recentExcluded = excludeRecentContactIds ? excludeRecentContactIds.size : 0
  const suppressedCount = suppressedSet.size
  const estimated = Math.max(0, totalCount - recentExcluded - suppressedCount)

  // Persist the count to the broadcast for display
  await db.from('broadcasts').update({ audience_count: estimated }).eq('id', id)

  return NextResponse.json({
    total: totalCount,
    suppressed: suppressedCount,
    estimated,
    sample: filteredContacts.slice(0, 10).map((c: { id: string; emails: string[] | null; full_name: string | null }) => ({
      id: c.id,
      email: c.emails?.[0] ?? '',
      name: c.full_name ?? '',
    })),
  })
}
