'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

export default function PushNotificationBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission !== 'default') return
    const dismissed = localStorage.getItem('gravhub_push_dismissed')
    if (dismissed) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  async function enable() {
    setVisible(false)
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js')
      }
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return

        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i)
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        })

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
      }
    } catch (err) {
      console.error('[push] registration failed:', err)
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
