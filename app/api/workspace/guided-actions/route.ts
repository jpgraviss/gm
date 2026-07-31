import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getGuidedActions } from '@/lib/guided-actions'

export const GET = withErrorHandler('workspace/guided-actions GET', async (req) => {
  // AUDIT #583 — every comparable internal-tooling route (search,
  // notifications, saved-filters, custom-field-definitions,
  // monitored-sites) requires Team Member; this only checked the caller
  // was authenticated at all.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const actions = await getGuidedActions(user.name, user.email, user.userId)
  return NextResponse.json(actions)
})
