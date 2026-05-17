import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { getScheduledReports, createScheduledReport } from '@/lib/rank-tracker'

export async function GET() {
  const reports = await getScheduledReports()
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.name || !Array.isArray(body.recipients) || body.recipients.length === 0) {
    return NextResponse.json({ error: 'name and recipients[] are required' }, { status: 400 })
  }

  try {
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
  } catch (err) {
    console.error('[rank-tracker reports POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to create report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
