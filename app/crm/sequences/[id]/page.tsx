'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import Header from '@/components/layout/Header'
import {
  X, Mail, Plus, Play, Pause, CheckCircle, Clock, Users, Zap,
  ChevronLeft, Edit2, Copy, TrendingUp, Search, MoreHorizontal,
  Eye, Trash2, ArrowUpDown, UserMinus, UserPlus, Phone,
  Linkedin, AlertCircle, Send, ChevronUp, ChevronDown,
} from 'lucide-react'
import type { SequenceStatus, SequenceStepType, SequenceStep, EmailSequence, TeamMember } from '@/lib/types'
import SequenceStepEditor from '@/components/crm/SequenceStepEditor'
import SequenceAutomateTab from '@/components/crm/SequenceAutomateTab'
import { fetchTeamMembers } from '@/lib/supabase'

type StepType = SequenceStepType

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

interface SequenceAnalytics {
  overview: {
    totalSent: number
    totalDelivered: number
    totalOpened: number
    totalClicked: number
    totalReplied: number
    totalBounced: number
    totalUnsubscribed: number
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number
    unsubscribeRate: number
  }
  stepMetrics: {
    stepIndex: number
    sent: number
    opened: number
    clicked: number
    replied: number
    bounced: number
    openRate: number
    clickRate: number
    replyRate: number
  }[]
  dailySends: { date: string; count: number }[]
  abResults?: {
    stepIndex: number
    variantA: { sent: number; opened: number; clicked: number; replied: number }
    variantB: { sent: number; opened: number; clicked: number; replied: number }
    winner: 'A' | 'B' | null
  }[]
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
  const [tab, setTab] = useState<'people' | 'steps' | 'performance' | 'automate' | 'settings'>('people')
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollStatusFilter, setEnrollStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all')
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set())
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [showDeleteSeqModal, setShowDeleteSeqModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [editingStep, setEditingStep] = useState<SequenceStep | 'new' | null>(null)
  const [savingSteps, setSavingSteps] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [settingsForm, setSettingsForm] = useState<Partial<EmailSequence> | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [analytics, setAnalytics] = useState<SequenceAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

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
        if (found && found.steps.length === 0) setTab('steps')
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
  useEffect(() => { fetchTeamMembers().then(setTeamMembers).catch(() => {}) }, [])
  useEffect(() => {
    if (tab !== 'performance' || analyticsLoaded) return
    setAnalyticsLoading(true)
    fetch(`/api/sequences/analytics?sequenceId=${sequenceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setAnalytics)
      .catch(() => toast('Failed to load performance data', 'error'))
      .finally(() => { setAnalyticsLoading(false); setAnalyticsLoaded(true) })
  }, [tab, analyticsLoaded, sequenceId, toast])
  useEffect(() => {
    if (sequence && !settingsForm) {
      setSettingsForm({
        sendVia: sequence.sendVia,
        fromName: sequence.fromName,
        fromEmail: sequence.fromEmail,
        assignedRepId: sequence.assignedRepId,
        timezone: sequence.timezone,
        sendWindowStart: sequence.sendWindowStart,
        sendWindowEnd: sequence.sendWindowEnd,
        sendOnWeekends: sequence.sendOnWeekends,
        dailySendLimit: sequence.dailySendLimit,
        perMinuteLimit: sequence.perMinuteLimit,
        threadMode: sequence.threadMode,
        sharing: sequence.sharing,
      })
    }
  }, [sequence, settingsForm])

  async function saveSettings() {
    if (!sequence || !settingsForm) return
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/sequences/${sequenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setSequence(prev => prev ? { ...prev, ...updated } : prev)
      toast('Settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

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

  // Reordering/deleting/cloning can leave `day` (cumulative offset from
  // enrollment, consumed by execute/route.ts as an absolute schedule) out of
  // order relative to array position. Force it non-decreasing so the executor
  // never computes a zero/negative gap between consecutive steps.
  function normalizeStepDays(steps: SequenceStep[]): SequenceStep[] {
    let minDay = 0
    return steps.map((s, i) => {
      const day = i === 0 ? s.day : Math.max(s.day, minDay)
      minDay = day + 1
      return day === s.day ? s : { ...s, day }
    })
  }

  async function persistSteps(rawSteps: SequenceStep[]) {
    if (!sequence) return
    const steps = normalizeStepDays(rawSteps)
    const previous = sequence.steps
    setSequence({ ...sequence, steps })
    setSavingSteps(true)
    try {
      const res = await fetch(`/api/sequences/${sequenceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast('Failed to save steps — reverted', 'error')
      setSequence(prev => prev ? { ...prev, steps: previous } : prev)
    } finally {
      setSavingSteps(false)
    }
  }

  function handleSaveStep(step: SequenceStep) {
    if (!sequence) return
    const exists = sequence.steps.some(s => s.id === step.id)
    const nextSteps = exists
      ? sequence.steps.map(s => s.id === step.id ? step : s)
      : [...sequence.steps, step]
    persistSteps(nextSteps)
    setEditingStep(null)
  }

  function handleDeleteStep(id: string) {
    if (!sequence) return
    persistSteps(sequence.steps.filter(s => s.id !== id))
  }

  function handleCloneStep(step: SequenceStep) {
    if (!sequence) return
    const clone: SequenceStep = { ...step, id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
    const idx = sequence.steps.findIndex(s => s.id === step.id)
    const nextSteps = [...sequence.steps]
    nextSteps.splice(idx + 1, 0, clone)
    persistSteps(nextSteps)
  }

  function handleMoveStep(id: string, direction: 'up' | 'down') {
    if (!sequence) return
    const idx = sequence.steps.findIndex(s => s.id === id)
    const swapWith = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapWith < 0 || swapWith >= sequence.steps.length) return
    const nextSteps = [...sequence.steps]
    ;[nextSteps[idx], nextSteps[swapWith]] = [nextSteps[swapWith], nextSteps[idx]]
    persistSteps(nextSteps)
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

  async function sendTestEmail() {
    setTestSending(true)
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/test-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jonathan@gravissmarketing.com' }),
      })
      const data = await res.json()
      if (res.ok) {
        toast(`Test email sent — "${data.subject}"`, 'success')
      } else {
        toast(data.error || 'Failed to send test', 'error')
      }
    } catch {
      toast('Failed to send test email', 'error')
    } finally {
      setTestSending(false)
    }
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
      <div className="p-4 md:p-6 flex-1 flex flex-col bg-[#f8faf9]">
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
            <p className="text-xs text-gray-500 mt-0.5">
              {sequence.trigger || 'Manual enrollment'}
              {sequence.fromEmail && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                  <Send size={9} />
                  Sending via {sequence.sendVia === 'gmail' ? 'Gmail' : 'Resend'} — {sequence.fromEmail}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStatus}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {sequence.status === 'Active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Activate</>}
            </button>
            <button
              onClick={sendTestEmail}
              disabled={testSending || !sequence.steps.some(s => s.type === 'email')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Send size={14} />
              {testSending ? 'Sending...' : 'Test Send'}
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
          {(['people', 'steps', 'performance', 'automate', 'settings'] as const).map(t => (
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
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">{savingSteps ? 'Saving…' : `${sequence.steps.length} step${sequence.steps.length === 1 ? '' : 's'}`}</p>
              <button
                onClick={() => setEditingStep('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90"
                style={{ background: '#015035' }}
              >
                <Plus size={13} /> Add Step
              </button>
            </div>
            {sequence.steps.length === 0 ? (
              <div className="text-center py-12">
                <Mail size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No steps configured</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Add steps to define your outreach sequence</p>
                <button
                  onClick={() => setEditingStep('new')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> Add First Step
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sequence.steps.map((step, i) => {
                  const config = stepTypeConfig[step.type]
                  return (
                    <div key={step.id} className="flex items-start gap-4 group">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: config.color }}
                        >
                          {config.icon}
                        </div>
                        {i < sequence.steps.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {i === 0 && step.day === 0 ? 'Send now' : `Day ${step.day}`} — {config.label}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={() => handleMoveStep(step.id, 'up')} disabled={i === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move up">
                              <ChevronUp size={13} className="text-gray-500" />
                            </button>
                            <button onClick={() => handleMoveStep(step.id, 'down')} disabled={i === sequence.steps.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" title="Move down">
                              <ChevronDown size={13} className="text-gray-500" />
                            </button>
                            <button onClick={() => setEditingStep(step)} className="p-1 rounded hover:bg-gray-100" title="Edit">
                              <Edit2 size={13} className="text-gray-500" />
                            </button>
                            <button onClick={() => handleCloneStep(step)} className="p-1 rounded hover:bg-gray-100" title="Clone">
                              <Copy size={13} className="text-gray-500" />
                            </button>
                            <button onClick={() => handleDeleteStep(step.id)} className="p-1 rounded hover:bg-red-50" title="Delete">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                        {step.subject && <p className="text-xs text-gray-600 mt-1 truncate">Subject: {step.subject}</p>}
                        {step.taskTitle && <p className="text-xs text-gray-500 mt-1 truncate">Task: {step.taskTitle}</p>}
                        {step.type !== 'email' && step.pauseUntilComplete && (
                          <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">PAUSES SEQUENCE</span>
                        )}
                        {step.type === 'email' && step.abEnabled && (
                          <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">A/B TEST · {step.abSplit ?? 50}/{100 - (step.abSplit ?? 50)}</span>
                        )}
                        {step.linkedinAction && <p className="text-xs text-gray-500 mt-1">LinkedIn: {step.linkedinAction}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Performance Tab */}
        {tab === 'performance' && (
          <div className="flex flex-col gap-4">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : !analytics ? (
              <p className="text-sm text-gray-400 text-center py-16">No performance data yet.</p>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Overview</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { label: 'Sent', value: analytics.overview.totalSent },
                      { label: 'Open Rate', value: `${analytics.overview.openRate}%` },
                      { label: 'Click Rate', value: `${analytics.overview.clickRate}%` },
                      { label: 'Reply Rate', value: `${analytics.overview.replyRate}%` },
                      { label: 'Bounce Rate', value: `${analytics.overview.bounceRate}%` },
                      { label: 'Unsub Rate', value: `${analytics.overview.unsubscribeRate}%` },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{s.value}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {analytics.stepMetrics.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900">Step Performance</h3>
                    </div>
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th>Step</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Replied</th><th>Open Rate</th><th>Click Rate</th><th>Reply Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.stepMetrics.map(s => {
                          const step = sequence.steps[s.stepIndex]
                          return (
                            <tr key={s.stepIndex}>
                              <td className="text-sm text-gray-800">Step {s.stepIndex + 1}{step ? ` — ${stepTypeConfig[step.type].label}` : ''}</td>
                              <td className="text-sm text-gray-600">{s.sent}</td>
                              <td className="text-sm text-gray-600">{s.opened}</td>
                              <td className="text-sm text-gray-600">{s.clicked}</td>
                              <td className="text-sm text-gray-600">{s.replied}</td>
                              <td className="text-sm text-gray-600">{s.openRate}%</td>
                              <td className="text-sm text-gray-600">{s.clickRate}%</td>
                              <td className="text-sm text-gray-600">{s.replyRate}%</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {analytics.abResults && analytics.abResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">A/B Test Results</h3>
                    <div className="flex flex-col gap-4">
                      {analytics.abResults.map(r => {
                        const step = sequence.steps[r.stepIndex]
                        return (
                          <div key={r.stepIndex}>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Step {r.stepIndex + 1}{step?.subject ? ` — ${step.subject}` : ''}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {(['A', 'B'] as const).map(v => {
                                const data = v === 'A' ? r.variantA : r.variantB
                                const openRate = data.sent > 0 ? Math.round((data.opened / data.sent) * 1000) / 10 : 0
                                return (
                                  <div key={v} className={`rounded-xl p-3 text-center border ${r.winner === v ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className="text-[10px] font-semibold text-purple-400 uppercase">Variant {v} {r.winner === v && '★'}</p>
                                    <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{data.sent > 0 ? `${openRate}%` : '—'}</p>
                                    <p className="text-[10px] text-gray-400">{data.opened}/{data.sent} opened · {data.replied} replied</p>
                                  </div>
                                )
                              })}
                            </div>
                            {r.winner === null && (r.variantA.sent < 5 || r.variantB.sent < 5) && (
                              <p className="text-[11px] text-gray-400 mt-1.5">Need at least 5 sends per variant before declaring a winner.</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Automate Tab */}
        {tab === 'automate' && (
          <SequenceAutomateTab sequenceId={sequenceId} />
        )}

        {/* Settings Tab */}
        {tab === 'settings' && settingsForm && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Name</p>
                  <p className="text-gray-900">{sequence.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Status</p>
                  <p className="text-gray-900">{sequence.status}</p>
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
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Sender</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Send via</label>
                  <select
                    value={settingsForm.sendVia}
                    onChange={e => setSettingsForm(f => f ? { ...f, sendVia: e.target.value as 'gmail' | 'resend' } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="gmail">Gmail (rep's own inbox)</option>
                    <option value="resend">Resend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Default rep</label>
                  <select
                    value={settingsForm.assignedRepId ?? ''}
                    onChange={e => setSettingsForm(f => f ? { ...f, assignedRepId: e.target.value || null } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sequence's fromEmail only</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Name</label>
                  <input
                    value={settingsForm.fromName ?? ''}
                    onChange={e => setSettingsForm(f => f ? { ...f, fromName: e.target.value } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From Email</label>
                  <input
                    value={settingsForm.fromEmail ?? ''}
                    onChange={e => setSettingsForm(f => f ? { ...f, fromEmail: e.target.value } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                When a default rep is set, per-enrollment sending still prefers that enrollment's own assigned rep first — this is only the fallback.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Timing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Timezone</label>
                  <input
                    value={settingsForm.timezone ?? ''}
                    onChange={e => setSettingsForm(f => f ? { ...f, timezone: e.target.value } : f)}
                    placeholder="America/New_York"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.sendOnWeekends ?? false}
                      onChange={e => setSettingsForm(f => f ? { ...f, sendOnWeekends: e.target.checked } : f)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Send on weekends</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Send window start (hour, 0-23)</label>
                  <input
                    type="number" min={0} max={23}
                    value={settingsForm.sendWindowStart ?? 8}
                    onChange={e => setSettingsForm(f => f ? { ...f, sendWindowStart: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Send window end (hour, 0-23)</label>
                  <input
                    type="number" min={0} max={23}
                    value={settingsForm.sendWindowEnd ?? 18}
                    onChange={e => setSettingsForm(f => f ? { ...f, sendWindowEnd: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-[11px] text-amber-700">
                  The sequence engine currently only runs once a day (via the shared daily cron), so a step can only ever
                  advance once per ~24h regardless of these settings — they take effect once the run cadence is increased.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Limits & Sharing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Daily send limit</label>
                  <input
                    type="number" min={1}
                    value={settingsForm.dailySendLimit ?? 200}
                    onChange={e => setSettingsForm(f => f ? { ...f, dailySendLimit: Math.max(1, parseInt(e.target.value) || 1) } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Per-minute limit</label>
                  <input
                    type="number" min={1}
                    value={settingsForm.perMinuteLimit ?? 3}
                    onChange={e => setSettingsForm(f => f ? { ...f, perMinuteLimit: Math.max(1, parseInt(e.target.value) || 1) } : f)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sharing</label>
                  <div className="flex gap-2">
                    {(['private', 'everyone'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setSettingsForm(f => f ? { ...f, sharing: s } : f)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border capitalize transition-colors ${
                          settingsForm.sharing === s ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                        style={settingsForm.sharing === s ? { background: '#015035' } : undefined}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.threadMode ?? true}
                      onChange={e => setSettingsForm(f => f ? { ...f, threadMode: e.target.checked } : f)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Reply in same thread</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                style={{ background: '#015035' }}
              >
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
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
      {editingStep && (
        <SequenceStepEditor
          step={editingStep === 'new' ? null : editingStep}
          previousStepDay={(() => {
            if (editingStep === 'new') {
              return sequence.steps.length > 0 ? sequence.steps[sequence.steps.length - 1].day : null
            }
            const idx = sequence.steps.findIndex(s => s.id === editingStep.id)
            return idx > 0 ? sequence.steps[idx - 1].day : null
          })()}
          onSave={handleSaveStep}
          onClose={() => setEditingStep(null)}
        />
      )}

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
