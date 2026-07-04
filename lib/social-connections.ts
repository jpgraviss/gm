/**
 * CRUD + status helpers for the `social_connections` table, plus discovery of
 * the accounts a workspace can publish to per platform.
 *
 * Tokens are encrypted at rest via lib/encryption. google_business stores no
 * token (it publishes through the shared Google Marketing OAuth), only the
 * selected location name.
 */

import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { listMetaPages } from '@/lib/meta-ads'
import { listGBPLocations } from '@/lib/google-business-profile'
import type { SocialPlatform } from '@/lib/social-media'

export interface ConnectionStatus {
  platform: SocialPlatform
  connected: boolean
  accountLabel: string | null
  connectedAt: string | null
}

/** Selectable target account for a platform (from the underlying OAuth grant). */
export interface AvailableAccount {
  platform: SocialPlatform
  externalId: string
  label: string
  /** Platform-specific token (e.g. a Facebook Page token). Empty for GBP. */
  token?: string
}

/**
 * Return the connection status for every platform (connected or not).
 */
export async function listConnectionStatuses(
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Promise<ConnectionStatus[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('social_connections')
    .select('platform, account_label, status, connected_at')
    .eq('workspace_id', workspaceId)

  const rows = data ?? []
  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'google_business']
  return platforms.map((platform) => {
    const row = rows.find((r) => r.platform === platform)
    return {
      platform,
      connected: !!row && row.status === 'connected',
      accountLabel: row?.account_label ?? null,
      connectedAt: row?.connected_at ?? null,
    }
  })
}

/**
 * Save (upsert) a selected publish target for a platform.
 */
export async function saveConnection(params: {
  platform: SocialPlatform
  externalId: string
  accountLabel: string
  token?: string
  metadata?: Record<string, unknown>
  workspaceId?: string
}): Promise<void> {
  const db = createServiceClient()
  const workspaceId = params.workspaceId ?? DEFAULT_WORKSPACE_ID
  await db.from('social_connections').upsert(
    {
      id: `sc-${workspaceId}-${params.platform}`,
      workspace_id: workspaceId,
      platform: params.platform,
      account_label: params.accountLabel,
      external_id: params.externalId,
      access_token: params.token ? encrypt(params.token) : null,
      metadata: params.metadata ?? {},
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,platform' },
  )
}

/**
 * Disconnect a platform (mark disconnected, clear token). Row kept for audit.
 */
export async function removeConnection(
  platform: SocialPlatform,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Promise<void> {
  const db = createServiceClient()
  await db
    .from('social_connections')
    .update({ status: 'disconnected', access_token: null, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('platform', platform)
}

/**
 * Discover the accounts a workspace can publish to for a platform, sourced from
 * the underlying OAuth grant. Facebook/Instagram come from the Meta pages list;
 * Google Business from the GBP locations list. LinkedIn selection happens during
 * its own OAuth callback, so it has no separate discovery here.
 */
export async function listAvailableAccounts(platform: SocialPlatform): Promise<AvailableAccount[]> {
  switch (platform) {
    case 'facebook': {
      const pages = await listMetaPages()
      return pages.map((p) => ({
        platform: 'facebook',
        externalId: p.id,
        label: p.name,
        token: p.accessToken,
      }))
    }
    case 'instagram': {
      const pages = await listMetaPages()
      return pages
        .filter((p) => p.instagramId)
        .map((p) => ({
          platform: 'instagram',
          externalId: p.instagramId as string,
          label: p.instagramUsername ? `@${p.instagramUsername}` : p.name,
          token: p.accessToken,
        }))
    }
    case 'google_business': {
      const locations = await listGBPLocations()
      return locations.map((l) => ({
        platform: 'google_business',
        externalId: l.locationName,
        label: l.title,
      }))
    }
    default:
      return []
  }
}
