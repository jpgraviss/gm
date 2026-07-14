'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Next.js App Router client-side navigation has no built-in "% of page
// loaded" signal to hook into — there's no equivalent of the old Pages
// Router's router.events, and no per-resource progress API for RSC
// payload fetches. Every real percentage-loading-bar implementation
// (YouTube, GitHub, nprogress, nextjs-toploader) is the same trick: start
// a simulated percentage climbing toward ~90% the moment navigation is
// clearly starting, then snap to 100% and fade out once the new page has
// actually mounted (usePathname()/useSearchParams() changing is the
// closest real signal we have for "the new route is now rendering").
//
// Navigation start is detected via a capturing document click listener on
// internal <a> tags (covers next/link — used throughout Sidebar.tsx and
// everywhere else in the app) rather than patching next/navigation's
// router, which would be far more invasive for the same result.

const FADE_OUT_MS = 250
const MAX_STUCK_MS = 6000 // safety net if a click never actually navigates (e.g. opens a modal instead)

function isInternalNavigationClick(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null
  const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!anchor) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  const href = anchor.getAttribute('href') ?? ''
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
  // Only same-origin, app-relative links count as an in-app page load.
  if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return null
  return href
}

export default function PageLoadingOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const [progress, setProgress] = useState(0)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stuckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetHrefRef = useRef<string | null>(null)
  const currentKeyRef = useRef(`${pathname}?${searchParams?.toString() ?? ''}`)

  function clearTimers() {
    if (tickRef.current) clearInterval(tickRef.current)
    if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current)
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    tickRef.current = null
    stuckTimeoutRef.current = null
    fadeTimeoutRef.current = null
  }

  function startLoading() {
    clearTimers()
    targetHrefRef.current = null
    setFading(false)
    setVisible(true)
    setProgress(8) // immediate jump so it never feels like a dead click

    tickRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        // Diminishing increments — fast at first, crawls as it approaches
        // 90%, since real completion time is unknown.
        const remaining = 90 - prev
        return prev + Math.max(0.5, remaining * 0.08)
      })
    }, 120)

    stuckTimeoutRef.current = setTimeout(() => finishLoading(), MAX_STUCK_MS)
  }

  function finishLoading() {
    clearTimers()
    setProgress(100)
    setFading(true)
    fadeTimeoutRef.current = setTimeout(() => {
      setVisible(false)
      setFading(false)
      setProgress(0)
    }, FADE_OUT_MS)
  }

  // Navigation start: clicking any internal link.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const href = isInternalNavigationClick(e)
      if (!href) return
      const [hrefPath] = href.split('#')
      if (hrefPath === currentKeyRef.current || hrefPath === pathname) return
      targetHrefRef.current = hrefPath
      startLoading()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Navigation complete: the route actually changed.
  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ''}`
    const changed = key !== currentKeyRef.current
    currentKeyRef.current = key
    if (changed && tickRef.current) {
      finishLoading()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  useEffect(() => clearTimers, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity"
      style={{
        background: 'rgba(255,255,255,0.85)',
        opacity: fading ? 0 : 1,
        transitionDuration: `${FADE_OUT_MS}ms`,
      }}
    >
      <div className="flex flex-col items-center gap-4 w-56">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#015035', borderTopColor: 'transparent' }}
        />
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(1,80,53,0.12)' }}>
          <div
            className="h-full rounded-full transition-[width] ease-out"
            style={{ width: `${progress}%`, background: '#015035', transitionDuration: '120ms' }}
          />
        </div>
        <p
          className="text-xs font-semibold tracking-widest text-gray-400 tabular-nums"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          LOADING&nbsp;&middot;&nbsp;{Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}
