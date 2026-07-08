import { NextRequest, NextResponse } from 'next/server'
import { replyToGBPReview } from '@/lib/google-business-profile'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * POST /api/integrations/gbp/reply
 * Body: { location, reviewId, comment }
 */
export const POST = withErrorHandler('integrations/gbp/reply POST', async (req) => {
  let body: { location?: string; reviewId?: string; comment?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const { location, reviewId, comment } = body
  if (!location || !reviewId || !comment) {
    return NextResponse.json(
      { error: 'location, reviewId, and comment are required' },
      { status: 400 },
    )
  }

  const reply = await replyToGBPReview(location, reviewId, comment)

  await logAudit({
    userName: 'system',
    action:   'gbp.review.reply',
    module:   'reputation',
    type:     'action',
    metadata: { location, reviewId, comment },
  })

  return NextResponse.json({ ok: true, reply })
})
