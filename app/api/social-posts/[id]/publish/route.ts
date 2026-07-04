import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { mapPost, type SocialPlatform } from '@/lib/social-media'
import { publishToPlatform } from '@/lib/social-publish'
import { logAudit } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data: post } = await db.from('social_posts').select('*').eq('id', id).single()
  if (!post) return NextResponse.json({ error: 'Social post not found' }, { status: 404 })

  if (post.status === 'published' || post.status === 'publishing') {
    return NextResponse.json({ error: `Post is already ${post.status}` }, { status: 400 })
  }

  const platforms = (post.platforms as SocialPlatform[]) ?? []
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'Post has no target platforms' }, { status: 400 })
  }

  // Mark as publishing
  await db.from('social_posts').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', id)

  // Publish to each platform, collecting real ids and per-platform errors.
  const platformPostIds: Record<string, string> = {}
  const platformErrors: Record<string, string> = {}

  const input = {
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
  const allSucceeded = anySucceeded && Object.keys(platformErrors).length === 0
  // published if at least one platform accepted it (partial success keeps the
  // errors visible); failed only when every platform rejected it.
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
    console.error('[social-posts publish]', error)
    await db.from('social_posts').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({
    userName: 'system',
    action: 'published_social_post',
    module: 'social_media',
    type: 'action',
    metadata: { postId: id, platforms, platformPostIds, platformErrors },
  })

  // Surface a 502 when nothing published so the client can show the failure
  // rather than a false "Published".
  if (!anySucceeded) {
    return NextResponse.json(
      { ...mapPost(updated), error: 'All platforms failed to publish' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ...mapPost(updated), partial: !allSucceeded })
}
