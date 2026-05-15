import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  let payload: { broadcastId: string; contactId: string; email: string; url: string }
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const { broadcastId, contactId, email, url } = payload
  if (!broadcastId || !url) {
    return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 })
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

  const { data: bc } = await db
    .from('broadcasts')
    .select('total_clicked')
    .eq('id', broadcastId)
    .single()

  if (bc) {
    await db
      .from('broadcasts')
      .update({ total_clicked: (bc.total_clicked ?? 0) + 1 })
      .eq('id', broadcastId)
  }

  return NextResponse.redirect(url, 302)
}
