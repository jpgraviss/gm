import { NextResponse } from 'next/server'
import { getStatistics } from '@/lib/maverick'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('intelligence/stats GET', async () => {
  const result = await getStatistics()
  return NextResponse.json(result)
})
