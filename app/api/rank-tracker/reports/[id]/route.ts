import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { deleteScheduledReport } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'

export const DELETE = withErrorHandler('rank-tracker/reports/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  await deleteScheduledReport(id)
  logAudit({
    userName: 'system',
    action:   'deleted_scheduled_report',
    module:   'rank-tracker',
    type:     'warning',
    metadata: { id },
  })
  return NextResponse.json({ deleted: id })
})
