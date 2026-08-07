'use client'

import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'

type ConsentValue = 'accepted' | 'declined'

const STORAGE_KEY = 'gravhub_cookie_consent'
const COOKIE_NAME = 'gravhub_cookie_consent'

function setCookie(value: string) {
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${365 * 86400};SameSite=Lax`
}

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
    setCookie('accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setCookie('declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    // z-[45]: above every piece of page chrome (the highest is z-40 — header
    // dropdowns, the mobile sidebar backdrop, the FAB) and below every modal,
    // which start at z-50. At z-[9999] this banner sat on top of all of them,
    // and since it is a full-width bar pinned to the bottom of the viewport it
    // covered the footer — the row with the submit button — of any modal tall
    // enough to reach it. On a 1280x720 viewport that was measurably true of
    // the Add Keyword modal: the banner's box ran from y=507 to y=720 and the
    // "Add Keyword" button sat at y=626, so `elementFromPoint` at the button's
    // centre returned the banner. A first-time visitor could not submit the
    // form at all, and nothing about it looked broken. See AUDIT #785.
    //
    // pointer-events-none on the wrapper because its padding is transparent
    // but was still swallowing clicks on whatever sat behind it.
    <div className="fixed bottom-0 left-0 right-0 z-[45] p-4 sm:p-6 pointer-events-none">
      <div
        className="mx-auto max-w-2xl rounded-2xl shadow-2xl border border-white/10 px-5 py-4 sm:px-6 sm:py-5 pointer-events-auto"
        style={{ background: '#015035' }}
      >
        <div className="flex items-start gap-3">
          <Cookie size={20} className="text-white/80 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold mb-1">We use cookies</p>
            <p className="text-white/70 text-xs leading-relaxed">
              We use cookies and similar technologies to enhance your experience, analyze site traffic, and serve personalized content. By clicking &quot;Accept All&quot; you consent to our use of cookies. See our{' '}
              <a href="https://www.gravissmarketing.com/privacy" target="_blank" rel="noopener noreferrer" className="text-white/90 underline hover:text-white">Privacy Policy</a> and{' '}
              <a href="https://www.gravissmarketing.com/cookie-policy" target="_blank" rel="noopener noreferrer" className="text-white/90 underline hover:text-white">Cookie Policy</a>.
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
