import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/rbac'
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
  const actor = await getAuthUser(req)

  const body = await req.json()
  // AUDIT #266 — this validated a `name` field the frontend never sends
  // (it sends `label`, read correctly below) — harmless since `name` isn't
  // required, just dead/confusing. Validate the field actually used.
  const v = validate(body, {
    domain: { required: true, type: 'string', maxLength: 500 },
    label:  { type: 'string', maxLength: 200 },
  })
  if (!v.valid) return validationError(v.error)

  const competitor = await addCompetitor(body.domain, body.label)
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   'added_competitor',
    module:   'rank-tracker',
    type:     'action',
    metadata: { id: competitor.id, domain: competitor.domain },
  })
  return NextResponse.json(competitor, { status: 201 })
})
