import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getScheduledReports, createScheduledReport } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'
import { validate, validationError } from '@/lib/validation'

export const GET = withErrorHandler('rank-tracker/reports GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const reports = await getScheduledReports()
  return NextResponse.json(reports)
})

export const POST = withErrorHandler('rank-tracker/reports POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const body = await req.json()
  const v = validate(body, {
    name:       { required: true, type: 'string', maxLength: 200 },
    frequency:  { required: true, type: 'string', enum: ['daily', 'weekly', 'biweekly', 'monthly'] },
    recipients: { required: true, type: 'array' },
  })
  if (!v.valid) return validationError(v.error)

  const report = await createScheduledReport({
    name:       body.name,
    frequency:  body.frequency ?? 'weekly',
    recipients: body.recipients,
    filters:    body.filters,
  })
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   'created_scheduled_report',
    module:   'rank-tracker',
    type:     'action',
    metadata: { id: report.id, name: report.name },
  })
  return NextResponse.json(report, { status: 201 })
})
