import webPush from 'web-push'
import { createServiceClient } from './supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:info@gravissmarketing.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// AUDIT #747 — the browser-side helpers (getVapidPublicKey, requestPermission,
// subscribeToPush, unsubscribeFromPush) used to live here too and had zero
// callers, because nothing marked 'use client' can import this module: it
// pulls in `web-push` and `createServiceClient` above and calls
// setVapidDetails() as a module side effect. They now live in
// lib/push-client.ts, which has no server imports and is genuinely usable
// from a component.

export async function sendPushNotification({
  userId,
  title,
  body,
  url,
}: {
  userId: string
  title: string
  body: string
  url?: string
}): Promise<{ sent: number; failed: number }> {
  const db = createServiceClient()
  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, failed: 0 }

  const payload = JSON.stringify({ title, body, url: url ?? '/' })
  let sent = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        )
        sent++
      } catch (err: unknown) {
        failed++
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }),
  )

  return { sent, failed }
}
