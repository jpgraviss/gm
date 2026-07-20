import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { deleteCompetitor } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'

export const DELETE = withErrorHandler('rank-tracker/competitors/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  await deleteCompetitor(id)
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   'deleted_competitor',
    module:   'rank-tracker',
    type:     'warning',
    metadata: { id },
  })
  return NextResponse.json({ deleted: id })
})
