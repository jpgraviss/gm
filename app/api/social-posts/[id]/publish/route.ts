import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { publishSocialPost } from '@/lib/social-publish'

export const POST = withErrorHandler('social-posts/[id]/publish POST', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  const result = await publishSocialPost(id)

  if (result.reason === 'not_found') {
    return NextResponse.json({ error: 'Social post not found' }, { status: 404 })
  }
  if (result.reason === 'already_done') {
    return NextResponse.json({ error: `Post is already ${result.post?.status}` }, { status: 400 })
  }
  if (result.reason === 'no_platforms') {
    return NextResponse.json({ error: 'Post has no target platforms' }, { status: 400 })
  }
  if (result.reason === 'db_error') {
    throw new Error(result.error ?? 'Failed to publish')
  }

  // Surface a 502 when nothing published so the client shows the failure
  // rather than a false "Published".
  if (!result.anySucceeded) {
    return NextResponse.json(
      { ...result.post, error: 'All platforms failed to publish' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ...result.post, partial: result.partial })
})
