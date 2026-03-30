'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import Header from '@/components/layout/Header'
import CRMSubNav from '@/components/crm/CRMSubNav'
import {
  X, Mail, Plus, Play, Pause, CheckCircle, Clock, Users, Zap,
  ChevronLeft, Edit2, Copy, TrendingUp, Search, MoreHorizontal,
  Eye, Trash2, ArrowUpDown, UserMinus, UserPlus, Phone,
  MessageCircle, Linkedin, AlertCircle,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SequenceStatus = 'Active' | 'Paused' | 'Draft' | 'Completed'
type StepType = 'email' | 'manual_email' | 'wait' | 'task' | 'condition' | 'sms' | 'linkedin' | 'call'

interface SequenceStep {
  id: string
  type: StepType
  day: number
  subject?: string
  body?: string
  waitDays?: number
  taskTitle?: string
  condition?: string
  smsBody?: string
  linkedinAction?: 'connect' | 'inmail' | 'view_profile'
  linkedinMessage?: string
  callScript?: string
}

interface EmailSequence {
  id: string
  name: string
  status: SequenceStatus
  trigger: string
  targetSegment: string
  enrolledCount: number
  activeCount: number
  completedCount: number
  openRate: number
  clickRate: number
  replyRate: number
  steps: SequenceStep[]
  createdDate: string
  lastModified: string
}

interface Enrollment {
  id: string
  sequenceId: string
  contactId: string | null
  contactName: string
  contactEmail: string
  enrolledAt: string
  currentStep: number
  status: string
  nextSendAt: string | null
  lastSentAt: string | null
}

interface CRMContact {
  id: string
  fullName: string
  firstName: string
  lastName: string
  emails: string[]
  companyName: string
  title: string
}

const statusColors: Record<SequenceStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: 'bg-green-50',  text: 'text-green-700',  dot: '#015035' },
  Paused:    { bg: 'bg-gray-50',   text: 'text-gray-500',   dot: '#9ca3af' },
  Draft:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: '#f59e0b' },
  Completed: { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: '#3b82f6' },
}

const stepTypeConfig: Record<StepType, { color: string; label: string; icon: React.ReactNode }> = {
  email:        { color: '#3b82f6', label: 'Email',          icon: <Mail size={14} /> },
  manual_email: { color: '#8b5cf6', label: 'Manual Email',   icon: <Edit2 size={14} /> },
  wait:         { color: '#9ca3af', label: 'Delay',          icon: <Clock size={14} /> },
  task:         { color: '#10b981', label: 'Task',           icon: <CheckCircle size={14} /> },
  condition:    { color: '#f59e0b', label: 'Branch',         icon: <Zap size={14} /> },
  sms:          { color: '#06b6d4', label: 'SMS',            icon: <MessageCircle size={14} /> },
  linkedin:     { color: '#0077b5', label: 'LinkedIn',       icon: <Linkedin size={14} /> },
  call:         { color: '#ef4444', label: 'Call',           icon: <Phone size={14} /> },
}

// ─── Enroll Contacts Modal ──────────────────────────────────────────────────────

