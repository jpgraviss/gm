import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { mirrorTrackedEmailActivity } from '@/lib/tracked-emails'

/**
 * Click-redirect for links the browser extension rewrote before Gmail sent
 * the email. `token` is a base64url-encoded {trackedEmailId, url} payload
 * — unsigned, matching the same precedent as the existing broadcast click
 * endpoint (app/api/track/click/[token]/route.ts). Public: this is followed
 * by whoever the recipient is, not by GravHub.
 */
export const GET = withErrorHandler('track/click/ext/[token] GET', async (
  _req,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params

  let payload: { trackedEmailId: string; url: string }
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { trackedEmailId, url } = payload
  if (!trackedEmailId || !url) {
    return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: tracked } = await db
    .from('tracked_emails')
    .select('id, team_member_id, recipient_email, subject, contact_id, company_id, click_count')
    .eq('id', trackedEmailId)
    .maybeSingle()

  if (tracked) {
    // AUDIT #247 — atomic RPC instead of a read-then-write increment.
    await Promise.all([
      db.from('tracked_email_clicks').insert({
        id: `tec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tracked_email_id: tracked.id,
        url,
      }),
      db.rpc('increment_tracked_email_counts', { p_id: tracked.id, p_clicks: 1 }),
    ])
    await mirrorTrackedEmailActivity(db, tracked, `Clicked link in email${tracked.subject ? ` (${tracked.subject})` : ''}`)
  }

  return NextResponse.redirect(url, 302)
})
