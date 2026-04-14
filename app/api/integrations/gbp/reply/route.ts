import { NextRequest, NextResponse } from 'next/server'
import { replyToGBPReview } from '@/lib/google-business-profile'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/integrations/gbp/reply
 * Body: { location, reviewId, comment }
 */
export async function POST(req: NextRequest) {
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

  try {
    const reply = await replyToGBPReview(location, reviewId, comment)

    await logAudit({
      userName: 'system',
      action:   'gbp.review.reply',
      module:   'reputation',
      type:     'action',
      metadata: { location, reviewId, comment },
    })

    return NextResponse.json({ ok: true, reply })
  } catch (err) {
    console.error('[gbp/reply]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reply to review' },
      { status: 500 },
    )
  }
}
