import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyToken } from '@/lib/signed-token'
import type { ClickTokenPayload } from '@/lib/email-tracking'

export const GET = withErrorHandler('track/click/[token] GET', async (
  _req,
  { params }: { params: Promise<{ token: string }> },
) => {
  const { token } = await params

  // AUDIT — previously decoded unsigned base64 JSON with no verification,
  // so anyone could forge a token with an arbitrary contactId/email/url +
  // any observed broadcastId (open redirect + fake click-analytics
  // injection). Now rejects anything not signed by this server.
  const payload = verifyToken<ClickTokenPayload>(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { broadcastId, contactId, email, url } = payload
  if (!broadcastId || !url) {
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

  const clickId = `blc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await db.from('broadcast_link_clicks').insert({
    id: clickId,
    broadcast_id: broadcastId,
    contact_id: contactId || null,
    email: email || null,
    original_url: url,
  })

  if (email) {
    await db
      .from('broadcast_recipients')
      .update({ clicked_at: new Date().toISOString() })
      .eq('broadcast_id', broadcastId)
      .eq('email', email)
      .is('clicked_at', null)
  }

  // AUDIT #247 — atomic RPC instead of a read-then-write increment, which
  // could undercount by one under concurrent clicks.
  await db.rpc('increment_broadcast_clicked', { p_broadcast_id: broadcastId })

  return NextResponse.redirect(parsedUrl.toString(), 302)
})
