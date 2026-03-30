'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import Header from '@/components/layout/Header'
import CRMSubNav from '@/components/crm/CRMSubNav'
import {
  X, Mail, Plus, Play, Pause, CheckCircle, Clock, Users, Zap,
  ChevronRight, Edit2, Copy, TrendingUp, Search, MoreHorizontal,
  Eye, MousePointerClick, Trash2, ArrowUpDown, Filter,
  Phone, MessageCircle, Linkedin, BarChart3,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SequenceStatus = 'Active' | 'Paused' | 'Draft' | 'Completed'
type StepType = 'email' | 'manual_email' | 'wait' | 'task' | 'condition' | 'sms' | 'linkedin' | 'call'
type HtmlTemplate = 'branded' | 'minimal' | 'plain'

interface SequenceStep {
  id: string
  type: StepType
  day: number
  subject?: string
  body?: string
  htmlTemplate?: HtmlTemplate
  cc?: string
  bcc?: string
  replyTo?: string
  waitDays?: number
  taskTitle?: string
  condition?: string
  // A/B testing
  abEnabled?: boolean
  variantB?: { subject?: string; body?: string }
  abSplit?: number // percentage for variant A (default 50)
  abWinner?: 'A' | 'B' | null
  // Multichannel
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
  sendVia: 'gmail' | 'resend'
  fromName?: string
  // New fields
  meetingRate?: number
  bounceRate?: number
  unsubscribeRate?: number
  owner?: string
}

const statusColors: Record<SequenceStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: 'bg-green-50',  text: 'text-green-700',  dot: '#015035' },
  Paused:    { bg: 'bg-gray-50',   text: 'text-gray-500',   dot: '#9ca3af' },
  Draft:     { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: '#f59e0b' },
  Completed: { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: '#3b82f6' },
}

const stepTypeConfig: Record<StepType, { color: string; label: string; icon: React.ReactNode }> = {
  email:        { color: '#3b82f6', label: 'Automated Email', icon: <Mail size={14} /> },
  manual_email: { color: '#8b5cf6', label: 'Manual Email',    icon: <Edit2 size={14} /> },
  wait:         { color: '#9ca3af', label: 'Delay',           icon: <Clock size={14} /> },
  task:         { color: '#10b981', label: 'Task',            icon: <CheckCircle size={14} /> },
  condition:    { color: '#f59e0b', label: 'Branch',          icon: <Zap size={14} /> },
  sms:          { color: '#06b6d4', label: 'SMS',             icon: <MessageCircle size={14} /> },
  linkedin:     { color: '#0077b5', label: 'LinkedIn',        icon: <Linkedin size={14} /> },
  call:         { color: '#ef4444', label: 'Call',            icon: <Phone size={14} /> },
}

// ─── New Sequence Modal ─────────────────────────────────────────────────────────

