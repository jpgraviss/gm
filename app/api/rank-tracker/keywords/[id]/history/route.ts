import { NextRequest, NextResponse } from 'next/server'
import { getKeywordHistory } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('rank-tracker/keywords/[id]/history GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const daysParam = searchParams.get('days')
  const days = daysParam ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || 90)) : 90

  const history = await getKeywordHistory(id, days)
  return NextResponse.json({ trackedKeywordId: id, days, points: history })
})
