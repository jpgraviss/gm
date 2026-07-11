import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'
import { getGuidedActions } from '@/lib/guided-actions'

export const GET = withErrorHandler('workspace/guided-actions GET', async (req) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const actions = await getGuidedActions(user.name, user.email, user.userId)
  return NextResponse.json(actions)
})
