'use client'

import { useState, useEffect, use } from 'react'
import { ChevronLeft, ChevronRight, Clock, Globe, Check, Video, User, Mail, Building2, Phone, FileText, ArrowLeft, CalendarDays } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalSettings {
  slug: string
  user_name: string
  title: string
  description: string | null
  duration: number
  timezone: string
  available_days: number[]
  available_start: string
  available_end: string
}

interface TimeSlot { start: string; end: string; label: string }

type Step = 'date' | 'time' | 'form' | 'confirmed'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDateFull(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate, onChange, availableDays,
}: {
  selectedDate: string | null
  onChange: (d: string) => void
  availableDays: number[]
}) {
  const today   = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay  = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()
  const todayIso  = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  // Disable navigating to past months
  const isPrevDisabled = year < today.getFullYear() || (year === today.getFullYear() && month <= today.getMonth())

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          disabled={isPrevDisabled}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const iso        = isoDate(year, month, day)
          const dayOfWeek  = new Date(year, month, day).getDay()
          const isPast     = iso < todayIso
          const isAvail    = availableDays.includes(dayOfWeek)
          const isSelected = iso === selectedDate
          const isToday    = iso === todayIso
          const disabled   = isPast || !isAvail

          return (
            <button
              key={i}
              onClick={() => !disabled && onChange(iso)}
              disabled={disabled}
              className={`
                w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-all
                ${disabled ? 'text-gray-200 cursor-not-allowed' : 'cursor-pointer'}
                ${isSelected ? 'bg-[#012b1e] text-white' : ''}
                ${!isSelected && !disabled ? 'text-gray-800 hover:bg-[#012b1e]/10' : ''}
                ${isToday && !isSelected ? 'ring-2 ring-[#015035]' : ''}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const [settings, setSettings] = useState<CalSettings | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [step, setStep]               = useState<Step>('date')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots]             = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [booking, setBooking]         = useState<{ meetLink?: string; id: string } | null>(null)

  // Form fields
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [company, setCompany]   = useState('')
  const [phone, setPhone]       = useState('')
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [honeypot, setHoneypot]     = useState('')

  // Load calendar settings
  useEffect(() => {
    fetch(`/api/calendar/settings/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d?.error) setNotFound(true)
        else setSettings(d)
      })
      .catch(() => setNotFound(true))
  }, [slug])

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    fetch(`/api/calendar/slots?slug=${slug}&date=${selectedDate}`)
      .then(r => r.json())
      .then(d => { setSlots(d.slots ?? []); setSlotsLoading(false) })
      .catch(() => setSlotsLoading(false))
  }, [slug, selectedDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot || !selectedDate) return
    if (honeypot) return // spam bot detected
    if (!name.trim() || !email.trim()) { setFormError('Name and email are required.'); return }
    setFormError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarSlug:  slug,
          clientName:    name.trim(),
          clientEmail:   email.trim(),
          clientCompany: company.trim() || undefined,
          clientPhone:   phone.trim()   || undefined,
          notes:         notes.trim()   || undefined,
          date:          selectedDate,
          startTime:     selectedSlot.start,
          endTime:       selectedSlot.end,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Booking failed.'); return }
      setBooking({ id: data.id, meetLink: data.meet_link })
      setStep('confirmed')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Not Found ──────────────────────────────────────────────────────

  if (!settings && !notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-[#015035] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Calendar not found</h1>
          <p className="text-gray-500 text-sm">This booking link doesn&apos;t exist or has been disabled.</p>
        </div>
      </div>
    )
  }

  const s = settings!

  // ── Confirmed ────────────────────────────────────────────────────────────────

  if (step === 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-[#015035]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re booked!</h1>
          <p className="text-gray-500 text-sm mb-6">
            A confirmation email has been sent to <strong>{email}</strong>.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">What</div>
              <div className="text-sm font-medium text-gray-800">{s.title} with {s.user_name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">When</div>
              <div className="text-sm text-gray-800">{selectedDate && formatDateFull(selectedDate)}</div>
              <div className="text-sm text-gray-600">{selectedSlot?.label} · {s.duration} min · {s.timezone}</div>
              <div className="text-xs text-gray-400 mt-1">Times shown in {s.timezone}. Your calendar invite will adjust to your local time.</div>
            </div>
          </div>

          {booking?.meetLink && (
            <a
              href={booking.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#012b1e] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#015035] transition-colors"
            >
              <Video className="w-4 h-4" />
              Join Google Meet
            </a>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400">Powered by</div>
            <div className="text-xs font-bold text-[#015035] tracking-widest mt-0.5">GRAVISS MARKETING</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-4xl overflow-hidden flex flex-col lg:flex-row">

        {/* ── Left Panel — host info ─────────────────────────────────── */}
        <div className="bg-[#012b1e] lg:w-72 flex-shrink-0 p-8 flex flex-col">
          {/* Logo */}
          <div className="mb-8">
            <div className="text-xs font-bold text-white tracking-widest">GRAVISS</div>
            <div className="text-[9px] text-white/40 tracking-widest">MARKETING</div>
          </div>

          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-[#015035] border-2 border-[#4ade80]/30 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-lg">
              {s.user_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </span>
          </div>

          <div className="text-white/60 text-xs mb-1">You&apos;re booking with</div>
          <h2 className="text-white font-bold text-lg mb-1">{s.user_name}</h2>
          <h3 className="text-[#4ade80] font-semibold text-sm mb-4">{s.title}</h3>

          {s.description && (
            <p className="text-white/60 text-xs leading-relaxed mb-6">{s.description}</p>
          )}

          <div className="space-y-2 mt-auto">
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {s.duration} minutes
            </div>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Video className="w-3.5 h-3.5 flex-shrink-0" />
              Google Meet (link sent after booking)
            </div>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              {s.timezone}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-8 flex gap-1.5">
            {(['date', 'time', 'form'] as Step[]).map((st, i) => (
              <div
                key={st}
                className={`h-1 flex-1 rounded-full transition-all ${
                  step === st ? 'bg-[#4ade80]' :
                  ['date','time','form','confirmed'].indexOf(step) > i ? 'bg-[#4ade80]/60' :
                  'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Right Panel — dynamic steps ───────────────────────────── */}
        <div className="flex-1 p-8">

          {/* Step 1 — Pick Date */}
          {step === 'date' && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-6">Select a Date</h3>
              <MiniCalendar
                selectedDate={selectedDate}
                availableDays={s.available_days}
                onChange={d => {
                  setSelectedDate(d)
                  setStep('time')
                }}
              />
            </div>
          )}

          {/* Step 2 — Pick Time */}
          {step === 'time' && selectedDate && (
            <div>
              <button
                onClick={() => setStep('date')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <h3 className="text-base font-bold text-gray-900 mb-1">Select a Time</h3>
              <p className="text-sm text-gray-500 mb-6">{formatDateFull(selectedDate)}</p>

              {slotsLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-[#015035] border-t-transparent rounded-full animate-spin" />
                  Loading available times…
                </div>
              )}

              {!slotsLoading && slots.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No available times on this date.</p>
                  <button onClick={() => setStep('date')} className="text-[#015035] text-sm font-medium mt-2 hover:underline">
                    Choose another day
                  </button>
                </div>
              )}

              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => { setSelectedSlot(slot); setStep('form') }}
                      className="border border-[#015035] text-[#015035] rounded-xl py-2.5 text-sm font-semibold hover:bg-[#012b1e] hover:text-white hover:border-[#012b1e] transition-all"
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Booking Form */}
          {step === 'form' && selectedSlot && selectedDate && (
            <form onSubmit={handleSubmit}>
              <button
                type="button"
                onClick={() => setStep('time')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h3 className="text-base font-bold text-gray-900 mb-1">Your Information</h3>
              <p className="text-sm text-gray-500 mb-6">
                {formatDateFull(selectedDate)} · {selectedSlot.label} ({s.duration} min)
              </p>

              <div className="space-y-4">
                {[
                  { label: 'Full Name *', value: name, setter: setName, placeholder: 'Jane Smith', icon: User, type: 'text', required: true },
                  { label: 'Email Address *', value: email, setter: setEmail, placeholder: 'jane@company.com', icon: Mail, type: 'email', required: true },
                  { label: 'Company', value: company, setter: setCompany, placeholder: 'Acme Corp', icon: Building2, type: 'text', required: false },
                  { label: 'Phone', value: phone, setter: setPhone, placeholder: '+1 (555) 000-0000', icon: Phone, type: 'tel', required: false },
                ].map(field => (
                  <div key={field.label}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      {field.label}
                    </label>
                    <div className="relative">
                      <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={field.type}
                        value={field.value}
                        onChange={e => field.setter(e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035]"
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Anything you&apos;d like us to know?
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Share any context, questions, or goals for this call…"
                      rows={3}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035] resize-none"
                    />
                  </div>
                </div>

                {/* Honeypot - hidden from real users */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={e => setHoneypot(e.target.value)}
                  />
                </div>

                {formError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#012b1e] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#015035] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Confirming…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm Booking
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
