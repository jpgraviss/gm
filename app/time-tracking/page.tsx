'use client'

import { useState, useMemo, useEffect } from 'react'
import { Clock, Plus, X, ChevronLeft, ChevronRight, DollarSign, Ban, Users, Check, Pencil, Trash2, CheckCircle, XCircle, Shield, Search, List, CalendarDays, TrendingUp, Timer } from 'lucide-react'
import type { TimeEntry, TeamServiceLine, TeamMember, Project } from '@/lib/types'
import { fetchTeamMembers, fetchProjects } from '@/lib/supabase'
import { SERVICE_NAMES, serviceTypeColors } from '@/lib/services'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { fetchAllPages } from '@/lib/fetch-all-pages'

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
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
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

const SERVICE_COLORS: Record<string, string> = serviceTypeColors

const SERVICE_TYPES: TeamServiceLine[] = [...SERVICE_NAMES, 'General']

interface LogFormProps {
  entry?: TimeEntry
  onSave: (e: TimeEntry) => void
  onClose: () => void
  defaultDate?: string
  teamMembers: TeamMember[]
  projects: Project[]
}

function LogTimeModal({ entry, onSave, onClose, defaultDate, teamMembers, projects }: LogFormProps) {
  const [date, setDate]             = useState(entry?.date ?? defaultDate ?? toIso(new Date()))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#015035]/10 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-[#015035]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{entry ? 'Edit Time Entry' : 'Log Time'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Track hours against a project or task</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Team Member</label>
              <select
                value={teamMember}
                onChange={e => setTeamMember(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              >
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
            >
              <option value="">No project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.company}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="What did you work on?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Type</label>
              <select
                value={serviceType}
                onChange={e => setService(e.target.value as TeamServiceLine)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              >
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#015035]/20 focus-within:border-[#015035]">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none w-full"
                    placeholder="0"
                  />
                  <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-2.5">h</span>
                </div>
                <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#015035]/20 focus-within:border-[#015035]">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none w-full"
                    placeholder="0"
                  />
                  <span className="px-2 text-xs text-gray-400 bg-gray-50 border-l border-gray-200 py-2.5">m</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Billing</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBillable(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  billable ? 'bg-[#015035] text-white border-[#015035] shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Billable
              </button>
              <button
                onClick={() => setBillable(false)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  !billable ? 'bg-[#015035] text-white border-[#015035] shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Non-Billable
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || (parseInt(hours) === 0 && parseInt(minutes) === 0)}
            className="flex-1 px-4 py-2.5 bg-[#015035] text-white rounded-xl text-sm font-medium hover:bg-[#013d29] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            {entry ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

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

function RejectModal({ onConfirm, onClose }: { onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md z-10">
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
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (note.trim()) onConfirm(note.trim()) }}
            disabled={!note.trim()}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [viewMode, setViewMode]   = useState<'list' | 'calendar'>('list')
  const [searchQuery, setSearchQuery] = useState('')

  // AUDIT #286 — only recognized one of the two role-name aliases
  // ROLE_HIERARCHY treats as equal ('Dept Manager' / 'Department Manager'),
  // unlike app/page.tsx's dashboard-tab visibility, which is defensive of
  // both. Not exploitable today (no write path sets the short alias), but
  // a single point of failure if one ever does.
  const canApprove = user?.isAdmin || user?.role === 'Department Manager' || user?.role === 'Dept Manager'
  const [activeTab, setActiveTab] = useState<'timesheet' | 'approvals'>('timesheet')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)

  useEffect(() => {
    // AUDIT #285 — raw fetch() against a route cursor-paginated at 100
    // rows silently truncated past that: past weeks could render empty,
    // the Approvals queue could hide older pending entries, and the
    // Hours/Billable/Avg-Daily KPI tiles were computed off a partial set.
    fetchAllPages<TimeEntry>('/api/time-entries')
      .then(setEntries)
      .catch(() => toast('Failed to load time entries', 'error'))
      .finally(() => setLoading(false))
    fetchTeamMembers().then(setTeamMembers)
    fetchProjects().then(setProjects)
  }, [])

  const [filterMember, setFilterMember] = useState('All')
  const [filterBillable, setFilterBillable] = useState<'All' | 'Billable' | 'Non-Billable'>('All')
  const [filterApproval, setFilterApproval] = useState<'All' | 'pending' | 'approved' | 'rejected'>('All')
  const [logDate, setLogDate] = useState<string | undefined>()

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate])
  const weekIsos = weekDates.map(toIso)
  const weekStart = weekIsos[0]
  const weekEnd   = weekIsos[6]

  const allMembers = useMemo(() => {
    const names = new Set(entries.map(e => e.teamMember))
    return ['All', ...Array.from(names).sort()]
  }, [entries])

  const weekEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.date < weekStart || e.date > weekEnd) return false
      if (filterMember !== 'All' && e.teamMember !== filterMember) return false
      if (filterBillable === 'Billable' && !e.billable) return false
      if (filterBillable === 'Non-Billable' && e.billable) return false
      if (filterApproval !== 'All' && (e.approvalStatus ?? 'pending') !== filterApproval) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchDesc = e.description.toLowerCase().includes(q)
        const matchProject = e.projectName?.toLowerCase().includes(q)
        const matchService = e.serviceType.toLowerCase().includes(q)
        if (!matchDesc && !matchProject && !matchService) return false
      }
      return true
    })
  }, [entries, weekStart, weekEnd, filterMember, filterBillable, filterApproval, searchQuery])

  const pendingEntries = useMemo(() => {
    return entries.filter(e => (e.approvalStatus ?? 'pending') === 'pending')
  }, [entries])

  const totalMins     = weekEntries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
  const billableMins  = weekEntries.filter(e => e.billable).reduce((s, e) => s + e.hours * 60 + e.minutes, 0)

  const todayIso = toIso(new Date())
  const todayMins = weekEntries
    .filter(e => e.date === todayIso)
    .reduce((s, e) => s + e.hours * 60 + e.minutes, 0)

  const daysWithEntries = new Set(weekEntries.map(e => e.date)).size
  const avgDailyMins = daysWithEntries > 0 ? Math.round(totalMins / daysWithEntries) : 0

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
        if (!res.ok) throw new Error('Failed')
        const saved = await res.json()
        setEntries(prev => [saved, ...prev])
        toast('Time entry logged', 'success')
      } catch {
        toast('Failed to save time entry', 'error')
      }
    } else {
      const previous = entries.find(e => e.id === entry.id)
      setEntries(prev => prev.map(e => e.id === entry.id ? entry : e))
      try {
        const res = await fetch(`/api/time-entries/${entry.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        toast('Failed to update time entry — reverted', 'error')
        if (previous) setEntries(prev => prev.map(e => e.id === entry.id ? previous : e))
      }
    }
    setShowLog(false)
    setEditEntry(undefined)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this time entry?')) return
    const previous = entries.find(e => e.id === id)
    setEntries(prev => prev.filter(e => e.id !== id))
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast('Failed to delete time entry — restored', 'error')
      if (previous) setEntries(prev => [previous, ...prev])
    }
  }

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
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      if (Array.isArray(updated)) {
        setEntries(prev => prev.map(e => {
          const match = updated.find((u: TimeEntry) => u.id === e.id)
          return match ?? e
        }))
        toast(`${updated.length} ${updated.length === 1 ? 'entry' : 'entries'} ${status}`, 'success')
      } else {
        toast(`Failed to ${status === 'approved' ? 'approve' : 'reject'} entries`, 'error')
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

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <Header title="Time Tracking" subtitle="Log and review team hours by week" action={{ label: 'Log Time', onClick: () => openLog() }} />

      {canApprove && (
        <div className="bg-white border-b border-gray-100 px-4 sm:px-8">
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'timesheet'
                  ? 'border-[#015035] text-[#015035]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Timesheet
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
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
        </div>
      )}

      {activeTab === 'approvals' && canApprove && (
        <div className="px-3 py-4 sm:px-8 sm:py-6 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between shadow-sm">
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
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve ({selectedIds.size})
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={approvalLoading}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Reject ({selectedIds.size})
                </button>
              </div>
            )}
          </div>

          {pendingEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center gap-3 shadow-sm">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-sm font-medium text-gray-500">All entries have been reviewed</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50 shadow-sm">
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
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${entry.billable ? 'bg-emerald-400' : 'bg-gray-200'}`} />
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

      {activeTab === 'timesheet' && <div className="px-3 py-4 sm:px-8 sm:py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Hours This Week',
              value: fmtDuration(Math.floor(totalMins / 60), totalMins % 60),
              sub: `${(totalMins / 60).toFixed(1)}h decimal`,
              icon: Clock,
              accent: 'from-[#015035] to-[#01784f]',
              iconBg: 'bg-[#015035]/10',
              iconColor: 'text-[#015035]',
            },
            {
              label: 'Hours Today',
              value: fmtDuration(Math.floor(todayMins / 60), todayMins % 60),
              sub: todayMins > 0 ? `${(todayMins / 60).toFixed(1)}h decimal` : 'No entries yet',
              icon: Timer,
              accent: 'from-blue-500 to-blue-600',
              iconBg: 'bg-blue-50',
              iconColor: 'text-blue-600',
            },
            {
              label: 'Billable Hours',
              value: fmtDuration(Math.floor(billableMins / 60), billableMins % 60),
              sub: totalMins > 0 ? `${Math.round((billableMins / totalMins) * 100)}% billable rate` : 'No entries',
              icon: DollarSign,
              accent: 'from-emerald-500 to-emerald-600',
              iconBg: 'bg-emerald-50',
              iconColor: 'text-emerald-600',
            },
            {
              label: 'Avg Daily',
              value: fmtDuration(Math.floor(avgDailyMins / 60), avgDailyMins % 60),
              sub: daysWithEntries > 0 ? `across ${daysWithEntries} ${daysWithEntries === 1 ? 'day' : 'days'}` : 'No data',
              icon: TrendingUp,
              accent: 'from-violet-500 to-violet-600',
              iconBg: 'bg-violet-50',
              iconColor: 'text-violet-600',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.label}</span>
                <div className={`${card.iconBg} p-2 rounded-xl`}>
                  <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">{card.value}</div>
              <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Week Navigator */}
        <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3 sm:px-6 sm:py-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 text-center min-w-0 truncate px-1">
              {fmtHeader(weekDates[0])} — {fmtHeader(weekDates[6])}
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex gap-1 justify-center overflow-x-auto pb-1">
            {weekDates.map((d, i) => {
              const iso = toIso(d)
              const dayTotal = entries
                .filter(e => e.date === iso)
                .reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
              const isToday = iso === todayIso
              return (
                <button
                  key={i}
                  onClick={() => openLog(iso)}
                  className={`flex flex-col items-center px-2.5 sm:px-4 py-2 rounded-xl text-xs transition-all min-w-[48px] ${
                    isToday
                      ? 'bg-[#015035] text-white shadow-sm'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                  title={`Log time for ${fmtDayLabel(d)}`}
                >
                  <span className="font-medium">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className={`text-lg font-semibold leading-tight ${isToday ? 'text-white' : 'text-gray-900'}`}>{d.getDate()}</span>
                  {dayTotal > 0 && (
                    <span className={`text-[10px] mt-0.5 font-medium ${isToday ? 'text-green-200' : 'text-[#015035]'}`}>
                      {(dayTotal / 60).toFixed(1)}h
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Toolbar: Search, Filters, View Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by project or task..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterMember}
              onChange={e => setFilterMember(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
            >
              {allMembers.map(m => (
                <option key={m} value={m}>{m === 'All' ? 'All Members' : m}</option>
              ))}
            </select>

            <div className="flex bg-gray-100 rounded-xl p-0.5">
              {(['All', 'Billable', 'Non-Billable'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterBillable(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterBillable === f
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-100 rounded-xl p-0.5">
              {(['All', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterApproval(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    filterApproval === f
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-100 rounded-xl p-0.5 ml-auto sm:ml-0">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Calendar view"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {weekEntries.length} {weekEntries.length === 1 ? 'entry' : 'entries'} · {(totalMins / 60).toFixed(1)}h logged
          </span>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((d, i) => {
              const iso = toIso(d)
              const dayEntries = weekEntries.filter(e => e.date === iso)
              const dayMins = dayEntries.reduce((s, e) => s + e.hours * 60 + e.minutes, 0)
              const isToday = iso === todayIso
              return (
                <div key={i} className={`bg-white rounded-2xl border shadow-sm min-h-[200px] flex flex-col ${isToday ? 'border-[#015035] ring-1 ring-[#015035]/20' : 'border-gray-100'}`}>
                  <div className={`px-3 py-2 border-b flex items-center justify-between ${isToday ? 'border-[#015035]/20 bg-[#015035]/5' : 'border-gray-50'}`}>
                    <div>
                      <div className="text-[10px] font-medium text-gray-400 uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className={`text-sm font-semibold ${isToday ? 'text-[#015035]' : 'text-gray-900'}`}>{d.getDate()}</div>
                    </div>
                    {dayMins > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isToday ? 'bg-[#015035]/10 text-[#015035]' : 'bg-gray-100 text-gray-600'}`}>
                        {(dayMins / 60).toFixed(1)}h
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                    {dayEntries.map(entry => (
                      <button
                        key={entry.id}
                        onClick={() => openEdit(entry)}
                        className="w-full text-left p-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-start gap-1.5">
                          <div className={`w-1 h-full min-h-[16px] rounded-full flex-shrink-0 mt-0.5 ${entry.billable ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-gray-900 truncate leading-tight">{entry.description}</div>
                            <div className="text-[10px] text-gray-400 truncate">{entry.projectName ?? entry.serviceType}</div>
                            <div className="text-[10px] font-semibold text-gray-500 mt-0.5">{fmtDuration(entry.hours, entry.minutes)}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {dayEntries.length === 0 && (
                      <button
                        onClick={() => openLog(iso)}
                        className="w-full h-full flex items-center justify-center min-h-[60px] text-gray-300 hover:text-[#015035] hover:bg-[#015035]/5 rounded-xl transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {grouped.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-20 flex flex-col items-center gap-4 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
                  <Clock className="w-7 h-7 text-gray-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 text-center">No time entries found</div>
                  <div className="text-xs text-gray-400 mt-1 text-center">
                    {searchQuery ? 'Try adjusting your search or filters' : 'Start tracking time for this week'}
                  </div>
                </div>
                <button
                  onClick={() => openLog()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#015035] text-white text-sm font-medium rounded-xl hover:bg-[#013d29] transition-colors shadow-sm"
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
                  const isToday = date === todayIso
                  return (
                    <div key={date} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className={`flex items-center justify-between px-3 sm:px-6 py-3 border-b ${isToday ? 'bg-[#015035]/[0.03] border-[#015035]/10' : 'bg-gray-50/80 border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                          {isToday && <div className="w-2 h-2 rounded-full bg-[#015035]" />}
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

                      <div className="divide-y divide-gray-50">
                        {dayEntries.map(entry => {
                          const mins = entry.hours * 60 + entry.minutes
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-3.5 hover:bg-gray-50/60 group transition-colors"
                            >
                              <div className={`w-1 h-10 rounded-full flex-shrink-0 ${entry.billable ? 'bg-emerald-400' : 'bg-gray-200'}`} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 truncate">{entry.description}</span>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <span className="text-xs text-gray-500">{entry.teamMember}</span>
                                  {entry.projectName && (
                                    <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md font-medium border border-gray-100">{entry.projectName}</span>
                                  )}
                                  <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium ${SERVICE_COLORS[entry.serviceType] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {entry.serviceType}
                                  </span>
                                  {!entry.billable && (
                                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-500 hidden sm:inline">Non-Billable</span>
                                  )}
                                  <ApprovalBadge status={entry.approvalStatus} />
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0 mr-1">
                                <div className="text-sm font-bold text-gray-900 tabular-nums">
                                  {fmtDuration(entry.hours, entry.minutes)}
                                </div>
                                <div className="text-xs text-gray-400 hidden sm:block tabular-nums">{(mins / 60).toFixed(2)}h</div>
                              </div>

                              <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                                  className="p-2 sm:p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-gray-400" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                                  className="p-2 sm:p-1.5 hover:bg-red-50 rounded-lg transition-colors"
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
          </>
        )}
      </div>}

      {showRejectModal && (
        <RejectModal
          onConfirm={(note) => handleBulkApproval('rejected', note)}
          onClose={() => setShowRejectModal(false)}
        />
      )}

      {showLog && (
        <LogTimeModal
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
