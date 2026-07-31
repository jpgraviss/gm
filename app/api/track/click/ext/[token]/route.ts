import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { mirrorTrackedEmailActivity } from '@/lib/tracked-emails'
import { verifyToken } from '@/lib/signed-token'
import type { ExtClickTokenPayload } from '@/lib/email-tracking'

/**
 * Click-redirect for links the browser extension rewrote before Gmail sent
 * the email. `token` is an HMAC-signed {trackedEmailId, url} payload, minted
 * server-side by POST /api/extension/track-send (the extension can't hold
 * the signing key). Public: this is followed by whoever the recipient is,
 * not by GravHub.
 *
 * AUDIT #591 — previously decoded unsigned base64 JSON built client-side by
 * the extension, with no signature check and no redirect-scheme validation
 * — an open redirect off the production domain, plus a way to forge fake
 * "clicked" activity onto any guessed trackedEmailId. Now matches the
 * sibling broadcast click endpoint's verifyToken + scheme-allowlist fix (#326).
 */
export const GET = withErrorHandler('track/click/ext/[token] GET', async (
  _req,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params

  const payload = verifyToken<ExtClickTokenPayload>(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { trackedEmailId, url } = payload
  if (!trackedEmailId || !url) {
    return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid redirect URL' }, { status: 400 })
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Invalid redirect URL' }, { status: 400 })
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

  return NextResponse.redirect(parsedUrl.toString(), 302)
})
