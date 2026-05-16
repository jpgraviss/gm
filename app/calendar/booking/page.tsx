'use client'

import { useState, useEffect } from 'react'
import {
  CalendarCheck, Plus, Pencil, Copy, Check, ExternalLink, ToggleLeft, ToggleRight,
  Clock, Video, Phone, MapPin, X, ChevronRight, Trash2,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

interface Availability {
  days: number[]
  start: string
  end: string
}

interface BookingType {
  id: string
  name: string
  slug: string
  description: string | null
  duration_minutes: number
  location: string
  color: string
  availability: Availability
  buffer_minutes: number
  active: boolean
  created_at: string
}

const DURATIONS = [15, 30, 45, 60, 90]
const LOCATIONS = [
  { value: 'zoom', label: 'Zoom', icon: Video },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'in-person', label: 'In-Person', icon: MapPin },
]
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS = ['#015035', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0891b2', '#4f46e5', '#be123c']

const DEFAULT_TYPE: Omit<BookingType, 'id' | 'slug' | 'created_at'> = {
  name: '',
  description: null,
  duration_minutes: 30,
  location: 'zoom',
  color: '#015035',
  availability: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  buffer_minutes: 15,
  active: true,
}

function formatTime12(t: string) {
  const [h, m] = t.split(':').map(Number)
  const p = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${p}`
}

export default function BookingManagementPage() {
  const { toast } = useToast()
  const [types, setTypes] = useState<BookingType[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<BookingType> | null>(null)
  const [saving, setSaving] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/calendar/booking-types')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setTypes(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { toast('Failed to load booking types', 'error'); setLoading(false) })
  }, [])

  async function handleSave() {
    if (!editing?.name?.trim()) {
      toast('Name is required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/calendar/booking-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Save failed', 'error'); return }

      if (editing.id) {
        setTypes(prev => prev.map(t => t.id === data.id ? data : t))
      } else {
        setTypes(prev => [data, ...prev])
      }
      setEditing(null)
      toast(editing.id ? 'Booking type updated' : 'Booking type created', 'success')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(bt: BookingType) {
    const res = await fetch('/api/calendar/booking-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bt, active: !bt.active }),
    })
    if (res.ok) {
      const data = await res.json()
      setTypes(prev => prev.map(t => t.id === data.id ? data : t))
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/go/book/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const LocationIcon = LOCATIONS.find(l => l.value === editing?.location)?.icon ?? Video

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header title="Booking Types" />

      <div className="px-4 py-4 md:px-8 md:py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/calendar" className="hover:text-gray-800 transition-colors">Calendar</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 font-medium">Booking Types</span>
          </div>
          <button
            onClick={() => setEditing({ ...DEFAULT_TYPE })}
            className="flex items-center gap-1.5 bg-[#012b1e] text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-[#015035] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Booking Type
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-[#015035] border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        ) : types.length === 0 && !editing ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <CalendarCheck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No booking types yet</h3>
            <p className="text-sm text-gray-500 mb-6">Create your first appointment type to start accepting bookings.</p>
            <button
              onClick={() => setEditing({ ...DEFAULT_TYPE })}
              className="inline-flex items-center gap-1.5 bg-[#012b1e] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#015035] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Booking Type
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {types.map(bt => (
              <div key={bt.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: bt.color + '18' }}
                  >
                    <CalendarCheck className="w-5 h-5" style={{ color: bt.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">{bt.name}</h3>
                      {!bt.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">Inactive</span>
                      )}
                    </div>
                    {bt.description && (
                      <p className="text-xs text-gray-500 mb-2">{bt.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {bt.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1">
                        {bt.location === 'zoom' && <Video className="w-3 h-3" />}
                        {bt.location === 'phone' && <Phone className="w-3 h-3" />}
                        {bt.location === 'in-person' && <MapPin className="w-3 h-3" />}
                        {LOCATIONS.find(l => l.value === bt.location)?.label}
                      </span>
                      <span>
                        {bt.availability.days.map(d => DAY_LABELS[d]).join(', ')} | {formatTime12(bt.availability.start)} - {formatTime12(bt.availability.end)}
                      </span>
                      <span>{bt.buffer_minutes}min buffer</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => copyLink(bt.slug)}
                      className="p-2 rounded-lg hover:bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy booking link"
                    >
                      {copiedSlug === bt.slug ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={`/go/book/${bt.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Open booking page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => setEditing(bt)}
                      className="p-2 rounded-lg hover:bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggle(bt)}
                      className="p-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors"
                      title={bt.active ? 'Deactivate' : 'Activate'}
                    >
                      {bt.active ? (
                        <ToggleRight className="w-4 h-4 text-[#015035]" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditing(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white z-50 shadow-2xl overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-900">
                  {editing.id ? 'Edit Booking Type' : 'New Booking Type'}
                </h2>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={editing.name ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. 30-Min Discovery Call"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                  <textarea
                    value={editing.description ?? ''}
                    onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description shown on the booking page"
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duration</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATIONS.map(d => (
                        <button
                          key={d}
                          onClick={() => setEditing(prev => ({ ...prev, duration_minutes: d }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            editing.duration_minutes === d
                              ? 'bg-[#012b1e] text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Buffer</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 5, 10, 15, 30].map(b => (
                        <button
                          key={b}
                          onClick={() => setEditing(prev => ({ ...prev, buffer_minutes: b }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            editing.buffer_minutes === b
                              ? 'bg-[#012b1e] text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {b}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
                  <div className="flex gap-2">
                    {LOCATIONS.map(loc => (
                      <button
                        key={loc.value}
                        onClick={() => setEditing(prev => ({ ...prev, location: loc.value }))}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          editing.location === loc.value
                            ? 'bg-[#012b1e] text-white'
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <loc.icon className="w-3.5 h-3.5" />
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Color</label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditing(prev => ({ ...prev, color: c }))}
                        className={`w-7 h-7 rounded-full transition-all ${
                          editing.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Available Days</label>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map((label, i) => {
                      const days = editing.availability?.days ?? [1, 2, 3, 4, 5]
                      const isActive = days.includes(i)
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const updated = isActive ? days.filter(d => d !== i) : [...days, i].sort()
                            setEditing(prev => ({
                              ...prev,
                              availability: { ...prev?.availability as Availability, days: updated },
                            }))
                          }}
                          className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-[#012b1e] text-white'
                              : 'border border-gray-200 text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={editing.availability?.start ?? '09:00'}
                      onChange={e => setEditing(prev => ({
                        ...prev,
                        availability: { ...prev?.availability as Availability, start: e.target.value },
                      }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={editing.availability?.end ?? '17:00'}
                      onChange={e => setEditing(prev => ({
                        ...prev,
                        availability: { ...prev?.availability as Availability, end: e.target.value },
                      }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Active</div>
                    <div className="text-xs text-gray-400">Visible on public booking page</div>
                  </div>
                  <button
                    onClick={() => setEditing(prev => ({ ...prev, active: !prev?.active }))}
                    className="transition-colors"
                  >
                    {editing.active ? (
                      <ToggleRight className="w-8 h-8 text-[#015035]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-gray-300" />
                    )}
                  </button>
                </div>

                {editing.slug && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Public Link</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-600 font-mono flex-1 truncate">/go/book/{editing.slug}</code>
                      <button
                        onClick={() => copyLink(editing.slug!)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <Copy className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#012b1e] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#015035] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editing.id ? 'Save Changes' : 'Create Booking Type'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
