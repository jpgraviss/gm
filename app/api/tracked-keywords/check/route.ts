import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { checkAllRanks } from '@/lib/rank-tracker'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * POST /api/tracked-keywords/check — manually trigger a rank refresh
 * across every tracked keyword in the workspace. Admin-only.
 */
export const POST = withErrorHandler('tracked-keywords/check POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  try {
    const result = await checkAllRanks()
    logAudit({
      userName: 'system',
      action:   'ran_rank_check',
      module:   'rank-tracker',
      type:     'action',
      metadata: result,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Rank check failed'
    throw new Error(message)
  }
})
