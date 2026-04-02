import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sequenceId = req.nextUrl.searchParams.get('sequenceId')

  const db = createServiceClient()

  // Fetch enrollments — optionally filtered by sequence
  let enrollQuery = db
    .from('sequence_enrollments')
    .select('sequence_id, contact_email, enrolled_at')

  if (sequenceId) {
    enrollQuery = enrollQuery.eq('sequence_id', sequenceId)
  }

  const { data: enrollments, error: enrollErr } = await enrollQuery

  if (enrollErr) {
    return NextResponse.json({ error: enrollErr.message }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ totalRevenue: 0, totalDeals: 0, sequences: [] })
  }

  // Collect unique contact emails and map email -> sequence enrollments
  const emailSet = new Set<string>()
  const emailToSequences = new Map<string, Set<string>>()
  const enrollmentDates = new Map<string, string>() // email|seqId -> enrolled_at

  for (const enr of enrollments) {
    if (!enr.contact_email) continue
    emailSet.add(enr.contact_email)

    if (!emailToSequences.has(enr.contact_email)) {
      emailToSequences.set(enr.contact_email, new Set())
    }
    emailToSequences.get(enr.contact_email)!.add(enr.sequence_id)

    const key = `${enr.contact_email}|${enr.sequence_id}`
    enrollmentDates.set(key, enr.enrolled_at)
  }

  const emails = Array.from(emailSet)
  if (emails.length === 0) {
    return NextResponse.json({ totalRevenue: 0, totalDeals: 0, sequences: [] })
  }

  // Fetch closed-won deals where any contact email matches an enrolled contact
  const { data: deals, error: dealErr } = await db
    .from('deals')
    .select('id, value, contact_email, closed_at')
    .eq('stage', 'Closed Won')
    .in('contact_email', emails)

  if (dealErr) {
    return NextResponse.json({ error: dealErr.message }, { status: 500 })
  }

  // Fetch sequence names for labeling
  const seqIds = new Set<string>()
  emailToSequences.forEach((seqs) => {
    seqs.forEach((s) => seqIds.add(s))
  })

  const { data: sequences } = await db
    .from('sequences')
    .select('id, name')
    .in('id', Array.from(seqIds))

  const seqNameMap = new Map<string, string>()
  for (const s of sequences ?? []) {
    seqNameMap.set(s.id, s.name)
  }

  // Attribute deals to sequences (contact enrolled before deal closed)
  const seqRevenue = new Map<string, { revenue: number; deals: number }>()
  let totalRevenue = 0
  let totalDeals = 0
  const countedDealIds = new Set<string>()

  for (const deal of deals ?? []) {
    if (!deal.contact_email) continue
    const touchedSeqs = emailToSequences.get(deal.contact_email)
    if (!touchedSeqs) continue

    for (const sId of Array.from(touchedSeqs)) {
      const key = `${deal.contact_email}|${sId}`
      const enrolledAt = enrollmentDates.get(key)

      // Contact must have been enrolled before or at deal close
      if (enrolledAt && deal.closed_at && enrolledAt > deal.closed_at) continue

      if (!seqRevenue.has(sId)) {
        seqRevenue.set(sId, { revenue: 0, deals: 0 })
      }
      const bucket = seqRevenue.get(sId)!
      bucket.revenue += deal.value ?? 0
      bucket.deals += 1

      // Count toward totals only once per deal
      if (!countedDealIds.has(deal.id)) {
        totalRevenue += deal.value ?? 0
        totalDeals += 1
        countedDealIds.add(deal.id)
      }
    }
  }

  const sequencesList = Array.from(seqRevenue.entries()).map(([seqId, data]) => ({
    sequenceId: seqId,
    sequenceName: seqNameMap.get(seqId) ?? 'Unknown',
    revenue: data.revenue,
    deals: data.deals,
  }))

  return NextResponse.json({
    totalRevenue,
    totalDeals,
    sequences: sequencesList,
  })
}
