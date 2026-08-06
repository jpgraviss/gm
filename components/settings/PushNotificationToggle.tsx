'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  isPushSupported, getPushSubscription, getVapidPublicKey,
  subscribeToPush, unsubscribeFromPush,
} from '@/lib/push-client'

/**
 * Turn browser push on or off (AUDIT #747).
 *
 * `unsubscribeFromPush()` and `DELETE /api/push/subscribe` were both built
 * and both unreachable — the only way to enable push was the one-time banner
 * that appears while `Notification.permission === 'default'`, and there was
 * no way to turn it off from anywhere in the product. A user who changed
 * their mind had to go into browser site settings, which revokes permission
 * without deleting the `push_subscriptions` row; that row then keeps being
 * sent to until a 410 eventually prunes it.
 *
 * It lives in Settings > Notifications next to the per-event channel matrix,
 * which is where someone looks after picking "push" for a row and finding
 * nothing arrives.
 */
export default function PushNotificationToggle() {
  const { toast } = useToast()
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Distinguishes "we haven't looked yet" from "looked, not subscribed" —
  // without it the control flashes "Off" on every mount.
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    if (!isPushSupported()) { setSupported(false); setChecked(true); return }
    setSubscribed(await getPushSubscription() !== null)
    setChecked(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function toggle() {
    setBusy(true)
    try {
      if (subscribed) {
        await unsubscribeFromPush()
        toast('Push notifications turned off for this browser', 'success')
      } else {
        await subscribeToPush()
        toast('Push notifications enabled for this browser', 'success')
      }
    } catch (err) {
      // subscribeToPush throws with a message written for exactly this spot —
      // "blocked in your browser settings" is actionable, "failed" is not.
      toast(err instanceof Error ? err.message : 'Could not change push notifications', 'error')
    } finally {
      // Re-read the real browser state rather than assuming the toggle
      // succeeded: a partial failure that left the subscription in place
      // would otherwise show "Off" while pushes kept arriving.
      await refresh()
      setBusy(false)
    }
  }

  const configured = getVapidPublicKey() !== ''

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
        Browser Push
      </h3>
      <p className="text-xs text-gray-400 mb-5">
        Controls this browser only. Each device you sign in from needs its own.
      </p>

      {!supported ? (
        <p className="text-sm text-gray-500">This browser doesn&apos;t support push notifications.</p>
      ) : !configured ? (
        <p className="text-sm text-gray-500">
          Push notifications aren&apos;t configured on this server yet — no VAPID key is set.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: subscribed ? '#01503514' : '#9ca3af14', color: subscribed ? '#015035' : '#6b7280' }}
            >
              {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-700 font-medium">
                {!checked ? 'Checking…' : subscribed ? 'On for this browser' : 'Off for this browser'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {subscribed
                  ? 'Events set to a push channel above will appear as system notifications.'
                  : 'Events set to a push channel above won’t reach this browser until it’s on.'}
              </p>
            </div>
          </div>

          <button
            onClick={toggle}
            disabled={busy || !checked}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={subscribed
              ? { border: '1px solid #e5e7eb', color: '#374151' }
              : { background: '#015035', color: '#fff' }}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {subscribed ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      )}
    </div>
  )
}
