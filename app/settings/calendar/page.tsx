'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar, Check, Link2, Copy, ExternalLink, AlertCircle,
  ChevronDown, Clock, Globe, Zap,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
]

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
]

const DURATIONS = [15, 20, 30, 45, 60, 90]

export default function CalendarSettingsPage() {
  const { user }        = useAuth()
  const searchParams    = useSearchParams()

  const isConnected    = searchParams.get('connected') === 'true'
  const authError      = searchParams.get('error')

  // Derive default slug from user name
  const defaultSlug = user?.name
    ? user.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : ''

  const [loading, setSaving]      = useState(false)
  const [saved, setSaved]         = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [settings, setSettings]   = useState<Record<string, unknown> | null>(null)
  const [fetching, setFetching]   = useState(true)
  const [copied, setCopied]       = useState(false)

  // Form state
  const [slug, setSlug]                   = useState(defaultSlug)
  const [title, setTitle]                 = useState('Book a Call')
  const [description, setDescription]     = useState('')
  const [duration, setDuration]           = useState(30)
  const [buffer, setBuffer]               = useState(15)
  const [timezone, setTimezone]           = useState('America/Chicago')
  const [availableDays, setAvailableDays] = useState([1, 2, 3, 4, 5])
  const [availableStart, setStart]        = useState('09:00')
  const [availableEnd, setEnd]            = useState('17:00')

  const bookingLink = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${slug}`
    : `/book/${slug}`

  const googleConnected = Boolean((settings as { google_refresh_token?: string | null } | null)?.google_refresh_token)

  // Load existing settings
  useEffect(() => {
    if (!user?.email) return
    fetch(`/api/calendar/settings?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setSettings(data)
          setSlug(data.slug        ?? defaultSlug)
          setTitle(data.title      ?? 'Book a Call')
          setDescription(data.description ?? '')
          setDuration(data.duration ?? 30)
          setBuffer(data.buffer     ?? 15)
          setTimezone(data.timezone ?? 'America/Chicago')
          setAvailableDays(data.available_days ?? [1,2,3,4,5])
          setStart(data.available_start ?? '09:00')
          setEnd(data.available_end     ?? '17:00')
        }
        setFetching(false)
      })
      .catch(() => setFetching(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  async function handleSave() {
    if (!user?.email) return
    setSaving(true)
    await fetch('/api/calendar/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail:      user.email,
        userName:       user.name,
        slug:           slug || defaultSlug,
        title,
        description:    description || null,
        duration,
        buffer,
        timezone,
        availableDays,
        availableStart,
        availableEnd,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleConnectGoogle() {
    if (!user?.email) return
    setConnecting(true)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      alert('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Add your Google OAuth client ID to your environment variables.')
      setConnecting(false)
      return
    }
    const res = await fetch('/api/calendar/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: user.email,
        userName:  user.name,
        slug:      slug || defaultSlug,
      }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error || 'Failed to start Google auth.')
      setConnecting(false)
    }
  }

  function toggleDay(day: number) {
    setAvailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#f9fafb]">
        <Header title="Calendar Settings" />
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-[#015035] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header title="Calendar Settings" />

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

        {/* Status banners */}
        {isConnected && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-green-700 font-medium">Google Calendar connected successfully!</span>
          </div>
        )}
        {authError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-600">Google auth error: {decodeURIComponent(authError)}</span>
          </div>
        )}

        {/* ── Google Calendar Connection ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Google Calendar</div>
              <div className="text-xs text-gray-500">Sync bookings and check availability in real time</div>
            </div>
            {googleConnected && (
              <span className="ml-auto text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
          </div>

          {!googleConnected ? (
            <button
              onClick={handleConnectGoogle}
              disabled={connecting}
              className="flex items-center gap-2 bg-[#012b1e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#015035] disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              {connecting ? 'Redirecting to Google…' : 'Connect Google Calendar'}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Your Google Calendar is connected. New bookings will automatically appear in your calendar and attendees will receive Google Meet links.
              </p>
              <button
                onClick={handleConnectGoogle}
                disabled={connecting}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Reconnect / change account
              </button>
            </div>
          )}
        </div>

        {/* ── Booking Link ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Link2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-sm font-bold text-gray-900">Your Booking Link</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Link slug (URL-friendly, no spaces)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#015035]/30">
                <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap">/book/</span>
                <input
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  placeholder="your-name"
                />
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={`/book/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview
              </a>
            </div>
          </div>
        </div>

        {/* ── Meeting Details ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-sm font-bold text-gray-900">Meeting Details</div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title shown to clients</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Discovery Call, Strategy Session"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What should clients know before booking?"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duration</label>
              <div className="relative">
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 appearance-none pr-8"
                >
                  {DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Buffer after meeting</label>
              <div className="relative">
                <select
                  value={buffer}
                  onChange={e => setBuffer(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 appearance-none pr-8"
                >
                  {[0, 5, 10, 15, 20, 30].map(b => <option key={b} value={b}>{b} min buffer</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Availability ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#015035]" />
            </div>
            <div className="text-sm font-bold text-gray-900">Availability</div>
          </div>

          {/* Days of week */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Days</label>
            <div className="flex gap-2">
              {DAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-lg text-xs font-semibold transition-all ${
                    availableDays.includes(day.value)
                      ? 'bg-[#012b1e] text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Time</label>
              <input
                type="time"
                value={availableStart}
                onChange={e => setStart(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Time</label>
              <input
                type="time"
                value={availableEnd}
                onChange={e => setEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Timezone</label>
            <div className="relative">
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 appearance-none pr-8"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── Save ── */}
        <div className="flex items-center justify-between">
          <a href="/calendar" className="text-sm text-gray-500 hover:text-gray-800">
            ← View Bookings
          </a>
          <button
            onClick={handleSave}
            disabled={loading || saved}
            className="flex items-center gap-2 bg-[#012b1e] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#015035] disabled:opacity-60 transition-colors"
          >
            {saved ? (
              <><Check className="w-4 h-4" /> Saved!</>
            ) : loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
