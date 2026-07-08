import { NextResponse } from 'next/server'
import { listGSCProperties } from '@/lib/google-search-console'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('integrations/gsc/properties GET', async () => {
  const properties = await listGSCProperties()
  return NextResponse.json(properties)
})
