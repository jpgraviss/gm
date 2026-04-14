import { NextResponse } from 'next/server'
import { listGBPLocations } from '@/lib/google-business-profile'

export async function GET() {
  try {
    const locations = await listGBPLocations()
    return NextResponse.json(locations)
  } catch (err) {
    console.error('[gbp/locations]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch GBP locations' },
      { status: 500 },
    )
  }
}
