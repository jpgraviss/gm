import { NextRequest, NextResponse } from 'next/server'
import { listGSCProperties } from '@/lib/google-search-console'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('integrations/gsc/properties GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const properties = await listGSCProperties()
  return NextResponse.json(properties)
})
