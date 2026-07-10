'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on every page load so offline caching
 * (sw.js already implements cache-first for static assets, network-first
 * w/ cache fallback for API calls and HTML navigations) benefits everyone,
 * not just users who've opted into push notifications — previously this
 * only registered inside PushNotificationBanner's "Enable" click handler.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {/* non-blocking */})
  }, [])

  return null
}
