/**
 * Real per-platform social publishing.
 *
 * Each publisher takes prepared content + a resolved connection and returns the
 * real platform post id, or throws an Error with a human-readable message that
 * the publish route surfaces in `platform_errors`.
 *
 * Connection sourcing:
 * - google_business posts through the shared Google Marketing OAuth token
 *   (lib/google-business-profile.ts → gbpFetch), so it needs no stored token —
 *   only the target location name. This one works today.
 * - facebook / instagram / linkedin read an encrypted token + external id from
 *   the `social_connections` table. These require the platform's app review to
 *   be completed before the tokens carry publishing permissions.
 */

import { createServiceClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encryption'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { gbpFetch } from '@/lib/google-business-profile'
import { appendHashtags, truncateForPlatform, type SocialPlatform } from '@/lib/social-media'

const META_API_VERSION = 'v21.0'
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface SocialConnection {
  platform: SocialPlatform
  externalId: string | null
  accessToken: string | null
  accountLabel: string | null
  status: string
  metadata: Record<string, unknown>
}

/**
 * Load a workspace's connection for a platform, decrypting the token.
 * Returns null when nothing is connected.
 */
export async function getSocialConnection(
  platform: SocialPlatform,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Promise<SocialConnection | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('social_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('platform', platform)
    .maybeSingle()

  if (!data || data.status !== 'connected') return null

  return {
    platform,
    externalId: data.external_id ?? null,
    accessToken: data.access_token ? decrypt(data.access_token) : null,
    accountLabel: data.account_label ?? null,
    status: data.status,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  }
}

/** Prepare content for a platform: hashtags appended, truncated to its limit. */
function prepareContent(content: string, hashtags: string[], platform: SocialPlatform): string {
  return truncateForPlatform(appendHashtags(content, hashtags), platform)
}

// ─── Google Business Profile (live today) ──────────────────────────────────

/**
 * Publish a local post to a Google Business Profile location.
 * `locationName` is the fully-qualified "accounts/{a}/locations/{l}" path.
 */
export async function publishToGoogleBusiness(
  locationName: string,
  content: string,
  mediaUrl?: string,
  linkUrl?: string,
): Promise<{ platformPostId: string }> {
  const body: Record<string, unknown> = {
    languageCode: 'en-US',
    summary: content,
    topicType: 'STANDARD',
  }
  if (mediaUrl) {
    body.media = [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }]
  }
  if (linkUrl) {
    body.callToAction = { actionType: 'LEARN_MORE', url: linkUrl }
  }

  const res = await gbpFetch<{ name?: string }>(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    { method: 'POST', body: JSON.stringify(body) },
  )

  if (!res.name) throw new Error('Google Business Profile did not return a post id')
  return { platformPostId: res.name }
}

// ─── Facebook Pages ─────────────────────────────────────────────────────────

/**
 * Publish to a Facebook Page feed. Requires a Page access token with
 * pages_manage_posts (gated on Meta App Review).
 */
export async function publishToFacebook(
  pageId: string,
  pageToken: string,
  content: string,
  mediaUrl?: string,
  linkUrl?: string,
): Promise<{ platformPostId: string }> {
  // Photo posts use a different edge than plain text/link posts.
  const endpoint = mediaUrl ? `/${pageId}/photos` : `/${pageId}/feed`
  const params = new URLSearchParams({ access_token: pageToken })
  if (mediaUrl) {
    params.set('url', mediaUrl)
    params.set('caption', content)
  } else {
    params.set('message', content)
    if (linkUrl) params.set('link', linkUrl)
  }

  const res = await fetch(`${META_GRAPH_BASE}${endpoint}`, {
    method: 'POST',
    body: params,
  })
  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } }
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook publish failed (${res.status})`)
  }
  const id = data.post_id ?? data.id
  if (!id) throw new Error('Facebook did not return a post id')
  return { platformPostId: id }
}

// ─── Instagram Business ─────────────────────────────────────────────────────

/**
 * Publish to an Instagram business account via the 2-step container flow.
 * Instagram requires a media URL (no text-only posts) and content-publishing
 * permissions (gated on Meta App Review).
 */
export async function publishToInstagram(
  igUserId: string,
  token: string,
  content: string,
  mediaUrl?: string,
): Promise<{ platformPostId: string }> {
  if (!mediaUrl) throw new Error('Instagram posts require an image or video')

  // Step 1: create a media container.
  const createParams = new URLSearchParams({
    image_url: mediaUrl,
    caption: content,
    access_token: token,
  })
  const createRes = await fetch(`${META_GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    body: createParams,
  })
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
  if (!createRes.ok || created.error || !created.id) {
    throw new Error(created.error?.message ?? `Instagram container failed (${createRes.status})`)
  }

  // Step 2: publish the container.
  const publishParams = new URLSearchParams({
    creation_id: created.id,
    access_token: token,
  })
  const publishRes = await fetch(`${META_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    body: publishParams,
  })
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } }
  if (!publishRes.ok || published.error || !published.id) {
    throw new Error(published.error?.message ?? `Instagram publish failed (${publishRes.status})`)
  }
  return { platformPostId: published.id }
}

// ─── LinkedIn ───────────────────────────────────────────────────────────────

/**
 * Publish a text post to a LinkedIn organization or member.
 * `authorUrn` is e.g. "urn:li:organization:123" or "urn:li:person:abc".
 * Requires w_organization_social / w_member_social (gated on LinkedIn approval).
 */
export async function publishToLinkedIn(
  authorUrn: string,
  token: string,
  content: string,
): Promise<{ platformPostId: string }> {
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202405',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: content,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn publish failed (${res.status}): ${body}`)
  }
  // LinkedIn returns the post URN in the x-restli-id / x-linkedin-id header.
  const id = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id')
  if (!id) throw new Error('LinkedIn did not return a post id')
  return { platformPostId: id }
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export interface PublishInput {
  content: string
  hashtags: string[]
  mediaUrls: string[]
  linkUrl?: string
}

/**
 * Publish one post to one platform. Resolves the stored connection, prepares
 * content, and calls the right publisher. Throws a clear Error when the
 * platform isn't connected or the platform API rejects the post.
 */
export async function publishToPlatform(
  platform: SocialPlatform,
  input: PublishInput,
  workspaceId: string = DEFAULT_WORKSPACE_ID,
): Promise<{ platformPostId: string }> {
  const conn = await getSocialConnection(platform, workspaceId)
  if (!conn) throw new Error(`${platform} is not connected`)

  const text = prepareContent(input.content, input.hashtags, platform)
  const mediaUrl = input.mediaUrls[0]

  switch (platform) {
    case 'google_business':
      if (!conn.externalId) throw new Error('No Google Business location selected')
      return publishToGoogleBusiness(conn.externalId, text, mediaUrl, input.linkUrl)
    case 'facebook':
      if (!conn.externalId || !conn.accessToken) throw new Error('No Facebook Page connected')
      return publishToFacebook(conn.externalId, conn.accessToken, text, mediaUrl, input.linkUrl)
    case 'instagram':
      if (!conn.externalId || !conn.accessToken) throw new Error('No Instagram account connected')
      return publishToInstagram(conn.externalId, conn.accessToken, text, mediaUrl)
    case 'linkedin':
      if (!conn.externalId || !conn.accessToken) throw new Error('No LinkedIn account connected')
      return publishToLinkedIn(conn.externalId, conn.accessToken, text)
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
