import { NextResponse } from 'next/server'
import { listGA4Properties } from '@/lib/google-analytics'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('ga4/properties GET', async () => {
  const properties = await listGA4Properties()
  return NextResponse.json(properties)
})
