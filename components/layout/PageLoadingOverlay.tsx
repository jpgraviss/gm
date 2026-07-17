'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import LoadingScreen from '@/components/ui/LoadingScreen'

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
// LoadingScreen's ring has its own 200ms stroke-dashoffset transition when
// progress jumps to 100. Hold here, fully opaque, until that's had time to
// finish before the opacity fade starts — otherwise (previously) both ran
// concurrently and the ring was already mostly transparent by the time it
// visually closed, so on a fast navigation it never read as "done" at all.
const HOLD_AT_100_MS = 220

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
    fadeTimeoutRef.current = setTimeout(() => {
      setFading(true)
      fadeTimeoutRef.current = setTimeout(() => {
        setVisible(false)
        setFading(false)
        setProgress(0)
      }, FADE_OUT_MS)
    }, HOLD_AT_100_MS)
  }

  // Navigation start: clicking any internal link. Stays on the capture
  // phase so it still fires even if a deeper handler calls
  // stopPropagation() — but the actual defaultPrevented check is deferred
  // to a microtask, which runs after the full capture+bubble dispatch has
  // finished. Checking it synchronously here (in capture phase) would
  // always see e.defaultPrevented === false, since the clicked element's
  // own bubble-phase onClick (which might call preventDefault() to cancel
  // navigation for a non-navigation action) hasn't run yet.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const href = isInternalNavigationClick(e)
      if (!href) return
      const [hrefPath] = href.split('#')
      if (hrefPath === currentKeyRef.current || hrefPath === pathname) return
      queueMicrotask(() => {
        if (e.defaultPrevented) return
        targetHrefRef.current = hrefPath
        startLoading()
      })
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
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity"
      style={{
        background: 'rgba(255,255,255,0.85)',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
        transitionDuration: `${FADE_OUT_MS}ms`,
      }}
    >
      <LoadingScreen progress={progress} label="Loading" />
    </div>
  )
}
