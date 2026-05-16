import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: { user } } = await db.auth.getUser(
    req.headers.get('authorization')?.replace('Bearer ', '') ?? '',
  )
  const userId = user?.id ?? 'anonymous'

  const { error } = await db.from('push_subscriptions').upsert(
    {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('[push/subscribe POST]', error)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { endpoint } = body

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint)

  if (error) {
    console.error('[push/subscribe DELETE]', error)
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
