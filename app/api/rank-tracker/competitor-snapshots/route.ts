import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

export const GET = withErrorHandler('rank-tracker/competitor-snapshots GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('competitor_rank_snapshots')
    .select('id, competitor_id, tracked_keyword_id, position, url, checked_at')
    .order('checked_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Failed to load snapshots' }, { status: 500 })

  const grouped: Record<string, Record<string, number | null>> = {}
  for (const row of data ?? []) {
    const kwId = row.tracked_keyword_id
    const compId = row.competitor_id
    if (!grouped[kwId]) grouped[kwId] = {}
    if (!(compId in grouped[kwId])) {
      grouped[kwId][compId] = row.position
    }
  }

  return NextResponse.json(grouped)
})
