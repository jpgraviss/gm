import { NextResponse } from 'next/server'
import { listGSCProperties } from '@/lib/google-search-console'

export async function GET() {
  try {
    const properties = await listGSCProperties()
    return NextResponse.json(properties)
  } catch (err) {
    console.error('[gsc/properties]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch GSC properties' },
      { status: 500 },
    )
  }
}
