import { NextRequest, NextResponse } from 'next/server'
import { listCompanies } from '@/lib/maverick'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('intelligence/companies GET', async (req) => {
  const params = new URL(req.url).searchParams
  const limit = params.get('limit') ?? '50'
  const cursor = params.get('cursor') ?? undefined

  const result = await listCompanies({ limit: Number(limit), cursor })
  return NextResponse.json(result)
})
