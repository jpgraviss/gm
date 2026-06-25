'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar, Check, Link2, Copy, ExternalLink, AlertCircle,
  ChevronDown, Clock, Globe, Zap, RefreshCw, Plus, Trash2, X, Rss,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'

interface CalendarSubscription {
  id: string
  user_email: string
  name: string
  ical_url: string
  last_synced_at: string | null
  event_count: number
  created_at: string
}

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
  const [gcalLink, setGcalLink]   = useState('')
  const [allGcalLinks, setAllGcalLinks] = useState<Record<string, string>>({})
  const [fetching, setFetching]   = useState(true)
  const [copied, setCopied]       = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([])
  const [showAddSub, setShowAddSub] = useState(false)
  const [subUrl, setSubUrl] = useState('')
  const [subName, setSubName] = useState('')
  const [addingSub, setAddingSub] = useState(false)
  const [syncingSubId, setSyncingSubId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null)
  const [copiedFeed, setCopiedFeed] = useState(false)

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

  const calendarId = (settings as { id?: string } | null)?.id ?? ''
  const feedUrl = typeof window !== 'undefined' && calendarId
    ? `${window.location.origin}/api/calendar/feed/${calendarId}`
    : ''

  const googleConnected = Boolean((settings as { google_refresh_token?: string | null } | null)?.google_refresh_token)

  function copyFeedUrl() {
    if (!feedUrl) return
    navigator.clipboard.writeText(feedUrl)
    setCopiedFeed(true)
    setTimeout(() => setCopiedFeed(false), 2000)
  }

  // Load existing settings
  useEffect(() => {
    if (!user?.email) return
    // Load calendar settings and global settings in parallel
    Promise.all([
      fetch(`/api/calendar/settings?email=${encodeURIComponent(user.email)}`).then(r => r.ok ? r.json() : null).catch(() => { console.warn('Failed to load calendar settings'); return null }),
      fetch('/api/settings').then(r => r.ok ? r.json() : null).catch(() => { console.warn('Failed to load global settings'); return null }),
    ]).then(([calData, globalData]) => {
      if (calData && !calData.error) {
        setSettings(calData)
        setSlug(calData.slug        ?? defaultSlug)
        setTitle(calData.title      ?? 'Book a Call')
        setDescription(calData.description ?? '')
        setDuration(calData.duration ?? 30)
        setBuffer(calData.buffer     ?? 15)
        setTimezone(calData.timezone ?? 'America/Chicago')
        setAvailableDays(calData.available_days ?? [1,2,3,4,5])
        setStart(calData.available_start ?? '09:00')
        setEnd(calData.available_end     ?? '17:00')
      }
      const stored = (globalData?.gcal_links && typeof globalData.gcal_links === 'object') ? globalData.gcal_links as Record<string, string> : {}
      const links = stored
      setAllGcalLinks(links)
      if (user?.email && links[user.email]) setGcalLink(links[user.email])
      setFetching(false)
    })
    fetch(`/api/calendar/subscriptions${user?.email ? `?email=${encodeURIComponent(user.email)}` : ''}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setSubscriptions(d) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  async function handleSave() {
    if (!user?.email) return
    setSaving(true)
    const updatedLinks = { ...allGcalLinks, [user.email]: gcalLink }
    await Promise.all([
      fetch('/api/calendar/settings', {
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
      }),
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gcalLinks: updatedLinks }),
      }),
    ])
    setAllGcalLinks(updatedLinks)
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

  async function handleSyncNow() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      const parts: string[] = []
      if (data.synced) parts.push(`${data.synced} pulled`)
      if (data.pushed) parts.push(`${data.pushed} pushed`)
      if (data.errors) parts.push(`${data.errors} error${data.errors !== 1 ? 's' : ''}`)
      setSyncResult(parts.length ? parts.join(', ') : 'Up to date')
      setTimeout(() => setSyncResult(null), 5000)
    } catch {
      setSyncResult('Sync failed')
      setTimeout(() => setSyncResult(null), 5000)
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddSubscription() {
    if (!subUrl.trim()) return
    setAddingSub(true)
    try {
      const res = await fetch('/api/calendar/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: subUrl.trim(), name: subName.trim() || undefined, userEmail: user?.email || '' }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubscriptions(prev => [{ id: data.id, user_email: user?.email || '', name: data.name, ical_url: subUrl.trim(), last_synced_at: new Date().toISOString(), event_count: data.total, created_at: new Date().toISOString() }, ...prev])
        setSubUrl('')
        setSubName('')
        setShowAddSub(false)
      }
    } catch { /* ignore */ }
    setAddingSub(false)
  }

  async function handleSyncSubscription(id: string) {
    setSyncingSubId(id)
    try {
      const res = await fetch('/api/calendar/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, last_synced_at: new Date().toISOString(), event_count: data.synced } : s))
      }
    } catch { /* ignore */ }
    setSyncingSubId(null)
  }

  async function handleDeleteSubscription(id: string) {
    if (!confirm('Remove this calendar subscription and all its imported events?')) return
    setDeletingSubId(id)
    try {
      await fetch('/api/calendar/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setSubscriptions(prev => prev.filter(s => s.id !== id))
    } catch { /* ignore */ }
    setDeletingSubId(null)
  }

  async function handleSyncAllSubscriptions() {
    setSyncingAll(true)
    try {
      await fetch('/api/calendar/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all', userEmail: user?.email || '' }),
      })
      const res = await fetch(`/api/calendar/subscriptions${user?.email ? `?email=${encodeURIComponent(user.email)}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setSubscriptions(data)
      }
    } catch { /* ignore */ }
    setSyncingAll(false)
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
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Your Google Calendar is connected. New bookings will automatically appear in your calendar and attendees will receive Google Meet links.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex items-center gap-1.5 bg-[#012b1e] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#015035] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  onClick={handleConnectGoogle}
                  disabled={connecting}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Reconnect / change account
                </button>
                {syncResult && (
                  <span className="text-xs text-gray-500">{syncResult}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Apple Calendar ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Apple Calendar</div>
              <div className="text-xs text-gray-500">Subscribe from Apple Calendar, iCal, or any app that supports iCal feeds</div>
            </div>
          </div>
          {feedUrl ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Paste this URL into Apple Calendar (File &rarr; New Calendar Subscription) or any calendar app that supports iCal feeds.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                  <span className="px-3 py-2 text-xs text-gray-400 border-r border-gray-200 flex-shrink-0">
                    <Rss className="w-3.5 h-3.5" />
                  </span>
                  <input
                    readOnly
                    value={feedUrl}
                    className="flex-1 px-3 py-2 text-xs text-gray-600 bg-transparent focus:outline-none"
                  />
                </div>
                <button
                  onClick={copyFeedUrl}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {copiedFeed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedFeed ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Save your calendar settings first to generate your iCal feed URL.</p>
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

        {/* ── Google Appointment Scheduling Link ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">Google Appointment Scheduling Link</div>
              <div className="text-xs text-gray-500">Paste your calendar.app.google link — clients can book directly in Google Calendar</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={gcalLink}
              onChange={e => setGcalLink(e.target.value)}
              placeholder="https://calendar.app.google/..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            />
            {gcalLink && (
              <a
                href={gcalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Find this in Google Calendar → Create → Appointment Schedule → View booking page, then copy the URL.
          </p>
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

        {/* ── Calendar Subscriptions ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Calendar Subscriptions</div>
                <div className="text-xs text-gray-500">Import events from external calendars via iCal URLs</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {subscriptions.length > 0 && (
                <button
                  onClick={handleSyncAllSubscriptions}
                  disabled={syncingAll}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  {syncingAll ? 'Syncing...' : 'Sync All'}
                </button>
              )}
              <button
                onClick={() => setShowAddSub(true)}
                className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-colors"
                style={{ background: '#015035' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Calendar
              </button>
            </div>
          </div>

          {subscriptions.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No calendar subscriptions yet.</p>
              <p className="text-xs text-gray-400 mt-1">Add an iCal URL to import events from external calendars.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subscriptions.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{sub.name}</div>
                    <div className="text-xs text-gray-400 truncate">{sub.ical_url}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {sub.event_count} event{sub.event_count !== 1 ? 's' : ''}
                      {sub.last_synced_at && (
                        <span> · Last synced {new Date(sub.last_synced_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleSyncSubscription(sub.id)}
                      disabled={syncingSubId === sub.id}
                      className="p-1.5 rounded-lg hover:bg-white border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                      title="Sync"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingSubId === sub.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteSubscription(sub.id)}
                      disabled={deletingSubId === sub.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 border border-gray-200 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {showAddSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Add Calendar Subscription</h3>
              <button onClick={() => { setShowAddSub(false); setSubUrl(''); setSubName('') }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Paste an iCal subscription URL to import all events.</p>
            <input
              value={subName}
              onChange={e => setSubName(e.target.value)}
              placeholder="Calendar name (optional, auto-detected from ICS)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />
            <input
              value={subUrl}
              onChange={e => setSubUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              onKeyDown={e => e.key === 'Enter' && handleAddSubscription()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddSubscription}
                disabled={!subUrl.trim() || addingSub}
                className="flex-1 flex items-center justify-center gap-2 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {addingSub ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => { setShowAddSub(false); setSubUrl(''); setSubName('') }}
                className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
