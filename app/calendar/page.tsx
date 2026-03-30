'use client'

import { useState, useEffect } from 'react'
import { Calendar, Link2, Copy, Check, Clock, User, Building2, Video, X, ChevronLeft, ChevronRight, ExternalLink, Mail, RefreshCw } from 'lucide-react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { fetchTeamMembers } from '@/lib/supabase'
import type { TeamMember } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'

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
  const { toast } = useToast()
  const [bookings, setBookings]     = useState<Booking[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Booking | null>(null)
  const [copied, setCopied]         = useState(false)
  const [filter, setFilter]         = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [gcalLinks, setGcalLinks]   = useState<Record<string, string>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [copiedGcal, setCopiedGcal] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month')

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
      .then(r => r.ok ? r.json() : [])
      .then(d => { setBookings(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { toast('Failed to load bookings', 'error'); setLoading(false) })
  }, [userSlug])

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const stored = (d?.gcal_links && typeof d.gcal_links === 'object') ? d.gcal_links as Record<string, string> : {}
        setGcalLinks(stored)
        if (d?.last_calendar_sync) setLastSync(d.last_calendar_sync)
      })
      .catch(() => toast('Failed to load calendar settings', 'error'))
    fetchTeamMembers().then(d => { if (Array.isArray(d)) setTeamMembers(d) }).catch(() => {})
  }, [])

  const filteredByTab = bookings.filter(b => {
    if (b.status === 'cancelled') return filter === 'past'
    if (filter === 'upcoming') return isUpcoming(b.date, b.start_time)
    if (filter === 'past')     return !isUpcoming(b.date, b.start_time) || b.status === 'cancelled'
    return true
  })

  const filtered = selectedDate
    ? filteredByTab.filter(b => b.date === selectedDate)
    : filteredByTab

  // Build a set of dates that have bookings (for calendar dots)
  const bookingDatesSet = new Set(bookings.map(b => b.date))

  // Calendar helper functions
  function getCalendarDays(monthDate: Date) {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }

  function formatCalendarDate(day: number) {
    const y = calendarMonth.getFullYear()
    const m = String(calendarMonth.getMonth() + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const todayStr = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })()

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

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setLastSync(data.timestamp)
      toast(`Synced ${data.synced} event${data.synced !== 1 ? 's' : ''} from Google Calendar${data.errors ? ` (${data.errors} error${data.errors !== 1 ? 's' : ''})` : ''}`, data.errors ? 'error' : 'success')
      // Refresh bookings
      const params = userSlug ? `?slug=${userSlug}` : ''
      const bookingsRes = await fetch(`/api/bookings${params}`)
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookings(Array.isArray(bookingsData) ? bookingsData : [])
      }
    } catch (err) {
      toast('Calendar sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const membersWithLinks = teamMembers.filter(m => gcalLinks[m.email])

  // ── Week/Day view helpers ──
  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay()) // Start on Sunday
    return d
  }

  function getWeekDates(start: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  function timeToY(time: string, startHour: number, hourHeight: number): number {
    const [h, m] = time.split(':').map(Number)
    return (h - startHour) * hourHeight + (m / 60) * hourHeight
  }

  function bookingHeight(start: string, end: string, hourHeight: number): number {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60 * hourHeight
  }

  function dateToStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function formatFullDate(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  // Current time for red line indicator
  const now = new Date()
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes()

  // Week view data
  const weekStart = getWeekStart(calendarMonth)
  const weekDates = getWeekDates(weekStart)

  // Get bookings for a specific date string
  function getBookingsForDate(dateStr: string): Booking[] {
    return bookings.filter(b => b.date === dateStr && b.status !== 'cancelled')
  }

  // Navigation handlers for week/day
  function navigatePrev() {
    if (calendarView === 'month') {
      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
    } else if (calendarView === 'week') {
      const d = new Date(calendarMonth)
      d.setDate(d.getDate() - 7)
      setCalendarMonth(d)
    } else {
      const d = new Date(calendarMonth)
      d.setDate(d.getDate() - 1)
      setCalendarMonth(d)
    }
  }

  function navigateNext() {
    if (calendarView === 'month') {
      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
    } else if (calendarView === 'week') {
      const d = new Date(calendarMonth)
      d.setDate(d.getDate() + 7)
      setCalendarMonth(d)
    } else {
      const d = new Date(calendarMonth)
      d.setDate(d.getDate() + 1)
      setCalendarMonth(d)
    }
  }

  function getHeaderLabel(): string {
    if (calendarView === 'month') {
      return calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } else if (calendarView === 'week') {
      const end = new Date(weekStart)
      end.setDate(end.getDate() + 6)
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      return `${startStr} – ${endStr}`
    } else {
      return formatFullDate(calendarMonth)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header title="Calendar & Bookings" />

      <div className="px-4 py-4 md:px-8 md:py-6">

        {/* ── Top bar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
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

          <div className="flex flex-wrap items-center gap-2">
            {lastSync && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Last sync: {new Date(lastSync).toLocaleString()}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            {bookingLink && (
              <>
                <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-xs">
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
              </>
            )}
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
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

        {/* ── Calendar Section ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          {/* Header with nav + view toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={navigatePrev}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <h2 className="text-sm font-bold text-gray-900 min-w-[120px] sm:min-w-[200px] text-center">
                {getHeaderLabel()}
              </h2>
              <button
                onClick={navigateNext}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex gap-1 bg-gray-50 border border-gray-100 rounded-lg p-1">
              {(['month', 'week', 'day'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    calendarView === v ? 'bg-[#012b1e] text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ── Month View ── */}
          {calendarView === 'month' && (
            <>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px">
                {getCalendarDays(calendarMonth).map((day, i) => {
                  if (day === null) {
                    return <div key={`empty-${i}`} className="h-10" />
                  }
                  const dateStr = formatCalendarDate(day)
                  const hasBookings = bookingDatesSet.has(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDate
                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (hasBookings) {
                          // Switch to day view for the clicked date
                          const [y, m, d] = dateStr.split('-').map(Number)
                          setCalendarMonth(new Date(y, m - 1, d))
                          setCalendarView('day')
                          setSelectedDate(dateStr)
                        }
                      }}
                      className={`h-10 rounded-lg flex flex-col items-center justify-center relative transition-colors ${
                        isSelected
                          ? 'bg-[#012b1e] text-white'
                          : isToday
                          ? 'bg-[#015035]/10 text-[#012b1e] font-bold'
                          : hasBookings
                          ? 'hover:bg-gray-100 text-gray-900 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                      }`}
                    >
                      <span className="text-xs">{day}</span>
                      {hasBookings && (
                        <span
                          className={`absolute bottom-1 w-1 h-1 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-[#015035]'
                          }`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected date indicator + clear */}
              {selectedDate && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Showing bookings for <span className="font-semibold text-gray-900">{formatDate(selectedDate)}</span>
                  </span>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs font-medium text-[#015035] hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Week View ── */}
          {calendarView === 'week' && (() => {
            // Week view scrolls horizontally on mobile
            const WEEK_START_HOUR = 8
            const WEEK_END_HOUR = 18
            const HOUR_HEIGHT = 56
            const hours = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, i) => WEEK_START_HOUR + i)

            return (
              <div className="overflow-x-auto -mx-5 px-5">
                <div className="min-w-[600px]">
                {/* Day-of-week headers with dates */}
                <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-px mb-1">
                  <div />
                  {weekDates.map(d => {
                    const ds = dateToStr(d)
                    const isToday = ds === todayStr
                    return (
                      <div key={ds} className={`text-center py-2 rounded-lg ${isToday ? 'bg-[#015035]/10' : ''}`}>
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-sm font-bold ${isToday ? 'text-[#015035]' : 'text-gray-700'}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Time grid */}
                <div className="relative grid grid-cols-[56px_repeat(7,1fr)] gap-px border-t border-gray-100" style={{ height: hours.length * HOUR_HEIGHT }}>
                  {/* Time labels */}
                  {hours.map(h => (
                    <div
                      key={`label-${h}`}
                      className="absolute left-0 w-[56px] text-right pr-3"
                      style={{ top: (h - WEEK_START_HOUR) * HOUR_HEIGHT - 6 }}
                    >
                      <span className="text-[11px] text-gray-400">{formatTime(`${h}:00`)}</span>
                    </div>
                  ))}

                  {/* Hour grid lines */}
                  {hours.map(h => (
                    <div
                      key={`line-${h}`}
                      className="absolute left-[56px] right-0 border-t border-gray-100"
                      style={{ top: (h - WEEK_START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {currentTimeMinutes >= WEEK_START_HOUR * 60 && currentTimeMinutes <= WEEK_END_HOUR * 60 && (
                    <div
                      className="absolute left-[56px] right-0 z-20 flex items-center"
                      style={{ top: ((currentTimeMinutes / 60) - WEEK_START_HOUR) * HOUR_HEIGHT }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  )}

                  {/* Day columns with bookings */}
                  {weekDates.map((d, colIdx) => {
                    const ds = dateToStr(d)
                    const dayBookings = getBookingsForDate(ds)
                    return (
                      <div
                        key={ds}
                        className="absolute"
                        style={{
                          left: `calc(56px + ${colIdx} * ((100% - 56px) / 7))`,
                          width: `calc((100% - 56px) / 7)`,
                          top: 0,
                          height: '100%',
                        }}
                      >
                        {/* Background for column */}
                        <div className="absolute inset-0 bg-gray-50/30 border-l border-gray-100" />

                        {/* Booking blocks */}
                        {dayBookings.map(b => {
                          const [bh] = b.start_time.split(':').map(Number)
                          if (bh < WEEK_START_HOUR || bh >= WEEK_END_HOUR) return null
                          const top = timeToY(b.start_time, WEEK_START_HOUR, HOUR_HEIGHT)
                          const height = Math.max(bookingHeight(b.start_time, b.end_time, HOUR_HEIGHT), 24)
                          return (
                            <button
                              key={b.id}
                              onClick={() => setSelected(selected?.id === b.id ? null : b)}
                              className={`absolute left-1 right-1 bg-[#015035] text-white rounded-lg px-2 py-1 text-left overflow-hidden hover:bg-[#012b1e] transition-colors cursor-pointer z-10 ${
                                selected?.id === b.id ? 'ring-2 ring-[#012b1e] ring-offset-1' : 'shadow-sm'
                              }`}
                              style={{ top, height }}
                            >
                              <div className="text-[11px] font-semibold truncate">{b.client_name}</div>
                              {height > 30 && (
                                <div className="text-[10px] opacity-80 truncate">{formatTime(b.start_time)}</div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
            )
          })()}

          {/* ── Day View ── */}
          {calendarView === 'day' && (() => {
            const DAY_START_HOUR = 7
            const DAY_END_HOUR = 19
            const HOUR_HEIGHT = 64
            const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i)
            const dayStr = dateToStr(calendarMonth)
            const dayBookings = getBookingsForDate(dayStr)
            const isDayToday = dayStr === todayStr

            return (
              <div>
                {isDayToday && (
                  <div className="mb-3 text-xs text-[#015035] font-semibold bg-[#015035]/10 px-3 py-1.5 rounded-lg inline-block">
                    Today
                  </div>
                )}

                {/* Time grid */}
                <div className="relative grid grid-cols-[56px_1fr] gap-px border-t border-gray-100" style={{ height: hours.length * HOUR_HEIGHT }}>
                  {/* Time labels */}
                  {hours.map(h => (
                    <div
                      key={`label-${h}`}
                      className="absolute left-0 w-[56px] text-right pr-3"
                      style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 6 }}
                    >
                      <span className="text-[11px] text-gray-400">{formatTime(`${h}:00`)}</span>
                    </div>
                  ))}

                  {/* Hour grid lines */}
                  {hours.map(h => (
                    <div
                      key={`line-${h}`}
                      className="absolute left-[56px] right-0 border-t border-gray-100"
                      style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isDayToday && currentTimeMinutes >= DAY_START_HOUR * 60 && currentTimeMinutes <= DAY_END_HOUR * 60 && (
                    <div
                      className="absolute left-[56px] right-0 z-20 flex items-center"
                      style={{ top: ((currentTimeMinutes / 60) - DAY_START_HOUR) * HOUR_HEIGHT }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  )}

                  {/* Background column */}
                  <div className="absolute left-[56px] right-0 top-0 bottom-0 bg-gray-50/30 border-l border-gray-100" />

                  {/* Booking blocks (full width) */}
                  {dayBookings.map(b => {
                    const [bh] = b.start_time.split(':').map(Number)
                    if (bh < DAY_START_HOUR || bh >= DAY_END_HOUR) return null
                    const top = timeToY(b.start_time, DAY_START_HOUR, HOUR_HEIGHT)
                    const height = Math.max(bookingHeight(b.start_time, b.end_time, HOUR_HEIGHT), 40)
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelected(selected?.id === b.id ? null : b)}
                        className={`absolute left-[64px] right-2 bg-[#015035] text-white rounded-lg px-4 py-2 text-left overflow-hidden hover:bg-[#012b1e] transition-colors cursor-pointer z-10 ${
                          selected?.id === b.id ? 'ring-2 ring-[#012b1e] ring-offset-1' : 'shadow-sm'
                        }`}
                        style={{ top, height }}
                      >
                        <div className="text-sm font-semibold truncate">{b.client_name}</div>
                        <div className="text-[11px] opacity-80 truncate">
                          {formatTime(b.start_time)} – {formatTime(b.end_time)}
                        </div>
                        {height > 60 && (
                          <div className="text-[11px] opacity-70 truncate mt-0.5">
                            {b.client_email}
                            {b.client_company ? ` · ${b.client_company}` : ''}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {dayBookings.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No bookings for this day
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* ── Bookings list + detail ── */}
        <div className="flex flex-col sm:flex-row gap-4">
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
                {/* Table header - hidden on mobile */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_80px] gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <span>Client</span>
                  <span>Date & Time</span>
                  <span>Company</span>
                  <span>Status</span>
                </div>
                {filtered.map(booking => (
                  <button
                    key={booking.id}
                    onClick={() => setSelected(selected?.id === booking.id ? null : booking)}
                    className={`w-full sm:grid sm:grid-cols-[1fr_1fr_1fr_80px] gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50/80 transition-colors sm:items-center group ${
                      selected?.id === booking.id ? 'bg-green-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between sm:block">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{booking.client_name}</div>
                        <div className="text-xs text-gray-400">{booking.client_email}</div>
                      </div>
                      <span className={`sm:hidden text-xs px-2 py-1 rounded-full font-medium ${
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
                    <div className="mt-1 sm:mt-0">
                      <div className="text-xs sm:text-sm text-gray-800">{formatDate(booking.date)}</div>
                      <div className="text-xs text-gray-400">{formatTime(booking.start_time)} · {booking.timezone}</div>
                    </div>
                    <div className="hidden sm:block text-sm text-gray-600">{booking.client_company || '—'}</div>
                    <div className="hidden sm:block">
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
            <div className="w-full sm:w-72 flex-shrink-0 bg-white rounded-xl border border-gray-100 p-5 space-y-4">
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
