import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getScheduledReports, createScheduledReport } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('rank-tracker/reports GET', async () => {
  const reports = await getScheduledReports()
  return NextResponse.json(reports)
})

export const POST = withErrorHandler('rank-tracker/reports POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.name || !Array.isArray(body.recipients) || body.recipients.length === 0) {
    return NextResponse.json({ error: 'name and recipients[] are required' }, { status: 400 })
  }

  const report = await createScheduledReport({
    name:       body.name,
    frequency:  body.frequency ?? 'weekly',
    recipients: body.recipients,
    filters:    body.filters,
  })
  logAudit({
    userName: 'system',
    action:   'created_scheduled_report',
    module:   'rank-tracker',
    type:     'action',
    metadata: { id: report.id, name: report.name },
  })
  return NextResponse.json(report, { status: 201 })
})