function NewSequenceModal({ onSave, onClose }: { onSave: (s: EmailSequence) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [segment, setSegment] = useState('')
  const [sendVia, setSendVia] = useState<'gmail' | 'resend'>('gmail')
  const [fromName, setFromName] = useState('')

  function save() {
    if (!name.trim()) return
    const newSeq: EmailSequence = {
      id: `seq-${Date.now()}`,
      name: name.trim(),
      status: 'Draft',
      trigger: trigger.trim() || 'Manual enrollment',
      targetSegment: segment.trim() || 'All contacts',
      enrolledCount: 0,
      activeCount: 0,
      completedCount: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      steps: [],
      createdDate: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      sendVia,
      fromName: fromName.trim() || undefined,
      meetingRate: 0,
      bounceRate: 0,
      unsubscribeRate: 0,
    }
    onSave(newSeq)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Create Sequence</h3>
            <p className="text-xs text-gray-500 mt-0.5">Set up your outreach sequence</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sequence Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Lead Nurture — SEO"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trigger / Enrollment Rule</label>
            <input
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              placeholder="e.g. Contact tagged as New Lead + Service = SEO"
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target Segment</label>
            <input
              value={segment}
              onChange={e => setSegment(e.target.value)}
              placeholder="e.g. SEO prospects"
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Send Settings</p>
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Send Via</label>
              <div className="flex gap-3">
                {(['gmail', 'resend'] as const).map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="newSeqSendVia" value={v} checked={sendVia === v} onChange={() => setSendVia(v)} className="accent-emerald-600" />
                    <span className="text-sm text-gray-700">{v === 'gmail' ? 'Gmail (from your inbox)' : 'System email (Resend)'}</span>
                  </label>
                ))}
              </div>
              {sendVia === 'gmail' && <p className="text-[11px] text-amber-600 mt-1.5">Gmail requires your inbox to be connected.</p>}
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">From Name</label>
              <input
                value={fromName}
                onChange={e => setFromName(e.target.value)}
                placeholder="Defaults to your name"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={!name.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity" style={{ background: '#015035' }}>
              Create Sequence
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Actions Dropdown ────────────────────────────────────────────────────────

function ActionsDropdown({ seq, onUpdate, onDelete }: { seq: EmailSequence; onUpdate: (s: EmailSequence) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(!open) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <MoreHorizontal size={16} className="text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 min-w-[180px]">
            <button
              className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={e => { e.stopPropagation(); onUpdate({ ...seq, status: seq.status === 'Active' ? 'Paused' : 'Active' as SequenceStatus }); setOpen(false) }}
            >
              {seq.status === 'Active' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
            </button>
            <button
              className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={e => {
                e.stopPropagation()
                onUpdate({
                  ...seq,
                  id: `seq-copy-${Date.now()}`,
                  name: `${seq.name} (Copy)`,
                  status: 'Draft',
                  enrolledCount: 0, activeCount: 0, completedCount: 0,
                  openRate: 0, clickRate: 0, replyRate: 0,
                  createdDate: new Date().toISOString().split('T')[0],
                  lastModified: new Date().toISOString().split('T')[0],
                })
                setOpen(false)
              }}
            >
              <Copy size={13} /> Duplicate
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={e => { e.stopPropagation(); onDelete(seq.id); setOpen(false) }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sequences, setSequences] = useState<EmailSequence[]>([])
  const [statusFilter, setStatusFilter] = useState<SequenceStatus | 'All'>('All')
  const [creatingSeq, setCreatingSeq] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'enrolled' | 'reply' | 'modified'>('modified')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [topTab, setTopTab] = useState<'manage' | 'analyze' | 'automate' | 'scheduled'>('manage')

  useEffect(() => {
    fetch('/api/sequences')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setSequences(d) })
      .catch(() => toast('Failed to load sequences', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleSort = useCallback((col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }, [sortBy])

  async function addSequence(newSeq: EmailSequence) {
    const res = await fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSeq),
    })
    if (res.ok) {
      const saved = await res.json()
      setSequences(prev => [saved, ...prev])
      router.push(`/crm/sequences/${saved.id}`)
    }
    setCreatingSeq(false)
  }

  async function updateSequence(updated: EmailSequence) {
    const exists = sequences.some(s => s.id === updated.id)
    if (exists) {
      setSequences(prev => prev.map(s => s.id === updated.id ? updated : s))
      await fetch(`/api/sequences/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
    } else {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (res.ok) {
        const saved = await res.json()
        setSequences(prev => [saved, ...prev])
      }
    }
  }

  async function deleteSequence(id: string) {
    setSequences(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/sequences/${id}`, { method: 'DELETE' })
    toast('Sequence deleted', 'success')
  }

  // Filter + sort
  let filtered = statusFilter === 'All' ? sequences : sequences.filter(s => s.status === statusFilter)
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.trigger.toLowerCase().includes(q))
  }
  filtered = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortBy) {
      case 'name': return dir * a.name.localeCompare(b.name)
      case 'enrolled': return dir * (a.enrolledCount - b.enrolledCount)
      case 'reply': return dir * (a.replyRate - b.replyRate)
      case 'modified': return dir * (a.lastModified || '').localeCompare(b.lastModified || '')
      default: return 0
    }
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  const totalEnrolled = sequences.reduce((s, q) => s + q.enrolledCount, 0)
  const avgReplyRate = sequences.length > 0 ? (sequences.reduce((s, q) => s + q.replyRate, 0) / sequences.length).toFixed(1) : '0'
  const activeCount = sequences.filter(s => s.status === 'Active').length

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: 'Create Sequence', onClick: () => setCreatingSeq(true) }}
      />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Page Title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Sequences</h2>
            <p className="text-xs text-gray-500 mt-0.5">{sequences.length} of 5,000 created</p>
          </div>
        </div>

        {/* Top Tabs (HubSpot-style) */}
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {(['manage', 'analyze', 'automate', 'scheduled'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTopTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                topTab === t
                  ? 'border-emerald-600 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {topTab === 'manage' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Sequences', value: sequences.length.toString(), icon: <Mail size={16} />, color: '#015035' },
                { label: 'Active', value: activeCount.toString(), icon: <Play size={14} />, color: '#10b981' },
                { label: 'Total Enrolled', value: totalEnrolled.toString(), icon: <Users size={16} />, color: '#3b82f6' },
                { label: 'Avg Reply Rate', value: `${avgReplyRate}%`, icon: <TrendingUp size={16} />, color: '#8b5cf6' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c.color}12`, color: c.color }}>
                      {c.icon}
                    </div>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold">{c.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search sequences..."
                  className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {(['All', 'Active', 'Paused', 'Draft', 'Completed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                      statusFilter === s
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                    {s !== 'All' && <span className="ml-1 opacity-60">({sequences.filter(q => q.status === s).length})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                        Name <ArrowUpDown size={10} />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3">
                      <button onClick={() => handleSort('enrolled')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 mx-auto">
                        Total Enrolled <ArrowUpDown size={10} />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3">
                      <button onClick={() => handleSort('reply')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 mx-auto">
                        Reply Rate <ArrowUpDown size={10} />
                      </button>
                    </th>
                    <th className="text-center px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Meeting Rate</span>
                    </th>
                    <th className="text-center px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Open Rate</span>
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Owner</span>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => handleSort('modified')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 ml-auto">
                        Date Modified <ArrowUpDown size={10} />
                      </button>
                    </th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(seq => (
                    <tr
                      key={seq.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/crm/sequences/${seq.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: statusColors[seq.status].dot }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                {seq.name}
                              </p>
                              {seq.status === 'Draft' && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Draft</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-gray-400">
                                {seq.steps.filter(s => s.type === 'email' || s.type === 'manual_email').length} emails
                              </span>
                              {seq.steps.some(s => s.type === 'linkedin') && (
                                <span className="text-[11px] text-[#0077b5] flex items-center gap-0.5"><Linkedin size={9} /> LinkedIn</span>
                              )}
                              {seq.steps.some(s => s.type === 'sms') && (
                                <span className="text-[11px] text-cyan-600 flex items-center gap-0.5"><MessageCircle size={9} /> SMS</span>
                              )}
                              {seq.steps.some(s => s.type === 'call') && (
                                <span className="text-[11px] text-red-500 flex items-center gap-0.5"><Phone size={9} /> Call</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-gray-900">{seq.enrolledCount}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-semibold ${seq.replyRate > 8 ? 'text-emerald-600' : 'text-gray-600'}`}>
                          {seq.replyRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-gray-600">{seq.meetingRate ?? 0}%</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-gray-600">{seq.openRate}%</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-gray-600">{seq.owner || 'Unassigned'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm text-gray-500">{seq.lastModified || '—'}</span>
                      </td>
                      <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                        <ActionsDropdown seq={seq} onUpdate={updateSequence} onDelete={deleteSequence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <Mail size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No sequences found</p>
                  <p className="text-xs text-gray-400 mt-1">Create your first sequence to start automating outreach</p>
                  <button
                    onClick={() => setCreatingSeq(true)}
                    className="mt-4 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                    style={{ background: '#015035' }}
                  >
                    Create Sequence
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {topTab === 'analyze' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 size={20} className="text-gray-400" />
              <h3 className="text-base font-bold text-gray-900">Sequence Analytics</h3>
            </div>
            <div className="grid grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Average Open Rate', value: sequences.length ? `${(sequences.reduce((s, q) => s + q.openRate, 0) / sequences.length).toFixed(1)}%` : '0%', benchmark: '21%', good: sequences.length > 0 && sequences.reduce((s, q) => s + q.openRate, 0) / sequences.length > 21 },
                { label: 'Average Reply Rate', value: sequences.length ? `${(sequences.reduce((s, q) => s + q.replyRate, 0) / sequences.length).toFixed(1)}%` : '0%', benchmark: '8%', good: sequences.length > 0 && sequences.reduce((s, q) => s + q.replyRate, 0) / sequences.length > 8 },
                { label: 'Total Contacts Reached', value: totalEnrolled.toString(), benchmark: '', good: true },
              ].map(m => (
                <div key={m.label} className="p-5 bg-gray-50 rounded-xl text-center">
                  <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: m.good ? '#015035' : '#6b7280' }}>{m.value}</p>
                  <p className="text-xs font-semibold text-gray-600">{m.label}</p>
                  {m.benchmark && (
                    <p className="text-[11px] text-gray-400 mt-1">Industry avg: {m.benchmark}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-sm font-bold text-gray-700 mb-4">Top Performing Sequences</h4>
              <div className="flex flex-col gap-2">
                {[...sequences].sort((a, b) => b.replyRate - a.replyRate).slice(0, 5).map((seq, i) => (
                  <div key={seq.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{seq.name}</p>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-gray-500">{seq.enrolledCount} enrolled</span>
                      <span className="text-blue-600">{seq.openRate}% open</span>
                      <span className="font-semibold text-emerald-600">{seq.replyRate}% reply</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {topTab === 'automate' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-2">
              <Zap size={20} className="text-amber-500" />
              <h3 className="text-base font-bold text-gray-900">Automate Enrollment</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">Automatically enroll or unenroll contacts from sequences based on triggers</p>
            <div className="p-6 bg-gray-50 rounded-xl text-center">
              <p className="text-sm text-gray-500">Configure automation rules within each sequence&apos;s Automate tab</p>
              <p className="text-xs text-gray-400 mt-1">Open a sequence and go to the Automate tab to set up rules</p>
            </div>
          </div>
        )}

        {topTab === 'scheduled' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={20} className="text-gray-400" />
              <h3 className="text-base font-bold text-gray-900">Scheduled Sends</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">View upcoming scheduled sequence steps across all active sequences</p>
            {sequences.filter(s => s.status === 'Active').length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-xl text-center">
                <p className="text-sm text-gray-400">No active sequences with scheduled sends</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sequences.filter(s => s.status === 'Active').map(seq => (
                  <div key={seq.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{seq.name}</p>
                      <p className="text-xs text-gray-500">{seq.activeCount} contacts pending next step</p>
                    </div>
                    <span className="text-xs text-gray-400">{seq.steps.filter(s => s.type === 'email' || s.type === 'manual_email').length} email steps</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {creatingSeq && <NewSequenceModal onSave={addSequence} onClose={() => setCreatingSeq(false)} />}
    </>
  )
}