function EnrollContactsModal({
  sequenceId,
  existingEmails,
  onEnrolled,
  onClose,
}: {
  sequenceId: string
  existingEmails: Set<string>
  onEnrolled: (count: number) => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    fetch('/api/crm/contacts')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setContacts(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    if (!c.emails?.length) return false
    const q = search.toLowerCase()
    if (!q) return true
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.emails.some(e => e.toLowerCase().includes(q)) ||
      c.companyName?.toLowerCase().includes(q)
    )
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    const eligible = filtered.filter(c => !existingEmails.has(c.emails[0]))
    if (selected.size === eligible.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(eligible.map(c => c.id)))
    }
  }

  async function enroll() {
    const toEnroll = contacts
      .filter(c => selected.has(c.id))
      .map(c => ({ id: c.id, name: c.fullName || `${c.firstName} ${c.lastName}`, email: c.emails[0] }))

    if (!toEnroll.length) return

    setEnrolling(true)
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: toEnroll }),
      })
      if (res.ok) {
        const { enrolled } = await res.json()
        toast(`${enrolled} contact${enrolled !== 1 ? 's' : ''} enrolled`, 'success')
        onEnrolled(enrolled)
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast(err.error || 'Failed to enroll contacts', 'error')
      }
    } catch {
      toast('Failed to enroll contacts', 'error')
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Enroll Contacts</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select contacts to add to this sequence</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts by name, email, or company..."
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{search ? 'No contacts match your search' : 'No contacts with email addresses found'}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button onClick={selectAll} className="text-xs text-emerald-600 font-medium hover:underline">
                  {selected.size === filtered.filter(c => !existingEmails.has(c.emails[0])).length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-xs text-gray-400">{filtered.length} contacts</span>
              </div>
              <div className="flex flex-col gap-1">
                {filtered.map(c => {
                  const alreadyEnrolled = existingEmails.has(c.emails[0])
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        alreadyEnrolled ? 'opacity-50 cursor-not-allowed' : selected.has(c.id) ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => !alreadyEnrolled && toggleSelect(c.id)}
                        disabled={alreadyEnrolled}
                        className="accent-emerald-600 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.fullName || `${c.firstName} ${c.lastName}`}</p>
                          {alreadyEnrolled && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">Already enrolled</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 truncate">{c.emails[0]}</span>
                          {c.companyName && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400 truncate">{c.companyName}</span>
                            </>
                          )}
                          {c.title && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400 truncate">{c.title}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              onClick={enroll}
              disabled={!selected.size || enrolling}
              className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-2"
              style={{ background: '#015035' }}
            >
              <UserPlus size={14} />
              {enrolling ? 'Enrolling...' : `Enroll ${selected.size || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal ──────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
          </div>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SequenceDetailPage() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const sequenceId = params.id as string

  const [loading, setLoading] = useState(true)
  const [sequence, setSequence] = useState<EmailSequence | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [tab, setTab] = useState<'people' | 'steps' | 'settings'>('people')
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollStatusFilter, setEnrollStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all')
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set())
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showDeleteSeqModal, setShowDeleteSeqModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [seqRes, enrollRes] = await Promise.all([
        fetch(`/api/sequences`),
        fetch(`/api/sequences/${sequenceId}/enrollments`),
      ])
      if (seqRes.ok) {
        const seqs = await seqRes.json()
        const found = Array.isArray(seqs) ? seqs.find((s: EmailSequence) => s.id === sequenceId) : null
        setSequence(found ?? null)
      }
      if (enrollRes.ok) {
        const data = await enrollRes.json()
        if (Array.isArray(data)) setEnrollments(data)
      }
    } catch {
      toast('Failed to load sequence', 'error')
    } finally {
      setLoading(false)
    }
  }, [sequenceId, toast])

  useEffect(() => { loadData() }, [loadData])

  async function toggleStatus() {
    if (!sequence) return
    const newStatus = sequence.status === 'Active' ? 'Paused' : 'Active'
    setSequence({ ...sequence, status: newStatus })
    await fetch(`/api/sequences/${sequenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    toast(`Sequence ${newStatus === 'Active' ? 'activated' : 'paused'}`, 'success')
  }

  async function deleteSequence() {
    await fetch(`/api/sequences/${sequenceId}`, { method: 'DELETE' })
    toast('Sequence deleted', 'success')
    router.push('/crm/sequences')
  }

  async function removeEnrollments() {
    const ids = Array.from(selectedEnrollments)
    if (!ids.length) return

    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enrollments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentIds: ids }),
      })
      if (res.ok) {
        const { removed } = await res.json()
        setEnrollments(prev => prev.filter(e => !selectedEnrollments.has(e.id)))
        setSelectedEnrollments(new Set())
        // Update local sequence counts
        if (sequence) {
          const activeRemoved = enrollments.filter(e => selectedEnrollments.has(e.id) && e.status === 'active').length
          setSequence({
            ...sequence,
            enrolledCount: Math.max(0, sequence.enrolledCount - removed),
            activeCount: Math.max(0, sequence.activeCount - activeRemoved),
          })
        }
        toast(`${removed} contact${removed !== 1 ? 's' : ''} removed`, 'success')
      } else {
        toast('Failed to remove contacts', 'error')
      }
    } catch {
      toast('Failed to remove contacts', 'error')
    }
    setShowRemoveModal(false)
  }

  function handleEnrolled(count: number) {
    if (sequence) {
      setSequence({
        ...sequence,
        enrolledCount: sequence.enrolledCount + count,
        activeCount: sequence.activeCount + count,
      })
    }
    loadData()
  }

  // Filter enrollments
  let filteredEnrollments = enrollments
  if (enrollStatusFilter !== 'all') {
    filteredEnrollments = filteredEnrollments.filter(e => e.status === enrollStatusFilter)
  }
  if (enrollSearch.trim()) {
    const q = enrollSearch.toLowerCase()
    filteredEnrollments = filteredEnrollments.filter(
      e => e.contactName.toLowerCase().includes(q) || e.contactEmail.toLowerCase().includes(q)
    )
  }

  const existingEmails = new Set(enrollments.map(e => e.contactEmail))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  if (!sequence) {
    return (
      <>
        <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" />
        <div className="p-6 flex-1 flex flex-col items-center justify-center">
          <p className="text-gray-500">Sequence not found</p>
          <button onClick={() => router.push('/crm/sequences')} className="mt-4 text-sm text-emerald-600 hover:underline">
            Back to Sequences
          </button>
        </div>
      </>
    )
  }

  const sc = statusColors[sequence.status]

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Back + Title */}
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.push('/crm/sequences')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={18} className="text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 truncate" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                {sequence.name}
              </h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                {sequence.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{sequence.trigger || 'Manual enrollment'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {sequence.status === 'Active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Activate</>}
            </button>
            <button
              onClick={() => setShowDeleteSeqModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-5 mt-4">
          {[
            { label: 'Enrolled', value: sequence.enrolledCount, icon: <Users size={14} />, color: '#3b82f6' },
            { label: 'Active', value: sequence.activeCount, icon: <Play size={12} />, color: '#10b981' },
            { label: 'Completed', value: sequence.completedCount, icon: <CheckCircle size={14} />, color: '#8b5cf6' },
            { label: 'Open Rate', value: `${sequence.openRate}%`, icon: <Eye size={14} />, color: '#f59e0b' },
            { label: 'Reply Rate', value: `${sequence.replyRate}%`, icon: <TrendingUp size={14} />, color: '#015035' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span style={{ color: s.color }}>{s.icon}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {(['people', 'steps', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-emerald-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* People Tab */}
        {tab === 'people' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Actions bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={enrollSearch}
                  onChange={e => setEnrollSearch(e.target.value)}
                  placeholder="Search enrolled contacts..."
                  className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'active', 'completed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setEnrollStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                      enrollStatusFilter === s
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {selectedEnrollments.size > 0 && (
                <button
                  onClick={() => setShowRemoveModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <UserMinus size={14} />
                  Remove {selectedEnrollments.size}
                </button>
              )}
              <button
                onClick={() => setShowEnrollModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ background: '#015035' }}
              >
                <UserPlus size={14} /> Enroll Contacts
              </button>
            </div>

            {/* Table */}
            {filteredEnrollments.length === 0 ? (
              <div className="text-center py-16">
                <Users size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">
                  {enrollments.length === 0 ? 'No contacts enrolled yet' : 'No contacts match your filters'}
                </p>
                {enrollments.length === 0 && (
                  <>
                    <p className="text-xs text-gray-400 mt-1">Add contacts to start running this sequence</p>
                    <button
                      onClick={() => setShowEnrollModal(true)}
                      className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2"
                      style={{ background: '#015035' }}
                    >
                      <UserPlus size={14} /> Enroll Contacts
                    </button>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEnrollments.size === filteredEnrollments.length && filteredEnrollments.length > 0}
                        onChange={() => {
                          if (selectedEnrollments.size === filteredEnrollments.length) {
                            setSelectedEnrollments(new Set())
                          } else {
                            setSelectedEnrollments(new Set(filteredEnrollments.map(e => e.id)))
                          }
                        }}
                        className="accent-emerald-600"
                      />
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</span>
                    </th>
                    <th className="text-center px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</span>
                    </th>
                    <th className="text-center px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Current Step</span>
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Enrolled</span>
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Next Send</span>
                    </th>
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map(e => {
                    const step = sequence.steps[e.currentStep]
                    const stepConfig = step ? stepTypeConfig[step.type] : null
                    return (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEnrollments.has(e.id)}
                            onChange={() => {
                              setSelectedEnrollments(prev => {
                                const next = new Set(prev)
                                if (next.has(e.id)) next.delete(e.id)
                                else next.add(e.id)
                                return next
                              })
                            }}
                            className="accent-emerald-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{e.contactName}</p>
                          <p className="text-xs text-gray-500">{e.contactEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                            e.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : e.status === 'completed'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-50 text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              e.status === 'active' ? 'bg-green-500' : e.status === 'completed' ? 'bg-blue-500' : 'bg-gray-400'
                            }`} />
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stepConfig ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: stepConfig.color }}>
                              {stepConfig.icon}
                              Step {e.currentStep + 1}: {stepConfig.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Step {e.currentStep + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">
                            {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">
                            {e.status === 'active' && e.nextSendAt
                              ? new Date(e.nextSendAt).toLocaleDateString()
                              : '—'}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => {
                              setSelectedEnrollments(new Set([e.id]))
                              setShowRemoveModal(true)
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors group"
                            title="Remove from sequence"
                          >
                            <UserMinus size={14} className="text-gray-300 group-hover:text-red-500" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Steps Tab */}
        {tab === 'steps' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {sequence.steps.length === 0 ? (
              <div className="text-center py-12">
                <Mail size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No steps configured</p>
                <p className="text-xs text-gray-400 mt-1">Add steps to define your outreach sequence</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sequence.steps.map((step, i) => {
                  const config = stepTypeConfig[step.type]
                  return (
                    <div key={step.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                          style={{ background: config.color }}
                        >
                          {config.icon}
                        </div>
                        {i < sequence.steps.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">Day {step.day} — {config.label}</p>
                        </div>
                        {step.subject && <p className="text-xs text-gray-600 mt-1">Subject: {step.subject}</p>}
                        {step.type === 'wait' && <p className="text-xs text-gray-500 mt-1">Wait {step.waitDays || step.day} day(s)</p>}
                        {step.taskTitle && <p className="text-xs text-gray-500 mt-1">Task: {step.taskTitle}</p>}
                        {step.smsBody && <p className="text-xs text-gray-500 mt-1">SMS: {step.smsBody}</p>}
                        {step.linkedinAction && <p className="text-xs text-gray-500 mt-1">LinkedIn: {step.linkedinAction}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Sequence Settings</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Name</p>
                <p className="text-gray-900">{sequence.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Status</p>
                <p className="text-gray-900">{sequence.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Trigger</p>
                <p className="text-gray-900">{sequence.trigger || 'Manual enrollment'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Target Segment</p>
                <p className="text-gray-900">{sequence.targetSegment || 'All contacts'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Created</p>
                <p className="text-gray-900">{sequence.createdDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Last Modified</p>
                <p className="text-gray-900">{sequence.lastModified}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 mt-6 pt-6">
              <h4 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h4>
              <p className="text-xs text-gray-500 mb-3">Deleting a sequence will remove all enrolled contacts and cannot be undone.</p>
              <button
                onClick={() => setShowDeleteSeqModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Delete Sequence
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEnrollModal && (
        <EnrollContactsModal
          sequenceId={sequenceId}
          existingEmails={existingEmails}
          onEnrolled={handleEnrolled}
          onClose={() => setShowEnrollModal(false)}
        />
      )}

      {showDeleteSeqModal && (
        <ConfirmModal
          title="Delete Sequence"
          message={`Are you sure you want to delete "${sequence.name}"? This will remove all ${sequence.enrolledCount} enrolled contacts and cannot be undone.`}
          confirmLabel="Delete Sequence"
          onConfirm={deleteSequence}
          onClose={() => setShowDeleteSeqModal(false)}
        />
      )}

      {showRemoveModal && (
        <ConfirmModal
          title="Remove from Sequence"
          message={`Remove ${selectedEnrollments.size} contact${selectedEnrollments.size !== 1 ? 's' : ''} from this sequence? They will stop receiving emails.`}
          confirmLabel="Remove"
          onConfirm={removeEnrollments}
          onClose={() => setShowRemoveModal(false)}
        />
      )}
    </>
  )
}
