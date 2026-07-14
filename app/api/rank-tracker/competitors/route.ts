import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getCompetitors, addCompetitor } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'
import { validate, validationError } from '@/lib/validation'

export const GET = withErrorHandler('rank-tracker/competitors GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const competitors = await getCompetitors()
  return NextResponse.json(competitors)
})

export const POST = withErrorHandler('rank-tracker/competitors POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const v = validate(body, {
    domain: { required: true, type: 'string', maxLength: 500 },
    name:   { type: 'string', maxLength: 200 },
  })
  if (!v.valid) return validationError(v.error)

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
