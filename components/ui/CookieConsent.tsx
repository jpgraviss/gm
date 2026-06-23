'use client'

import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'

type ConsentValue = 'accepted' | 'declined'

const STORAGE_KEY = 'gravhub_cookie_consent'

export function getCookieConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY) as ConsentValue | null
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY)
    if (consent) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6">
      <div
        className="mx-auto max-w-2xl rounded-2xl shadow-2xl border border-white/10 px-5 py-4 sm:px-6 sm:py-5"
        style={{ background: '#015035' }}
      >
        <div className="flex items-start gap-3">
          <Cookie size={20} className="text-white/80 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold mb-1">We use cookies</p>
            <p className="text-white/70 text-xs leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze site traffic, and serve personalized content. By clicking &quot;Accept All&quot; you consent to our use of cookies.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={accept}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors bg-white hover:bg-gray-100"
                style={{ color: '#015035' }}
              >
                Accept All
              </button>
              <button
                onClick={decline}
                className="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              >
                Decline
              </button>
            </div>
          </div>
          <button
            onClick={decline}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Dismiss cookie banner"
          >
            <X size={14} className="text-white/50" />
          </button>
        </div>
      </div>
    </div>
  )
}
