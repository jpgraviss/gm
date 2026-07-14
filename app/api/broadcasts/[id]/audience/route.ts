import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { applyAudienceFilter, resolveEngagementFilters } from '@/lib/broadcasts'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * Preview audience — returns count + sample emails for the current
 * broadcast's audience filter.
 */
export const GET = withErrorHandler('broadcasts/[id]/audience GET', async (_req, { params }: { params: Promise<{ id: string }> }) => {
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
  const { includeContactIds: engagementContactIds, excludeContactIds: excludeRecentContactIds } =
    await resolveEngagementFilters(db, filter)

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
    throw new Error(error.message)
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
})
