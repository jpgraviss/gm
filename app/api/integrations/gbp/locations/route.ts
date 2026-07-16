import { NextRequest, NextResponse } from 'next/server'
import { listGBPLocations } from '@/lib/google-business-profile'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('integrations/gbp/locations GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const locations = await listGBPLocations()
  return NextResponse.json(locations)
})
