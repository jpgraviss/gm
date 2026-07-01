import { NextResponse } from 'next/server'
import { getStatistics } from '@/lib/maverick'

export async function GET() {
  try {
    const result = await getStatistics()
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
