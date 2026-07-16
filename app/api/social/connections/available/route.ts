import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { listAvailableAccounts } from '@/lib/social-connections'
import type { SocialPlatform } from '@/lib/social-media'
import { requireRole } from '@/lib/rbac'

const DISCOVERABLE: SocialPlatform[] = ['facebook', 'instagram', 'google_business']

/**
 * GET /api/social/connections/available?platform=facebook
 * Returns the accounts/pages/locations the workspace can publish to for a
 * platform, sourced from the underlying OAuth grant. Returns a clear error
 * (not a fake list) when the platform's OAuth isn't connected.
 * Previously had zero auth — the underlying accounts payload includes live
 * Meta Page access tokens, so this was real credential exfiltration to any
 * caller, not just an authorization gap.
 */
export const GET = withErrorHandler('social/connections/available GET', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

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
})
