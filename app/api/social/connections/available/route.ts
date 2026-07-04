import { NextRequest, NextResponse } from 'next/server'
import { listAvailableAccounts } from '@/lib/social-connections'
import type { SocialPlatform } from '@/lib/social-media'

const DISCOVERABLE: SocialPlatform[] = ['facebook', 'instagram', 'google_business']

/**
 * GET /api/social/connections/available?platform=facebook
 * Returns the accounts/pages/locations the workspace can publish to for a
 * platform, sourced from the underlying OAuth grant. Returns a clear error
 * (not a fake list) when the platform's OAuth isn't connected.
 */
export async function GET(req: NextRequest) {
  const platform = new URL(req.url).searchParams.get('platform') as SocialPlatform | null
  if (!platform || !DISCOVERABLE.includes(platform)) {
    return NextResponse.json({ error: 'Unsupported platform for discovery' }, { status: 400 })
  }

  try {
    const accounts = await listAvailableAccounts(platform)
    return NextResponse.json(accounts)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list accounts' },
      { status: 502 },
    )
  }
}
