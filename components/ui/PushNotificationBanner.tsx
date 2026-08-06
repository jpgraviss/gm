'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { isPushSupported, subscribeToPush } from '@/lib/push-client'

export default function PushNotificationBanner() {
  const { toast } = useToast()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (Notification.permission !== 'default') return
    const dismissed = localStorage.getItem('gravhub_push_dismissed')
    if (dismissed) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  async function enable() {
    setVisible(false)
    try {
      // AUDIT #747 — this used to reimplement the whole subscribe flow
      // inline (its own base64 decoder included) because lib/push-notifications.ts
      // couldn't be imported from a client component. lib/push-client.ts is
      // that logic, now shared with the Settings toggle so the two can't drift.
      await subscribeToPush()
      toast('Push notifications enabled', 'success')
    } catch (err) {
      console.error('[push] registration failed:', err)
      toast(err instanceof Error ? err.message : 'Failed to enable push notifications. Please try again.', 'error')
    }
  }

  function dismiss() {
    setVisible(false)
    localStorage.setItem('gravhub_push_dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-shrink-0" style={{ background: '#015035' }}>
      <div className="flex items-center gap-2 text-white text-sm">
        <Bell size={15} />
        <span className="font-medium">Enable push notifications to stay updated on deals, tasks, and tickets.</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={enable}
          className="px-3 py-1 rounded-lg text-xs font-bold transition-colors"
          style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
        >
          Enable
        </button>
        <button
          onClick={dismiss}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={14} className="text-white/60" />
        </button>
      </div>
    </div>
  )
}
