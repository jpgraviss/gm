import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getSettings } from '@/lib/settings'

export const GET = withErrorHandler('settings/resolved GET', async () => {
  const settings = await getSettings()
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
  })
})
