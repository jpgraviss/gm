'use client'

/**
 * Browser half of push notifications (AUDIT #747).
 *
 * These functions used to live in `lib/push-notifications.ts` alongside
 * `sendPushNotification()`. That module imports `web-push` and
 * `createServiceClient` at the top level and calls `webPush.setVapidDetails()`
 * as a module side effect, so a `'use client'` component cannot import it —
 * which is why `subscribeToPush`/`unsubscribeFromPush`/`getVapidPublicKey`
 * sat there with zero callers while `PushNotificationBanner` reimplemented
 * subscription inline, base64 decoder and all.
 *
 * Two copies of the same protocol handling is where drift lives, and the
 * copies had already diverged: only this one had an unsubscribe path, and
 * nothing in the product could reach it. Splitting the client half into its
 * own module makes the shared code importable, so there is one
 * implementation again.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

/** True when this browser can do push at all — checked before showing any UI for it. */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window
}

/** Whether this browser currently holds a live push subscription. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  return Notification.requestPermission()
}

/**
 * Subscribes this browser and registers the subscription server-side.
 *
 * Throws with a message meant for a toast. The caller shows it; this doesn't
 * swallow failures, because a silent failure here looks identical to success
 * and the user is left believing push is on.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('This browser does not support push notifications')
  if (!VAPID_PUBLIC_KEY) throw new Error('Push notifications are not configured on this server')

  await navigator.serviceWorker.register('/sw.js')

  const permission = await requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site — allow them in your browser settings first'
      : 'Notification permission was not granted')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!res.ok) {
    // AUDIT #256 — a failed server call previously left the browser holding
    // a live Push subscription with no corresponding push_subscriptions
    // row, silently defeating every future sendPushNotification(). Undo the
    // browser side so a retry is possible instead of a permanently
    // half-enabled state that looks enabled to the user.
    await subscription.unsubscribe().catch(() => {})
    throw new Error('Failed to register push notifications. Please try again.')
  }

  return subscription
}

/**
 * Unsubscribes this browser and removes the server-side row.
 *
 * The server row is deleted FIRST. If the order were reversed and the DELETE
 * failed, the row would be orphaned with no browser subscription behind it,
 * and every send to it would fail until a 410 eventually pruned it.
 */
export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription()
  if (!subscription) return

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })

  await subscription.unsubscribe()
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
