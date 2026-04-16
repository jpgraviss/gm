import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { mapPost } from '@/lib/social-media'
import { logAudit } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data: post } = await db.from('social_posts').select('*').eq('id', id).single()
  if (!post) return NextResponse.json({ error: 'Social post not found' }, { status: 404 })

  if (post.status === 'published' || post.status === 'publishing') {
    return NextResponse.json({ error: `Post is already ${post.status}` }, { status: 400 })
  }

  // Mark as publishing
  await db.from('social_posts').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('id', id)

  // Placeholder: log publish attempt per platform.
  // Real API calls (Facebook, LinkedIn, etc.) will replace this once approved.
  const platformPostIds: Record<string, string> = {}
  for (const platform of (post.platforms as string[])) {
    console.log(`[social-posts publish] Publishing to ${platform} for post ${id} — pending API connection`)
    platformPostIds[platform] = 'pending_api_connection'
  }

  // Mark as published with placeholder IDs
  const { data: updated, error } = await db
    .from('social_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      platform_post_ids: platformPostIds,
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
    metadata: { postId: id, platforms: post.platforms, platformPostIds },
  })

  return NextResponse.json(mapPost(updated))
}
