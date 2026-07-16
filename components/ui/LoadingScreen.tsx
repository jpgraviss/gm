'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The one loading indicator used everywhere in the app — page/section
 * loading gates, route transitions (see PageLoadingOverlay), everything.
 * A custom circular progress ring (not the generic CSS spin circle) with
 * the percentage centered inside it and a label below.
 *
 * Real navigation/data-fetch progress has no per-resource "% complete"
 * signal to hook into, so when `progress` isn't passed in, this animates
 * a perceived-progress climb toward ~92% and holds there — the same
 * honest technique used by YouTube/GitHub/nprogress-style loaders. It
 * never claims 100% until the caller actually has the real data and
 * unmounts this (or passes progress={100} itself).
 */

interface LoadingScreenProps {
  label?: string
  fullScreen?: boolean
  progress?: number // controlled 0-100; omit for auto-simulated perceived progress
  size?: number
  className?: string
}

const DEFAULT_SIZE = 84
const STROKE = 6

export default function LoadingScreen({ label = 'Loading', fullScreen = false, progress, size = DEFAULT_SIZE, className }: LoadingScreenProps) {
  const [simulated, setSimulated] = useState(10)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const controlled = progress !== undefined

  useEffect(() => {
    if (controlled) return
    tickRef.current = setInterval(() => {
      setSimulated(prev => {
        if (prev >= 92) return prev
        const remaining = 92 - prev
        return prev + Math.max(0.4, remaining * 0.06)
      })
    }, 150)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [controlled])

  const pct = Math.max(0, Math.min(100, controlled ? (progress as number) : simulated))
  const radius = (size - STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct / 100)
  const fontSize = Math.round(size * 0.22)

  const content = (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(1,80,53,0.12)" strokeWidth={STROKE} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="#015035" strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
          />
        </svg>
        {/* Accent arc spins continuously as a "still working" motion cue,
            independent of the progress ring underneath it. */}
        <svg
          width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 animate-spin"
          style={{ animationDuration: '1.3s' }}
        >
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke="#CC7853" strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${circumference * 0.14} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold tabular-nums"
            style={{ color: '#015035', fontFamily: 'var(--font-heading)', fontSize }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      {label && (
        <p
          className="text-xs font-semibold tracking-widest text-gray-400 uppercase"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {label}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center w-full py-16">
      {content}
    </div>
  )
}
