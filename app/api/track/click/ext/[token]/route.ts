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
    await Promise.all([
      db.from('tracked_email_clicks').insert({
        id: `tec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tracked_email_id: tracked.id,
        url,
      }),
      db.from('tracked_emails').update({
        click_count: (tracked.click_count ?? 0) + 1,
        last_clicked_at: new Date().toISOString(),
      }).eq('id', tracked.id),
    ])
    await mirrorTrackedEmailActivity(db, tracked, `Clicked link in email${tracked.subject ? ` (${tracked.subject})` : ''}`)
  }

  return NextResponse.redirect(url, 302)
})
