import { NextRequest, NextResponse } from 'next/server'
import { getKeywordHistory } from '@/lib/rank-tracker'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const daysParam = searchParams.get('days')
  const days = daysParam ? Math.max(1, Math.min(365, parseInt(daysParam, 10) || 90)) : 90

  const history = await getKeywordHistory(id, days)
  return NextResponse.json({ trackedKeywordId: id, days, points: history })
}
