import { NextRequest, NextResponse } from 'next/server'
import { listGA4Properties } from '@/lib/google-analytics'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('ga4/properties GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const properties = await listGA4Properties()
  return NextResponse.json(properties)
})
