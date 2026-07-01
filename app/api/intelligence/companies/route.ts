import { NextRequest, NextResponse } from 'next/server'
import { listCompanies } from '@/lib/maverick'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const limit = params.get('limit') ?? '50'
  const cursor = params.get('cursor') ?? undefined

  try {
    const result = await listCompanies({ limit: Number(limit), cursor })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
