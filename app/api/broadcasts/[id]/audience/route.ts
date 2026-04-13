import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { applyAudienceFilter } from '@/lib/broadcasts'

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

  // Build the query with filter applied
  let query = db.from('crm_contacts').select('id, emails, full_name', { count: 'exact' })
  query = applyAudienceFilter(query, broadcast.audience_filter ?? {})

  // Need non-empty email to receive
  query = query.not('emails', 'is', null)

  const { data: contacts, count, error } = await query.limit(10)
  if (error) {
    console.error('[broadcasts audience GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out contacts whose suppressed
  const emails = (contacts ?? [])
    .flatMap((c: { emails: string[] | null; full_name: string | null }) => (c.emails ?? []))
    .slice(0, 10)

  const { data: suppressed } = await db
    .from('sequence_suppression_list')
    .select('email')
    .in('email', emails.map(e => e.toLowerCase()))

  const suppressedSet = new Set((suppressed ?? []).map((s: { email: string }) => s.email))

  const totalCount = count ?? 0
  const suppressedCount = suppressedSet.size
  const estimated = Math.max(0, totalCount - suppressedCount)

  // Persist the count to the broadcast for display
  await db.from('broadcasts').update({ audience_count: estimated }).eq('id', id)

  return NextResponse.json({
    total: totalCount,
    suppressed: suppressedCount,
    estimated,
    sample: (contacts ?? []).slice(0, 10).map((c: { id: string; emails: string[] | null; full_name: string | null }) => ({
      id: c.id,
      email: c.emails?.[0] ?? '',
      name: c.full_name ?? '',
    })),
  })
}
