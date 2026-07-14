import { NextResponse } from 'next/server'
import { getStatistics } from '@/lib/maverick'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('intelligence/stats GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const result = await getStatistics()
  return NextResponse.json(result)
})
