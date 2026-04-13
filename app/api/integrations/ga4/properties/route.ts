import { NextResponse } from 'next/server'
import { listGA4Properties } from '@/lib/google-analytics'

export async function GET() {
  try {
    const properties = await listGA4Properties()
    return NextResponse.json(properties)
  } catch (err) {
    console.error('[ga4/properties]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch GA4 properties' },
      { status: 500 },
    )
  }
}
