import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { mirrorTrackedEmailActivity } from '@/lib/tracked-emails'

// 1x1 transparent GIF — the actual tracking pixel payload.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Content-Length': String(PIXEL.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * The tracking pixel the browser extension embeds into a compose body
 * before Gmail sends it. Public (no auth possible — this is loaded by
 * whatever mail client renders the recipient's inbox, not by GravHub
 * itself). `id` is an opaque tracked_emails.id; an unknown/garbage id just
 * serves the pixel without logging anything rather than erroring, since a
 * broken pixel request must never surface to the person who opened the
 * email.
 */
export const GET = withErrorHandler('track/open/[id] GET', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params
  const db = createServiceClient()

  const { data: tracked } = await db
    .from('tracked_emails')
    .select('id, team_member_id, recipient_email, subject, contact_id, company_id, open_count')
    .eq('id', id)
    .maybeSingle()

  if (tracked) {
    const isFirstOpen = (tracked.open_count ?? 0) === 0
    // AUDIT #247 — atomic RPC instead of a read-then-write increment, which
    // could undercount by one under concurrent opens.
    await Promise.all([
      db.from('tracked_email_opens').insert({
        id: `teo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tracked_email_id: tracked.id,
        user_agent: req.headers.get('user-agent') ?? null,
      }),
      db.rpc('increment_tracked_email_counts', { p_id: tracked.id, p_opens: 1 }),
    ])
    if (isFirstOpen) {
      await mirrorTrackedEmailActivity(db, tracked, `Opened email${tracked.subject ? `: ${tracked.subject}` : ''}`)
    }
  }

  return new NextResponse(PIXEL, { headers: PIXEL_HEADERS })
})
