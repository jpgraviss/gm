import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('push/subscribe POST', async (req) => {
  const denied = await requireRole(req, 'Client')
  if (denied) return denied

  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const db = createServiceClient()

  const { error } = await db.from('push_subscriptions').upsert(
    {
      id: `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    throw new Error(error?.message || 'Failed to save subscription')
  }

  return NextResponse.json({ ok: true, userId: user.userId }, { status: 201 })
})

export const DELETE = withErrorHandler('push/subscribe DELETE', async (req) => {
  const denied = await requireRole(req, 'Client')
  if (denied) return denied

  const body = await req.json()
  const { endpoint } = body

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint)

  if (error) {
    throw new Error(error?.message || 'Failed to remove subscription')
  }

  return NextResponse.json({ ok: true })
})
