import { NextRequest, NextResponse } from 'next/server'
import { replyToGBPReview } from '@/lib/google-business-profile'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

/**
 * POST /api/integrations/gbp/reply
 * Body: { location, reviewId, comment }
 * Matches AUDIT #100's fix on /api/reputation/reviews — this is the same
 * capability (a real, public, published reply to a Google review) and had
 * been missed here. Previously had zero auth: any authenticated caller
 * could post a real public reply attributed to 'system' in the audit log.
 */
export const POST = withErrorHandler('integrations/gbp/reply POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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
