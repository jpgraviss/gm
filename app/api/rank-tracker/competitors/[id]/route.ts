import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { deleteCompetitor } from '@/lib/rank-tracker'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  try {
    await deleteCompetitor(id)
    logAudit({
      userName: 'system',
      action:   'deleted_competitor',
      module:   'rank-tracker',
      type:     'warning',
      metadata: { id },
    })
    return NextResponse.json({ deleted: id })
  } catch (err) {
    console.error('[rank-tracker competitors DELETE]', err)
    const message = err instanceof Error ? err.message : 'Failed to delete competitor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
