import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getCompetitors, addCompetitor } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('rank-tracker/competitors GET', async () => {
  const competitors = await getCompetitors()
  return NextResponse.json(competitors)
})

export const POST = withErrorHandler('rank-tracker/competitors POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.domain || typeof body.domain !== 'string') {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }

  const competitor = await addCompetitor(body.domain, body.label)
  logAudit({
    userName: 'system',
    action:   'added_competitor',
    module:   'rank-tracker',
    type:     'action',
    metadata: { id: competitor.id, domain: competitor.domain },
  })
  return NextResponse.json(competitor, { status: 201 })
})
