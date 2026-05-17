import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getCompetitors, addCompetitor } from '@/lib/rank-tracker'

export async function GET() {
  const competitors = await getCompetitors()
  return NextResponse.json(competitors)
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.domain || typeof body.domain !== 'string') {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  try {
    const competitor = await addCompetitor(body.domain, body.label)
    logAudit({
      userName: 'system',
      action:   'added_competitor',
      module:   'rank-tracker',
      type:     'action',
      metadata: { id: competitor.id, domain: competitor.domain },
    })
    return NextResponse.json(competitor, { status: 201 })
  } catch (err) {
    console.error('[rank-tracker competitors POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to add competitor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
