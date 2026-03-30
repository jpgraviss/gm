'use client'

import { useState, useMemo, useEffect } from 'react'
import { Clock, Plus, X, ChevronLeft, ChevronRight, DollarSign, Ban, Users, Check, Pencil, Trash2, CheckCircle, XCircle, Shield } from 'lucide-react'
import type { TimeEntry, TeamServiceLine, TeamMember, Project } from '@/lib/types'
import { fetchTeamMembers, fetchProjects } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDecimal(hours: number, minutes: number) {
  return hours + minutes / 60
}

function fmtDuration(hours: number, minutes: number) {
  const totalMins = hours * 60 + minutes
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function getWeekDates(anchor: Date) {
  const d = new Date(anchor)
  const day = d.getDay() // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Mon
  const mon = new Date(d.setDate(diff))
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(mon)
    nd.setDate(mon.getDate() + i)
    return nd
  })
}

function toIso(d: Date) {
  return d.toISOString().split('T')[0]
}

function fmtHeader(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtDayLabel(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const SERVICE_COLORS: Record<string, string> = {
  Website: 'bg-blue-100 text-blue-700',
  Development: 'bg-indigo-100 text-indigo-700',
  SEO: 'bg-green-100 text-green-700',
  'Social Media': 'bg-pink-100 text-pink-700',
  Marketing: 'bg-purple-100 text-purple-700',
  'Email Marketing': 'bg-orange-100 text-orange-700',
  Content: 'bg-yellow-100 text-yellow-700',
  Design: 'bg-rose-100 text-rose-700',
  General: 'bg-gray-100 text-gray-600',
}

const SERVICE_TYPES: TeamServiceLine[] = [
  'Website', 'Development', 'SEO', 'Social Media',
  'Marketing', 'Email Marketing', 'Content', 'Design', 'General',
]

// ── Log Time Form ─────────────────────────────────────────────────────────────

interface LogFormProps {
  entry?: TimeEntry
  onSave: (e: TimeEntry) => void
  onClose: () => void
  defaultDate?: string
  teamMembers: TeamMember[]
  projects: Project[]
}

function LogTimePanel({ entry, onSave, onClose, defaultDate, teamMembers, projects }: LogFormProps) {
  const [date, setDate]           = useState(entry?.date ?? defaultDate ?? toIso(new Date()))
  const [teamMember, setTeamMember] = useState(entry?.teamMember ?? teamMembers[0]?.name ?? '')
  const [projectId, setProjectId]   = useState(entry?.projectId ?? '')
  const [description, setDesc]      = useState(entry?.description ?? '')
  const [serviceType, setService]   = useState<TeamServiceLine>(entry?.serviceType ?? 'General')
  const [hours, setHours]           = useState(String(entry?.hours ?? 0))
  const [minutes, setMinutes]       = useState(String(entry?.minutes ?? 0))
  const [billable, setBillable]     = useState(entry?.billable ?? true)

  const selectedProject = projects.find(p => p.id === projectId)

  function handleSave() {
    if (!description.trim()) return
    const h = parseInt(hours) || 0
    const m = parseInt(minutes) || 0
    if (h === 0 && m === 0) return
    onSave({
      id: entry?.id ?? `te-${Date.now()}`,
      date,
      teamMember,
      projectId: projectId || undefined,
      projectName: selectedProject?.company ?? entry?.projectName,
      description: description.trim(),
      serviceType,
      hours: h,
      minutes: m,
      billable,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="bg-white flex flex-col shadow-2xl w-full sm:w-[440px] max-w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#015035]" />
            <span className="font-semibold text-gray-900">{entry ? 'Edit Entry' : 'Log Time'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            />
          </div>

          {/* Team Member */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Team Member</label>
            <select
              value={teamMember}
              onChange={e => setTeamMember(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            >
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Project (optional)</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            >
              <option value="">— No project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.company}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="What did you work on?"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30 resize-none"
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Service Type</label>
            <select
              value={serviceType}
              onChange={e => setService(e.target.value as TeamServiceLine)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/30"
            >
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Duration</label>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#015035]/30">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    placeholder="0"
                  />
                  <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2">hrs</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#015035]/30">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    placeholder="0"
                  />
                  <span className="px-3 text-sm text-gray-400 bg-gray-50 border-l border-gray-200 py-2">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billable toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Billing</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBillable(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  billable ? 'bg-[#012b1e] text-white border-[#012b1e]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Billable
              </button>
              <button
                onClick={() => setBillable(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  !billable ? 'bg-[#012b1e] text-white border-[#012b1e]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Non-Billable
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || (parseInt(hours) === 0 && parseInt(minutes) === 0)}
            className="flex-1 px-4 py-2 bg-[#012b1e] text-white rounded-lg text-sm font-medium hover:bg-[#015035] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {entry ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Approval Status Badge ────────────────────────────────────────────────────

const APPROVAL_BADGE: Record<string, string> = {
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  pending:  'bg-gray-100 text-gray-500',
}

function ApprovalBadge({ status }: { status?: string }) {
  const s = status ?? 'pending'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${APPROVAL_BADGE[s] ?? APPROVAL_BADGE.pending}`}>
      {s}
    </span>
  )
}

// ── Rejection Modal ──────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: { onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md z-10">
        <div className="flex items-center gap-2 mb-4">
          <XCircle className="w-5 h-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900">Reject Time Entries</h3>
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Note (required)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Explain why these entries are being rejected..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (note.trim()) onConfirm(note.trim()) }}
            disabled={!note.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [anchorDate, setAnchor]   = useState(new Date())
  const [showLog, setShowLog]     = useState(false)
  const [editEntry, setEditEntry] = useState<TimeEntry | undefined>()

  // Approvals tab state
  const canApprove = user?.isAdmin || user?.role === 'Department Manager'
  const [activeTab, setActiveTab] = useState<'timesheet' | 'approvals'>('timesheet')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/time-entries')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data) })
      .catch(() => toast('Failed to load time entries', 'error'))
      .finally(() => setLoading(false))
    fetchTeamMembers().then(setTeamMembers)
    fetchProjects().then(setProjects)
  }, [])
  const [filterMember, setFilterMember] = useState('All')
  const [filterBillable, setFilterBillable] = useState<'All' | 'Billable' | 'Non-Billable'>('All')
  const [filterApproval, setFilterApproval] = useState<'All' | 'pending' | 'approved' | 'rejected'>('All')
  const [logDate, setLogDate]     = useState<string | undefined>()

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate])

  const weekIsos = weekDates.map(toIso)
  const weekStart = weekIsos[0]
  const weekEnd   = weekIsos[6]

  // All members from entries + team members list
  const allMembers = useMemo(() => {
    const names = new Set(entries.map(e => e.teamMember))
    return ['All', ...Array.from(names).sort()]
  }, [entries])

  // Filtered entries for this week
  const weekEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.date < weekStart || e.date > weekEnd) return false
      if (filterMember !== 'All' && e.teamMember !== filterMember) return false
      if (filterBillable === 'Billable' && !e.billable) return false
      if (filterBillable === 'Non-Billable' && e.billable) return false
      if (filterApproval !== 'All' && (e.approvalStatus ?? 'pending') !== filterApproval) return false
      return true
    })
  }, [entries, weekStart, weekEnd, filterMember, filterBillable, filterApproval])

  // Pending entries for approvals tab
  const pendingEntries = useMemo(() => {
    return entries.filter(e => (e.approvalStatus ?? 'pending') === 'pending')
  }, [entries])

  // Summary stats
  const totalMins     = weekEntries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
  const billableMins  = weekEntries.filter(e => e.billable).reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
  const nonBillMins   = totalMins - billableMins
  const uniqueMembers = new Set(weekEntries.map(e => e.teamMember)).size

  // Group by date descending
  const grouped = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {}
    weekEntries.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [weekEntries])

  async function handleSave(entry: TimeEntry) {
    const isNew = !entries.find(e => e.id === entry.id)
    if (isNew) {
      try {
        const res = await fetch('/api/time-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
        const saved = await res.json()
        setEntries(prev => [saved, ...prev])
      } catch {
        setEntries(prev => [entry, ...prev])
      }
    } else {
      fetch(`/api/time-entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => toast('Failed to update time entry', 'error'))
      setEntries(prev => prev.map(e => e.id === entry.id ? entry : e))
    }
    setShowLog(false)
    setEditEntry(undefined)
  }

  function handleDelete(id: string) {
    fetch(`/api/time-entries/${id}`, { method: 'DELETE' }).catch(() => toast('Failed to delete time entry', 'error'))
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // Bulk approval actions
  async function handleBulkApproval(status: 'approved' | 'rejected', rejectionNote?: string) {
    if (selectedIds.size === 0) return
    setApprovalLoading(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          approvalStatus: status,
          approvedBy: user?.name ?? user?.email ?? '',
          rejectionNote: status === 'rejected' ? rejectionNote : undefined,
        }),
      })
      const updated = await res.json()
      if (Array.isArray(updated)) {
        setEntries(prev => prev.map(e => {
          const match = updated.find((u: TimeEntry) => u.id === e.id)
          return match ?? e
        }))
        toast(`${updated.length} ${updated.length === 1 ? 'entry' : 'entries'} ${status}`, 'success')
      }
    } catch {
      toast(`Failed to ${status === 'approved' ? 'approve' : 'reject'} entries`, 'error')
    } finally {
      setApprovalLoading(false)
      setSelectedIds(new Set())
      setShowRejectModal(false)
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllPending() {
    if (selectedIds.size === pendingEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingEntries.map(e => e.id)))
    }
  }

  function openLog(date?: string) {
    setLogDate(date)
    setEditEntry(undefined)
    setShowLog(true)
  }

  function openEdit(entry: TimeEntry) {
    setEditEntry(entry)
    setLogDate(undefined)
    setShowLog(true)
  }

  const prevWeek = () => {
    const d = new Date(anchorDate)
    d.setDate(d.getDate() - 7)
    setAnchor(d)
  }
  const nextWeek = () => {
    const d = new Date(anchorDate)
    d.setDate(d.getDate() + 7)
    setAnchor(d)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <Header title="Time Tracking" subtitle="Log and review team hours by week" action={{ label: 'Log Time', onClick: () => openLog() }} />

      {/* ── Sub-header with tabs ── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLog()}
              className="flex items-center gap-2 bg-[#012b1e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#015035] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Time
            </button>
          </div>
        </div>
        {/* Tabs */}
        {canApprove && (
          <div className="flex gap-1 border-t border-gray-100 -mb-px">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timesheet'
                  ? 'border-[#015035] text-[#015035]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Timesheet
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'border-[#015035] text-[#015035]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              Approvals
              {pendingEntries.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {pendingEntries.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Approvals Tab ── */}
      {activeTab === 'approvals' && canApprove && (
        <div className="px-3 py-4 sm:px-8 sm:py-6 space-y-6">
          {/* Actions bar */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pendingEntries.length > 0 && selectedIds.size === pendingEntries.length}
                onChange={toggleAllPending}
                className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-[#015035] focus:ring-[#015035]"
              />
              <span className="text-sm text-gray-600">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `${pendingEntries.length} pending entries`}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleBulkApproval('approved')}
                  disabled={approvalLoading}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve ({selectedIds.size})
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={approvalLoading}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Reject ({selectedIds.size})
                </button>
              </div>
            )}
          </div>

          {/* Pending entries list */}
          {pendingEntries.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-sm font-medium text-gray-500">All entries have been reviewed</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {pendingEntries.map(entry => {
                const mins = entry.hours * 60 + entry.minutes
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-3.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                      className="w-5 h-5 sm:w-4 sm:h-4 rounded border-gray-300 text-[#015035] focus:ring-[#015035] flex-shrink-0"
                    />
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${entry.billable ? 'bg-green-400' : 'bg-gray-200'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{entry.description}</span>
                        {entry.projectName && (
                          <span className="text-xs text-gray-400 truncate hidden sm:inline">· {entry.projectName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">{entry.teamMember}</span>
                        <span className="text-xs text-gray-400 hidden sm:inline">{entry.date}</span>
                        <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${SERVICE_COLORS[entry.serviceType] ?? 'bg-gray-100 text-gray-600'}`}>
                          {entry.serviceType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {fmtDuration(entry.hours, entry.minutes)}
                      </div>
                      <div className="text-xs text-gray-400 hidden sm:block">{(mins / 60).toFixed(2)}h</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Timesheet Tab ── */}
      {activeTab === 'timesheet' && <div className="px-3 py-4 sm:px-8 sm:py-6 space-y-6">
        {/* ── Week Navigator ── */}
        <div className="bg-white rounded-xl border border-gray-100 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 text-center min-w-0 truncate px-1">
              {fmtHeader(weekDates[0])} — {fmtHeader(weekDates[6])}
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex gap-1 justify-center overflow-x-auto pb-1">
            {weekDates.map((d, i) => {
              const iso = toIso(d)
              const hasEntries = entries.some(e => e.date === iso)
              const isToday = iso === toIso(new Date())
              return (
                <button
                  key={i}
                  onClick={() => openLog(iso)}
                  className={`flex flex-col items-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-colors min-w-[40px] ${
                    isToday ? 'bg-[#012b1e] text-white' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                  title={`Log time for ${fmtDayLabel(d)}`}
                >
                  <span className="font-medium">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className={isToday ? 'text-green-300' : 'text-gray-400'}>{d.getDate()}</span>
                  {hasEntries && (
                    <div className={`w-1 h-1 rounded-full mt-0.5 ${isToday ? 'bg-green-300' : 'bg-[#015035]'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Hours',
              value: fmtDuration(Math.floor(totalMins / 60), totalMins % 60),
              sub: `${(totalMins / 60).toFixed(1)}h decimal`,
              icon: Clock,
              color: 'text-[#015035]',
              bg: 'bg-green-50',
            },
            {
              label: 'Billable',
              value: fmtDuration(Math.floor(billableMins / 60), billableMins % 60),
              sub: totalMins > 0 ? `${Math.round((billableMins / totalMins) * 100)}% of total` : '—',
              icon: DollarSign,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: 'Non-Billable',
              value: fmtDuration(Math.floor(nonBillMins / 60), nonBillMins % 60),
              sub: totalMins > 0 ? `${Math.round((nonBillMins / totalMins) * 100)}% of total` : '—',
              icon: Ban,
              color: 'text-orange-500',
              bg: 'bg-orange-50',
            },
            {
              label: 'Team Members',
              value: String(uniqueMembers),
              sub: `tracking this week`,
              icon: Users,
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
              <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 overflow-x-auto">
          {/* Member filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1">
            {allMembers.map(m => (
              <button
                key={m}
                onClick={() => setFilterMember(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterMember === m ? 'bg-[#012b1e] text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Billable filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1">
            {(['All', 'Billable', 'Non-Billable'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterBillable(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterBillable === f ? 'bg-[#012b1e] text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Approval status filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg p-1">
            {(['All', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterApproval(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  filterApproval === f ? 'bg-[#012b1e] text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="ml-auto text-xs text-gray-400">
            {weekEntries.length} entries · {(totalMins / 60).toFixed(1)}h logged
          </div>
        </div>

        {/* ── Time Entries ── */}
        {grouped.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-300" />
            </div>
            <div className="text-sm font-medium text-gray-500">No time entries for this week</div>
            <button
              onClick={() => openLog()}
              className="flex items-center gap-1.5 text-[#015035] text-sm font-medium hover:underline"
            >
              <Plus className="w-4 h-4" />
              Log your first entry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, dayEntries]) => {
              const dayDate = new Date(date + 'T12:00:00')
              const dayMins = dayEntries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
              return (
                <div key={date} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  {/* Day header */}
                  <div className="flex items-center justify-between px-3 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{fmtDayLabel(dayDate)}</span>
                      <span className="text-xs text-gray-400">{dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">
                        {fmtDuration(Math.floor(dayMins / 60), dayMins % 60)}
                      </span>
                      <button
                        onClick={() => openLog(date)}
                        className="flex items-center gap-1 text-xs text-[#015035] font-medium hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Entries */}
                  <div className="divide-y divide-gray-50">
                    {dayEntries.map(entry => {
                      const mins = entry.hours * 60 + entry.minutes
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-3.5 hover:bg-gray-50/60 group transition-colors"
                        >
                          {/* Billable indicator */}
                          <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${entry.billable ? 'bg-green-400' : 'bg-gray-200'}`} />

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900 truncate">{entry.description}</span>
                              {entry.projectName && (
                                <span className="text-xs text-gray-400 truncate hidden sm:inline">· {entry.projectName}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">{entry.teamMember}</span>
                              <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${SERVICE_COLORS[entry.serviceType] ?? 'bg-gray-100 text-gray-600'}`}>
                                {entry.serviceType}
                              </span>
                              {!entry.billable && (
                                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-500 hidden sm:inline">Non-Billable</span>
                              )}
                              <ApprovalBadge status={entry.approvalStatus} />
                            </div>
                          </div>

                          {/* Duration */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold text-gray-900">
                              {fmtDuration(entry.hours, entry.minutes)}
                            </div>
                            <div className="text-xs text-gray-400 hidden sm:block">{(mins / 60).toFixed(2)}h</div>
                          </div>

                          {/* Actions — always visible on mobile, hover on desktop */}
                          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                              className="p-2 sm:p-1.5 hover:bg-gray-100 rounded-lg"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-400" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                              className="p-2 sm:p-1.5 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>}

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <RejectModal
          onConfirm={(note) => handleBulkApproval('rejected', note)}
          onClose={() => setShowRejectModal(false)}
        />
      )}

      {/* ── Log / Edit Panel ── */}
      {showLog && (
        <LogTimePanel
          entry={editEntry}
          defaultDate={logDate}
          onSave={handleSave}
          onClose={() => { setShowLog(false); setEditEntry(undefined) }}
          teamMembers={teamMembers}
          projects={projects}
        />
      )}
    </div>
  )
}
