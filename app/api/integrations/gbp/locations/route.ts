import { NextResponse } from 'next/server'
import { listGBPLocations } from '@/lib/google-business-profile'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('integrations/gbp/locations GET', async () => {
  const locations = await listGBPLocations()
  return NextResponse.json(locations)
})
