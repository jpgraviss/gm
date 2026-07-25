import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push-notifications'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

// AUDIT — this had no restriction beyond being staff: any Team Member could
// POST an arbitrary {userId, title, body, url} and push a real notification
// — attacker-chosen content and click-through URL — to ANY other team
// member's device, with no rate limit. Nothing in the app actually calls
// this route (every real push send, e.g. automations-engine.ts, calls
// sendPushNotification() directly in-process) but it was fully reachable.
// Restricted to self-only, which still supports a legitimate "send myself a
// test notification" use case without the cross-user phishing/spam vector.
export const POST = withErrorHandler('push/send POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const body = await req.json()
  const { userId, title, body: notifBody, url } = body

  if (!userId || !title) {
    return NextResponse.json({ error: 'userId and title are required' }, { status: 400 })
  }
  if (userId !== actor?.userId) {
    return NextResponse.json({ error: 'Can only send a push notification to yourself' }, { status: 403 })
  }

  const result = await sendPushNotification({
    userId,
    title,
    body: notifBody ?? '',
    url,
  })
  return NextResponse.json(result)
})
