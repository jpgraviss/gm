import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push-notifications'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('push/send POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { userId, title, body: notifBody, url } = body

  if (!userId || !title) {
    return NextResponse.json({ error: 'userId and title are required' }, { status: 400 })
  }

  const result = await sendPushNotification({
    userId,
    title,
    body: notifBody ?? '',
    url,
  })
  return NextResponse.json(result)
})
