'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import EmailBlockEditor from '@/components/email/EmailBlockEditor'
import EmailPreview from '@/components/email/EmailPreview'
import TemplatePicker from '@/components/email/TemplatePicker'
import { type EmailBlock, renderEmailHTML } from '@/lib/email-builder'
import {
  Mail, Send, Users, Trash2, Eye, Edit, X, Sparkles, CheckCircle,
  AlertCircle, Clock, BarChart3, ChevronLeft, Palette, Layout, FlaskConical,
  ChevronDown, ChevronRight, Calendar, Building2, Ban, MousePointerClick, ExternalLink,
} from 'lucide-react'

interface AudienceFilter {
  lifecycleStage?: string
  tags?: string[]
  owner?: string
  hasEmail?: boolean
  companyStatus?: string
  createdAfter?: string
  createdBefore?: string
  lastActivityAfter?: string
  lastActivityBefore?: string
  hasOpenedPrevious?: boolean
  hasClickedPrevious?: boolean
  neverContacted?: boolean
  industry?: string
  companySize?: string
  excludeTags?: string[]
  excludeRecentRecipientsDays?: number
}

interface Broadcast {
  id: string
  name: string
  subject: string
  fromName: string
  fromEmail: string
  replyTo?: string
  htmlBody: string
  plainBody?: string
  previewText?: string
  audienceFilter: AudienceFilter
  audienceCount: number
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduledAt?: string
  sentAt?: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalUnsubscribed: number
  abTestEnabled: boolean
  variantBSubject?: string
  abSplitPct: number
  abWinner?: string
  variantAOpens: number
  variantBOpens: number
  variantASent: number
  variantBSent: number
  createdAt: string
  updatedAt: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  scheduled: { bg: '#dbeafe', color: '#1e40af', label: 'Scheduled' },
  sending:   { bg: '#fef3c7', color: '#92400e', label: 'Sending' },
  sent:      { bg: '#d1fae5', color: '#065f46', label: 'Sent' },
  failed:    { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
}

export default function MarketingPage() {
  const { toast } = useToast()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Broadcast | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function load() {
    setLoading(true)
    fetch('/api/broadcasts')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setBroadcasts(data) })
      .catch(() => toast('Failed to load broadcasts', 'error'))
      .finally(() => setLoading(false))
  }

  const [showNewModal, setShowNewModal] = useState(false)
  const [newBcName, setNewBcName] = useState('')
  const [newBcSubject, setNewBcSubject] = useState('')

  async function createBroadcast(name: string, subject: string) {
    if (!name.trim() || !subject.trim()) return
    setShowNewModal(false)
    setNewBcName('')
    setNewBcSubject('')
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), subject: subject.trim() }),
      })
      if (!res.ok) { toast('Failed to create broadcast', 'error'); return }
      const created = await res.json()
      setBroadcasts(prev => [created, ...prev])
      setSelected(created)
      toast('Draft created', 'success')
    } catch {
      toast('Failed to create broadcast', 'error')
    }
  }

  async function deleteBroadcast(id: string) {
    if (!confirm('Delete this broadcast?')) return
    try {
      const res = await fetch(`/api/broadcasts/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete', 'error'); return }
      setBroadcasts(prev => prev.filter(b => b.id !== id))
      if (selected?.id === id) setSelected(null)
      toast('Deleted', 'success')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  async function updateBroadcast(id: string, patch: Partial<Broadcast>) {
    try {
      const res = await fetch(`/api/broadcasts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast('Failed to save', 'error'); return }
      const updated = await res.json()
      setBroadcasts(prev => prev.map(b => b.id === id ? updated : b))
      if (selected?.id === id) setSelected(updated)
      return updated
    } catch {
      toast('Failed to save', 'error')
    }
  }

  const activeCount = broadcasts.filter(b => b.status === 'sent').length
  const totalOpens = broadcasts.reduce((s, b) => s + b.totalOpened, 0)
  const totalSent = broadcasts.reduce((s, b) => s + b.totalSent, 0)
  const avgOpenRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
  }

  return (
    <>
      <Header
        title="Email Marketing"
        subtitle="Broadcasts and campaigns"
        action={{ label: 'New Broadcast', onClick: () => setShowNewModal(true) }}
      />
      <div className="page-content">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#01503515', color: '#015035' }}><Mail size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Broadcasts Sent</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#10b98115', color: '#10b981' }}><Send size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Emails Delivered</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{totalSent.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#3b82f615', color: '#3b82f6' }}><Eye size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Avg Open Rate</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{avgOpenRate}%</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#8b5cf615', color: '#8b5cf6' }}><BarChart3 size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Total Opens</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{totalOpens.toLocaleString()}</p>
          </div>
        </div>

        {/* Table */}
        {broadcasts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Mail size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No broadcasts yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Create one to send your first email campaign.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              New Broadcast
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Audience</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Opens</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Clicks</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="w-20 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map(b => {
                    const style = STATUS_STYLE[b.status]
                    const openRate = b.totalSent > 0 ? Math.round((b.totalOpened / b.totalSent) * 100) : 0
                    const clickRate = b.totalSent > 0 ? Math.round((b.totalClicked / b.totalSent) * 100) : 0
                    return (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{b.subject}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-sm text-gray-700 hidden md:table-cell">
                          {b.audienceCount || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center hidden md:table-cell">
                          <span className={`text-sm font-semibold ${openRate > 20 ? 'text-emerald-600' : 'text-gray-600'}`}>
                            {b.totalSent > 0 ? `${openRate}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-sm text-gray-600 hidden lg:table-cell">
                          {b.totalSent > 0 ? `${clickRate}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[11px] text-gray-500 hidden lg:table-cell">
                          {b.sentAt ? formatDate(b.sentAt) : formatDate(b.createdAt)}
                        </td>
                        <td className="px-2 py-3.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setSelected(b)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit size={13} /></button>
                            <button onClick={() => deleteBroadcast(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <BroadcastEditor
          broadcast={selected}
          onClose={() => setSelected(null)}
          onSave={(patch) => updateBroadcast(selected.id, patch)}
          onRefresh={load}
        />
      )}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">New Broadcast</h3>
              <p className="text-xs text-gray-500 mt-0.5">Name is internal — subject line is what recipients see.</p>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Broadcast name</label>
                <input
                  autoFocus
                  value={newBcName}
                  onChange={e => setNewBcName(e.target.value)}
                  placeholder="e.g. April Newsletter, SEO Tips Blast"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email subject line</label>
                <input
                  value={newBcSubject}
                  onChange={e => setNewBcSubject(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newBcName.trim() && newBcSubject.trim()) createBroadcast(newBcName.trim(), newBcSubject.trim()) }}
                  placeholder="e.g. 5 SEO tips to boost your traffic"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => createBroadcast(newBcName.trim(), newBcSubject.trim())}
                disabled={!newBcName.trim() || !newBcSubject.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                Create Draft
              </button>
              <button
                onClick={() => { setShowNewModal(false); setNewBcName(''); setNewBcSubject('') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AudienceSection({ title, icon, defaultOpen, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-emerald-600">{icon}</span>
        <span className="text-sm font-semibold text-gray-900 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}

function BroadcastEditor({
  broadcast,
  onClose,
  onSave,
  onRefresh,
}: {
  broadcast: Broadcast
  onClose: () => void
  onSave: (patch: Partial<Broadcast>) => Promise<Broadcast | undefined>
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'compose' | 'design' | 'preview' | 'audience' | 'send'>('compose')
  const [draft, setDraft] = useState<Broadcast>(broadcast)
  const [audiencePreview, setAudiencePreview] = useState<{ total: number; suppressed: number; estimated: number; sample: Array<{ id: string; email: string; name: string }> } | null>(null)
  const [sending, setSending] = useState(false)
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>([])
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const [clickData, setClickData] = useState<Array<{ url: string; totalClicks: number; uniqueClickers: number }>>([])
  const [clicksLoading, setClicksLoading] = useState(false)

  const isSent = broadcast.status === 'sent' || broadcast.status === 'sending'

  useEffect(() => {
    if (broadcast.status !== 'sent') return
    let cancelled = false
    fetch(`/api/broadcasts/${broadcast.id}/clicks`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled && Array.isArray(data)) setClickData(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setClicksLoading(false) })
    return () => { cancelled = true }
  }, [broadcast.id, broadcast.status])

  async function save() {
    // Render blocks to HTML before saving
    const htmlFromBlocks = emailBlocks.length > 0 ? renderEmailHTML(emailBlocks) : draft.htmlBody
    const updated = await onSave({
      name:        draft.name,
      subject:     draft.subject,
      fromName:    draft.fromName,
      fromEmail:   draft.fromEmail,
      replyTo:     draft.replyTo,
      previewText: draft.previewText,
      htmlBody:    htmlFromBlocks,
      audienceFilter: draft.audienceFilter,
    })
    if (updated) setDraft(updated)
  }

  async function previewAudience() {
    await save()
    const res = await fetch(`/api/broadcasts/${broadcast.id}/audience`)
    if (!res.ok) { toast('Failed to preview audience', 'error'); return }
    const data = await res.json()
    setAudiencePreview(data)
  }

  async function sendNow() {
    if (!confirm(`Send this broadcast to ${audiencePreview?.estimated ?? draft.audienceCount} contacts? This cannot be undone.`)) return
    setSending(true)
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to send', 'error')
        setSending(false)
        return
      }
      toast(`Sent to ${data.sent} contacts`, 'success')
      onRefresh()
      onClose()
    } catch {
      toast('Failed to send', 'error')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(680px,100vw)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">{draft.name}</h2>
            <p className="text-white/60 text-xs truncate">{draft.subject}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"><X size={16} className="text-white/70" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 px-5 overflow-x-auto">
          {([
            { id: 'compose' as const, label: 'Compose', icon: <Edit size={13} /> },
            { id: 'design' as const, label: 'Design', icon: <Layout size={13} /> },
            { id: 'preview' as const, label: 'Preview', icon: <Eye size={13} /> },
            { id: 'audience' as const, label: 'Audience', icon: <Users size={13} /> },
            { id: 'send' as const, label: 'Send', icon: <Send size={13} /> },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-emerald-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {tab === 'compose' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name (internal)</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  disabled={isSent}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject line</label>
                <input
                  value={draft.subject}
                  onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
                  disabled={isSent}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                />
              </div>
              {/* A/B Testing */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => !isSent && setDraft(d => ({ ...d, abTestEnabled: !d.abTestEnabled }))}
                  disabled={isSent}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical size={14} className="text-purple-500" />
                    <span className="text-xs font-semibold text-gray-700">A/B Test Subject Line</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${draft.abTestEnabled ? 'bg-purple-500' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${draft.abTestEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
                {draft.abTestEnabled && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Variant A (original)</label>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 truncate">{draft.subject || '(empty)'}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-1">Variant B</label>
                        <input
                          value={draft.variantBSubject ?? ''}
                          onChange={e => setDraft(d => ({ ...d, variantBSubject: e.target.value }))}
                          disabled={isSent}
                          placeholder="Alternative subject line..."
                          className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        Split: {draft.abSplitPct ?? 50}% A / {100 - (draft.abSplitPct ?? 50)}% B
                      </label>
                      <input
                        type="range" min={10} max={90} step={10}
                        value={draft.abSplitPct ?? 50}
                        onChange={e => setDraft(d => ({ ...d, abSplitPct: parseInt(e.target.value) }))}
                        disabled={isSent}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    {isSent && (draft.variantASent > 0 || draft.variantBSent > 0) && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">Variant A</p>
                          <p className="text-lg font-bold text-gray-900">{draft.variantASent > 0 ? `${Math.round((draft.variantAOpens / draft.variantASent) * 100)}%` : '—'}</p>
                          <p className="text-[10px] text-gray-400">{draft.variantAOpens}/{draft.variantASent} opened</p>
                        </div>
                        <div className={`rounded-lg p-3 text-center ${draft.abWinner === 'B' ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                          <p className="text-[10px] font-semibold text-purple-400 uppercase">Variant B {draft.abWinner === 'B' && '★'}</p>
                          <p className="text-lg font-bold text-gray-900">{draft.variantBSent > 0 ? `${Math.round((draft.variantBOpens / draft.variantBSent) * 100)}%` : '—'}</p>
                          <p className="text-[10px] text-gray-400">{draft.variantBOpens}/{draft.variantBSent} opened</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview text</label>
                <input
                  value={draft.previewText ?? ''}
                  onChange={e => setDraft(d => ({ ...d, previewText: e.target.value }))}
                  disabled={isSent}
                  placeholder="Shown after the subject in the inbox"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From name</label>
                  <input
                    value={draft.fromName}
                    onChange={e => setDraft(d => ({ ...d, fromName: e.target.value }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From email</label>
                  <input
                    value={draft.fromEmail}
                    onChange={e => setDraft(d => ({ ...d, fromEmail: e.target.value }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reply-to (optional)</label>
                <input
                  value={draft.replyTo ?? ''}
                  onChange={e => setDraft(d => ({ ...d, replyTo: e.target.value }))}
                  disabled={isSent}
                  placeholder="replies@gravissmarketing.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  Merge fields: <code className="bg-gray-100 px-1 rounded">{'{{first_name}}'}</code> <code className="bg-gray-100 px-1 rounded">{'{{company}}'}</code>
                </p>
                <button
                  onClick={() => setTab('design')}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  <Layout size={12} /> Open email designer →
                </button>
              </div>
            </>
          )}

          {/* Design tab — drag-and-drop email builder */}
          {tab === 'design' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Email Designer</p>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                  style={{ background: '#015035' }}
                >
                  <Palette size={12} /> Templates
                </button>
              </div>
              {!isSent ? (
                <EmailBlockEditor blocks={emailBlocks} onChange={setEmailBlocks} />
              ) : (
                <div className="py-8 text-center text-xs text-gray-400">
                  Email already sent — design is read-only
                </div>
              )}
            </div>
          )}

          {/* Preview tab — desktop/mobile preview */}
          {tab === 'preview' && (
            <div className="h-[500px]">
              <EmailPreview blocks={emailBlocks} subject={draft.subject} preheader={draft.previewText} />
            </div>
          )}

          {tab === 'audience' && (
            <>
              <AudienceSection title="Contact Properties" icon={<Users size={13} />} defaultOpen>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lifecycle stage</label>
                  <select
                    value={draft.audienceFilter.lifecycleStage ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, lifecycleStage: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  >
                    <option value="">Any stage</option>
                    <option>Lead</option>
                    <option>MQL</option>
                    <option>SQL</option>
                    <option>Customer</option>
                    <option>Evangelist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner</label>
                  <input
                    value={draft.audienceFilter.owner ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, owner: e.target.value || undefined } }))}
                    disabled={isSent}
                    placeholder="Jonathan Graviss"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags (comma-separated, must contain all)</label>
                  <input
                    value={(draft.audienceFilter.tags ?? []).join(', ')}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } }))}
                    disabled={isSent}
                    placeholder="seo-client, active"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
              </AudienceSection>

              <AudienceSection title="Engagement" icon={<BarChart3 size={13} />}>
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.audienceFilter.hasOpenedPrevious ?? false}
                      onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, hasOpenedPrevious: e.target.checked || undefined } }))}
                      disabled={isSent}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">Has opened a previous broadcast</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.audienceFilter.hasClickedPrevious ?? false}
                      onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, hasClickedPrevious: e.target.checked || undefined } }))}
                      disabled={isSent}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">Has clicked a previous broadcast</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.audienceFilter.neverContacted ?? false}
                      onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, neverContacted: e.target.checked || undefined } }))}
                      disabled={isSent}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">Never contacted</span>
                  </label>
                </div>
              </AudienceSection>

              <AudienceSection title="Date Filters" icon={<Calendar size={13} />}>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Created after</label>
                  <input
                    type="date"
                    value={draft.audienceFilter.createdAfter ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, createdAfter: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Created before</label>
                  <input
                    type="date"
                    value={draft.audienceFilter.createdBefore ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, createdBefore: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Last activity after</label>
                  <input
                    type="date"
                    value={draft.audienceFilter.lastActivityAfter ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, lastActivityAfter: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Last activity before</label>
                  <input
                    type="date"
                    value={draft.audienceFilter.lastActivityBefore ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, lastActivityBefore: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
              </AudienceSection>

              <AudienceSection title="Company" icon={<Building2 size={13} />}>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Industry</label>
                  <input
                    value={draft.audienceFilter.industry ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, industry: e.target.value || undefined } }))}
                    disabled={isSent}
                    placeholder="e.g. Technology, Healthcare"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company size</label>
                  <select
                    value={draft.audienceFilter.companySize ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, companySize: e.target.value || undefined } }))}
                    disabled={isSent}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  >
                    <option value="">Any size</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-1000">201-1000</option>
                    <option value="1001+">1001+</option>
                  </select>
                </div>
              </AudienceSection>

              <AudienceSection title="Exclusions" icon={<Ban size={13} />}>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Exclude tags (comma-separated)</label>
                  <input
                    value={(draft.audienceFilter.excludeTags ?? []).join(', ')}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, excludeTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } }))}
                    disabled={isSent}
                    placeholder="unsubscribed, do-not-email"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Exclude contacts who received a broadcast in the last N days</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.audienceFilter.excludeRecentRecipientsDays ?? ''}
                    onChange={e => setDraft(d => ({ ...d, audienceFilter: { ...d.audienceFilter, excludeRecentRecipientsDays: e.target.value ? parseInt(e.target.value, 10) : undefined } }))}
                    disabled={isSent}
                    placeholder="e.g. 7"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
                  />
                </div>
              </AudienceSection>

              {!isSent && (
                <button
                  onClick={previewAudience}
                  className="mt-2 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Users size={14} /> Preview Audience
                </button>
              )}

              {audiencePreview && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Matching</p>
                      <p className="text-xl font-bold text-gray-900">{audiencePreview.total}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Suppressed</p>
                      <p className="text-xl font-bold text-red-600">{audiencePreview.suppressed}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Will send</p>
                      <p className="text-xl font-bold text-emerald-700">{audiencePreview.estimated}</p>
                    </div>
                  </div>
                  {audiencePreview.sample.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Sample recipients</p>
                      <ul className="flex flex-col gap-1">
                        {audiencePreview.sample.map(s => (
                          <li key={s.id} className="text-xs text-gray-600 truncate">{s.name ? `${s.name} — ` : ''}{s.email}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'send' && (
            <>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3 mb-4">
                  <Sparkles size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Ready to send</p>
                    <p className="text-xs text-gray-500">Review the broadcast below before sending. Once sent, it cannot be undone.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Subject</span><span className="text-gray-900 font-medium truncate ml-4">{draft.subject}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">From</span><span className="text-gray-900 font-medium truncate ml-4">{draft.fromName} &lt;{draft.fromEmail}&gt;</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Audience</span><span className="text-gray-900 font-medium">{audiencePreview?.estimated ?? draft.audienceCount} contacts</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="text-gray-900 font-medium capitalize">{draft.status}</span></div>
                </div>
              </div>

              {isSent && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Performance</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-500">Sent</p>
                      <p className="text-lg font-bold text-gray-900">{broadcast.totalSent}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Delivered</p>
                      <p className="text-lg font-bold text-gray-900">{broadcast.totalDelivered}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Opened</p>
                      <p className="text-lg font-bold text-emerald-700">{broadcast.totalOpened}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Clicked</p>
                      <p className="text-lg font-bold text-emerald-700">{broadcast.totalClicked}</p>
                    </div>
                  </div>
                </div>
              )}

              {broadcast.status === 'sent' && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MousePointerClick size={14} className="text-emerald-600" />
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Link Click Tracking</p>
                  </div>
                  {clicksLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
                    </div>
                  ) : clickData.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No link clicks recorded yet</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {clickData.map((link, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                          <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate" title={link.url}>
                              {link.url.length > 60 ? link.url.slice(0, 60) + '...' : link.url}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {link.uniqueClickers} unique {link.uniqueClickers === 1 ? 'clicker' : 'clickers'}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-emerald-700">{link.totalClicks}</p>
                            <p className="text-[10px] text-gray-400">{link.totalClicks === 1 ? 'click' : 'clicks'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Template picker modal */}
        {showTemplatePicker && (
          <TemplatePicker
            onSelect={(blocks) => { setEmailBlocks(blocks); setShowTemplatePicker(false); setTab('design') }}
            onClose={() => setShowTemplatePicker(false)}
          />
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {!isSent ? (
            <>
              <button
                onClick={save}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Save Draft
              </button>
              {tab === 'send' && (
                <button
                  onClick={sendNow}
                  disabled={sending}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: '#dc2626' }}
                >
                  <Send size={14} /> {sending ? 'Sending…' : 'Send Now'}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
