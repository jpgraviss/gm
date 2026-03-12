'use client'

import { useState, useEffect } from 'react'
import { Calendar, Link2, Copy, Check, Clock, User, Building2, Video, X, ChevronRight, ExternalLink, Mail } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { fetchTeamMembers } from '@/lib/supabase'
import type { TeamMember } from '@/lib/types'

interface Booking {
  id: string
  calendar_slug: string
  client_name: string
  client_email: string
  client_company: string | null
  client_phone: string | null
  notes: string | null
  date: string
  start_time: string
  end_time: string
  timezone: string
  status: string
  meet_link: string | null
  created_at: string
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const p = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${p}`
}

function isUpcoming(date: string, startTime: string) {
  const now    = new Date()
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi]    = startTime.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi) >= now
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Booking | null>(null)
  const [copied, setCopied]         = useState(false)
  const [filter, setFilter]         = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [gcalLinks, setGcalLinks]   = useState<Record<string, string>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [copiedGcal, setCopiedGcal] = useState<string | null>(null)

  // Derive booking link from user's name (slug format)
  const userSlug = user?.name
    ? user.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : null

  const bookingLink = userSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${userSlug}`
    : null

  useEffect(() => {
    const params = userSlug ? `?slug=${userSlug}` : ''
    fetch(`/api/bookings${params}`)
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userSlug])

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const defaults: Record<string, string> = {
          'jonathan@gravissmarketing.com': 'https://calendar.app.google/DdHBsREU2rAyEVoz8',
          'jgraviss@gravissmarketing.com': 'https://calendar.app.google/DdHBsREU2rAyEVoz8',
        }
        const stored = (d?.gcal_links && typeof d.gcal_links === 'object') ? d.gcal_links as Record<string, string> : {}
        setGcalLinks({ ...defaults, ...stored })
      })
      .catch(() => {})
    fetchTeamMembers().then(setTeamMembers)
  }, [])

  const filtered = bookings.filter(b => {
    if (b.status === 'cancelled') return filter === 'past'
    if (filter === 'upcoming') return isUpcoming(b.date, b.start_time)
    if (filter === 'past')     return !isUpcoming(b.date, b.start_time) || b.status === 'cancelled'
    return true
  })

  const upcoming = bookings.filter(b => b.status === 'confirmed' && isUpcoming(b.date, b.start_time))

  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking? The client will need to rebook.')) return
    setCancellingId(id)
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' } : b))
    if (selected?.id === id) setSelected(null)
    setCancellingId(null)
  }

  function copyLink() {
    if (!bookingLink) return
    navigator.clipboard.writeText(bookingLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyGcalLink(email: string, url: string) {
    navigator.clipboard.writeText(url)
    setCopiedGcal(email)
    setTimeout(() => setCopiedGcal(null), 2000)
  }

  const membersWithLinks = teamMembers.filter(m => gcalLinks[m.email])

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header title="Calendar & Bookings" />

      <div className="px-8 py-6">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white border border-gray-100 rounded-lg p-1">
            {(['upcoming', 'past', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-[#012b1e] text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {bookingLink && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-xs">
                <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 truncate font-mono">/book/{userSlug}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 bg-[#012b1e] text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#015035] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={`/settings/calendar`}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Settings
              </a>
            </div>
          )}
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: 'Upcoming Bookings',
              value: upcoming.length,
              icon: Calendar,
              color: 'text-[#015035]',
              bg: 'bg-green-50',
            },
            {
              label: 'This Week',
              value: upcoming.filter(b => {
                const now  = new Date()
                const end  = new Date(now); end.setDate(end.getDate() + 7)
                const [y, m, d] = b.date.split('-').map(Number)
                const bd   = new Date(y, m - 1, d)
                return bd >= now && bd <= end
              }).length,
              icon: Clock,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: 'Total Booked',
              value: bookings.filter(b => b.status === 'confirmed').length,
              icon: User,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</span>
                <div className={`${card.bg} p-2 rounded-lg`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            </div>
          ))}
        </div>

        {/* ── Google Appointment Scheduling Links ── */}
        {(membersWithLinks.length > 0 || user) && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Google Appointment Scheduling</div>
                  <div className="text-xs text-gray-400">Book directly via Google Calendar</div>
                </div>
              </div>
              <a href="/settings/calendar" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                Manage <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            {membersWithLinks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {membersWithLinks.map(m => {
                  const url = gcalLinks[m.email]
                  const isSelf = m.email === user?.email
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isSelf ? 'border-[#015035]/30 bg-green-50/40' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#012b1e' }}>
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{m.name}</div>
                        <div className="text-xs text-gray-400 truncate">{isSelf ? 'My link' : 'Booking link'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => copyGcalLink(m.email, url)}
                          className="p-1.5 rounded-lg hover:bg-white border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy link"
                        >
                          {copiedGcal === m.email ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Open booking page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-2">No appointment scheduling links configured yet.</p>
                <a href="/settings/calendar" className="text-xs text-[#015035] font-semibold hover:underline">
                  Add your Google Calendar link in Settings →
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Bookings list + detail ── */}
        <div className="flex gap-4">
          {/* List */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-[#015035] border-t-transparent rounded-full animate-spin" />
                Loading bookings…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Calendar className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  {filter === 'upcoming' ? 'No upcoming bookings' : 'No bookings to show'}
                </p>
                {bookingLink && (
                  <a
                    href={bookingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#015035] font-medium mt-2 hover:underline flex items-center gap-1"
                  >
                    View your booking page
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <span>Client</span>
                  <span>Date & Time</span>
                  <span>Company</span>
                  <span>Status</span>
                </div>
                {filtered.map(booking => (
                  <button
                    key={booking.id}
                    onClick={() => setSelected(selected?.id === booking.id ? null : booking)}
                    className={`w-full grid grid-cols-[1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 text-left hover:bg-gray-50/80 transition-colors items-center group ${
                      selected?.id === booking.id ? 'bg-green-50/50' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{booking.client_name}</div>
                      <div className="text-xs text-gray-400">{booking.client_email}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-800">{formatDate(booking.date)}</div>
                      <div className="text-xs text-gray-400">{formatTime(booking.start_time)} · {booking.timezone}</div>
                    </div>
                    <div className="text-sm text-gray-600">{booking.client_company || '—'}</div>
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        booking.status === 'confirmed' && isUpcoming(booking.date, booking.start_time)
                          ? 'bg-green-100 text-green-700'
                          : booking.status === 'cancelled'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {booking.status === 'confirmed' && !isUpcoming(booking.date, booking.start_time)
                          ? 'Completed'
                          : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Booking Details</h3>
                <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div>
                <div className="w-10 h-10 rounded-full bg-[#012b1e] flex items-center justify-center mb-3">
                  <span className="text-white text-sm font-bold">
                    {selected.client_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="font-semibold text-gray-900 text-sm">{selected.client_name}</div>
                <div className="text-xs text-gray-500">{selected.client_email}</div>
                {selected.client_company && (
                  <div className="text-xs text-gray-500">{selected.client_company}</div>
                )}
                {selected.client_phone && (
                  <div className="text-xs text-gray-500">{selected.client_phone}</div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {formatDate(selected.date)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {formatTime(selected.start_time)} – {formatTime(selected.end_time)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {selected.timezone}
                </div>
              </div>

              {selected.notes && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
                  <p className="text-xs text-gray-600 leading-relaxed">{selected.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                {selected.meet_link && (
                  <a
                    href={selected.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#012b1e] text-white rounded-lg py-2 text-xs font-semibold hover:bg-[#015035] transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join Google Meet
                  </a>
                )}
                <a
                  href={`mailto:${selected.client_email}`}
                  className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-600 rounded-lg py-2 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Client
                </a>
                {selected.status === 'confirmed' && isUpcoming(selected.date, selected.start_time) && (
                  <button
                    onClick={() => handleCancel(selected.id)}
                    disabled={cancellingId === selected.id}
                    className="w-full border border-red-200 text-red-500 rounded-lg py-2 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {cancellingId === selected.id ? 'Cancelling…' : 'Cancel Booking'}
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-400">Booked {new Date(selected.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
