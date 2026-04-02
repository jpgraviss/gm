import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const sequenceId = req.nextUrl.searchParams.get('sequenceId')
  if (!sequenceId) {
    return NextResponse.json({ error: 'sequenceId is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch all activities for this sequence
  const { data: activities, error } = await db
    .from('sequence_activities')
    .select('event_type, step_index, created_at')
    .eq('sequence_id', sequenceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = activities ?? []

  // --- Overview ---
  const totalSent         = rows.filter(r => r.event_type === 'sent').length
  const totalDelivered    = rows.filter(r => r.event_type === 'delivered').length
  const totalOpened       = rows.filter(r => r.event_type === 'opened').length
  const totalClicked      = rows.filter(r => r.event_type === 'clicked').length
  const totalReplied      = rows.filter(r => r.event_type === 'replied').length
  const totalBounced      = rows.filter(r => r.event_type === 'bounced').length
  const totalUnsubscribed = rows.filter(r => r.event_type === 'unsubscribed').length

  const safeRate = (num: number, denom: number) => denom > 0 ? Math.round((num / denom) * 10000) / 100 : 0

  const overview = {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalReplied,
    totalBounced,
    totalUnsubscribed,
    openRate:        safeRate(totalOpened, totalDelivered || totalSent),
    clickRate:       safeRate(totalClicked, totalDelivered || totalSent),
    replyRate:       safeRate(totalReplied, totalDelivered || totalSent),
    bounceRate:      safeRate(totalBounced, totalSent),
    unsubscribeRate: safeRate(totalUnsubscribed, totalDelivered || totalSent),
  }

  // --- Step metrics ---
  const stepMap = new Map<number, { sent: number; opened: number; clicked: number; replied: number; bounced: number }>()
  for (const r of rows) {
    const idx = r.step_index ?? 0
    if (!stepMap.has(idx)) {
      stepMap.set(idx, { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 })
    }
    const s = stepMap.get(idx)!
    if (r.event_type === 'sent')    s.sent++
    if (r.event_type === 'opened')  s.opened++
    if (r.event_type === 'clicked') s.clicked++
    if (r.event_type === 'replied') s.replied++
    if (r.event_type === 'bounced') s.bounced++
  }

  const stepMetrics = Array.from(stepMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([stepIndex, s]) => ({
      stepIndex,
      sent:      s.sent,
      opened:    s.opened,
      clicked:   s.clicked,
      replied:   s.replied,
      bounced:   s.bounced,
      openRate:  safeRate(s.opened, s.sent),
      clickRate: safeRate(s.clicked, s.sent),
      replyRate: safeRate(s.replied, s.sent),
    }))

  // --- Daily sends (last 30 days) ---
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const dailyMap = new Map<string, number>()

  // Pre-fill last 30 days with 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo.getTime() + i * 86400000)
    dailyMap.set(d.toISOString().split('T')[0], 0)
  }

  for (const r of rows) {
    if (r.event_type !== 'sent') continue
    const date = (r.created_at ?? '').split('T')[0]
    if (!date) continue
    if (dailyMap.has(date)) {
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1)
    }
  }

  const dailySends = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // --- A/B results ---
  // Fetch activities that have a variant field
  const { data: abActivities } = await db
    .from('sequence_activities')
    .select('event_type, step_index, variant')
    .eq('sequence_id', sequenceId)
    .not('variant', 'is', null)

  let abResults: Array<{
    stepIndex: number
    variantA: { sent: number; opened: number; clicked: number; replied: number }
    variantB: { sent: number; opened: number; clicked: number; replied: number }
    winner: 'A' | 'B' | null
  }> | undefined

  if (abActivities && abActivities.length > 0) {
    const abMap = new Map<number, {
      A: { sent: number; opened: number; clicked: number; replied: number }
      B: { sent: number; opened: number; clicked: number; replied: number }
    }>()

    for (const r of abActivities) {
      const idx = r.step_index ?? 0
      const v = r.variant as string
      if (v !== 'A' && v !== 'B') continue
      if (!abMap.has(idx)) {
        abMap.set(idx, {
          A: { sent: 0, opened: 0, clicked: 0, replied: 0 },
          B: { sent: 0, opened: 0, clicked: 0, replied: 0 },
        })
      }
      const bucket = abMap.get(idx)![v]
      if (r.event_type === 'sent')    bucket.sent++
      if (r.event_type === 'opened')  bucket.opened++
      if (r.event_type === 'clicked') bucket.clicked++
      if (r.event_type === 'replied') bucket.replied++
    }

    abResults = Array.from(abMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([stepIndex, { A, B }]) => {
        // Determine winner by reply rate, then open rate
        const aScore = A.sent > 0 ? (A.replied / A.sent) * 2 + (A.opened / A.sent) : 0
        const bScore = B.sent > 0 ? (B.replied / B.sent) * 2 + (B.opened / B.sent) : 0
        const winner: 'A' | 'B' | null =
          A.sent < 5 || B.sent < 5 ? null : aScore > bScore ? 'A' : bScore > aScore ? 'B' : null

        return { stepIndex, variantA: A, variantB: B, winner }
      })
  }

  return NextResponse.json({
    overview,
    stepMetrics,
    dailySends,
    ...(abResults ? { abResults } : {}),
  })
}
