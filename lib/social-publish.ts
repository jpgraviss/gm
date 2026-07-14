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
import { appendHashtags, truncateForPlatform, mapPost, type SocialPlatform, type SocialPost } from '@/lib/social-media'
import { logAudit } from '@/lib/audit'

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

export interface PublishPostResult {
  post: SocialPost | null
  anySucceeded: boolean
  partial: boolean
  /** Set when the post can't be published (not found / already published). */
  reason?: 'not_found' | 'already_done' | 'no_platforms' | 'not_approved' | 'db_error'
  error?: string
}

/**
 * Publish a single social_posts row across all its target platforms. Shared by
 * the manual publish route and the scheduled cron dispatcher so both take the
 * exact same code path (real API calls, honest per-platform status).
 */
export async function publishSocialPost(id: string): Promise<PublishPostResult> {
  const db = createServiceClient()

  const { data: post } = await db.from('social_posts').select('*').eq('id', id).single()
  if (!post) return { post: null, anySucceeded: false, partial: false, reason: 'not_found' }

  if (post.status === 'published' || post.status === 'publishing') {
    return { post: mapPost(post), anySucceeded: false, partial: false, reason: 'already_done' }
  }

  // The schema's own stated intent ("Approval workflow lets clients review
  // before posts go live") was previously enforced only by the staff UI
  // conditionally showing a Publish button — nothing server-side stopped a
  // draft or rejected post from actually going live.
  if (post.approval_status !== 'approved') {
    return { post: mapPost(post), anySucceeded: false, partial: false, reason: 'not_approved' }
  }

  const platforms = (post.platforms as SocialPlatform[]) ?? []
  if (platforms.length === 0) {
    return { post: mapPost(post), anySucceeded: false, partial: false, reason: 'no_platforms' }
  }

  await db.from('social_posts').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', id)

  const platformPostIds: Record<string, string> = {}
  const platformErrors: Record<string, string> = {}
  const input: PublishInput = {
    content: post.content ?? '',
    hashtags: (post.hashtags as string[]) ?? [],
    mediaUrls: (post.media_urls as string[]) ?? [],
    linkUrl: post.link_url ?? undefined,
  }

  for (const platform of platforms) {
    try {
      const { platformPostId } = await publishToPlatform(platform, input)
      platformPostIds[platform] = platformPostId
    } catch (err) {
      platformErrors[platform] = err instanceof Error ? err.message : 'Unknown error'
    }
  }

  const anySucceeded = Object.keys(platformPostIds).length > 0
  const partial = anySucceeded && Object.keys(platformErrors).length > 0
  const status = anySucceeded ? 'published' : 'failed'

  const { data: updated, error } = await db
    .from('social_posts')
    .update({
      status,
      published_at: anySucceeded ? new Date().toISOString() : null,
      platform_post_ids: platformPostIds,
      platform_errors: platformErrors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[publishSocialPost]', error)
    await db.from('social_posts').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
    return { post: mapPost(post), anySucceeded: false, partial: false, reason: 'db_error', error: error.message }
  }

  logAudit({
    userName: 'system',
    action: 'published_social_post',
    module: 'social_media',
    type: 'action',
    metadata: { postId: id, platforms, platformPostIds, platformErrors },
  })

  return { post: mapPost(updated), anySucceeded, partial }
}
