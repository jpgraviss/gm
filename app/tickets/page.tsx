'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import LoadingScreen from '@/components/ui/LoadingScreen'
import NewTicketPanel, { type NewTicketFormData } from '@/components/crm/NewTicketPanel'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { downloadCsv } from '@/lib/csv-export'
import {
  MessageSquare, CheckCircle, Clock, X, ExternalLink,
  Plus, ChevronRight, Send, User, FolderKanban,
  Zap, Circle, Trash2, Search, Inbox, Download,
} from 'lucide-react'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'

type TicketStatus = 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed'
type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
type TicketSource = 'Client Portal' | 'Email' | 'Phone' | 'Internal'

interface TicketMessage {
  id: string
  author: string
  isInternal: boolean
  body: string
  timestamp: string
  attachments?: { name: string; url: string; path: string; type: string; size: number }[]
}

interface Ticket {
  id: string
  subject: string
  company: string
  contactName: string
  contactEmail: string
  status: TicketStatus
  priority: TicketPriority
  source: TicketSource
  serviceType: string
  projectId?: string
  createdDate: string
  updatedDate: string
  assignedTo?: string
  tags: string[]
  messages: TicketMessage[]
  linkedTaskId?: string
}

const statusConfig: Record<TicketStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  'Open': { color: '#3b82f6', bg: '#eff6ff', icon: <Circle size={11} /> },
  'In Progress': { color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={11} /> },
  'Waiting on Client': { color: '#8b5cf6', bg: '#f5f3ff', icon: <User size={11} /> },
  'Resolved': { color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle size={11} /> },
  'Closed': { color: '#9ca3af', bg: '#f9fafb', icon: <X size={11} /> },
}

const priorityConfig: Record<TicketPriority, { color: string; bg: string; border: string }> = {
  Urgent: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  High: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  Medium: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  Low: { color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
}

const allStatuses: TicketStatus[] = ['Open', 'In Progress', 'Waiting on Client', 'Resolved', 'Closed']
const filterTabs: Array<TicketStatus | 'All'> = ['All', 'Open', 'In Progress', 'Resolved', 'Closed']
const priorityLevels: Array<TicketPriority | 'All'> = ['All', 'Urgent', 'High', 'Medium', 'Low']

function TicketPanel({
  ticket, onClose, onSendReply, onUpdateStatus, onDelete,
}: {
  ticket: Ticket
  onClose: () => void
  onSendReply: (id: string, body: string, isInternal: boolean) => void
  onUpdateStatus: (id: string, status: TicketStatus) => void
  onDelete: (id: string) => void
}) {
  const [reply, setReply] = useState('')
  const [showInternal, setShowInternal] = useState(true)

  const cfg = statusConfig[ticket.status]
  const priCfg = priorityConfig[ticket.priority]

  function handleSend(isInternal: boolean) {
    if (!reply.trim()) return
    onSendReply(ticket.id, reply.trim(), isInternal)
    setReply('')
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white"
        style={{ width: 'min(520px, 100vw)', height: '100vh' }}
      >
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-white/50 text-[11px] mb-1">{ticket.id.toUpperCase()} · {ticket.source}</p>
              <h2 className="text-white text-base font-bold leading-snug" style={{ fontFamily: 'var(--font-heading)' }}>
                {ticket.subject}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
              <X size={16} className="text-white/60" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.icon} {ticket.status}
            </span>
            <span
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: priCfg.bg, color: priCfg.color, border: `1px solid ${priCfg.border}` }}
            >
              ● {ticket.priority}
            </span>
            <Link
              href="/crm/pipeline"
              className="text-white/50 text-xs ml-auto hover:text-white/80 transition-colors"
            >
              {ticket.company} →
            </Link>
          </div>
        </div>

        <div className="flex-shrink-0 grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: 'Contact', value: ticket.contactName },
            { label: 'Assigned', value: ticket.assignedTo ?? 'Unassigned' },
            { label: 'Service', value: ticket.serviceType },
          ].map((item, i) => (
            <div key={i} className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {ticket.projectId && (
          <div className="flex-shrink-0 mx-4 mt-3">
            <Link
              href={`/projects/${ticket.projectId}`}
              className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <FolderKanban size={14} style={{ color: '#015035' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">Linked Project</p>
                <p className="text-[11px] text-gray-500">View in Projects</p>
              </div>
              <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
            </Link>
          </div>
        )}

        {/* AUDIT #263 — linkedTaskId was fetched but never displayed
            anywhere on the page. */}
        {ticket.linkedTaskId && (
          <div className="flex-shrink-0 mx-4 mt-3">
            <Link
              href={`/tasks?open=${ticket.linkedTaskId}`}
              className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <CheckCircle size={14} style={{ color: '#015035' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">Linked Task</p>
                <p className="text-[11px] text-gray-500">View in Tasks</p>
              </div>
              <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
            </Link>
          </div>
        )}

        {ticket.status === 'Open' && !ticket.assignedTo && (
          <div className="flex-shrink-0 mx-4 mt-3">
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <Zap size={13} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800 flex-1">Unassigned — mark as In Progress to start working this ticket</p>
              <button
                onClick={() => onUpdateStatus(ticket.id, 'In Progress')}
                className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0"
              >
                Start →
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Conversation ({ticket.messages.length})
            </p>
            <button
              onClick={() => setShowInternal(v => !v)}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showInternal ? 'Hide internal notes' : 'Show internal notes'}
            </button>
          </div>

          {ticket.messages
            .filter(m => showInternal || !m.isInternal)
            .map(msg => (
              <div
                key={msg.id}
                className={`rounded-xl p-3 ${
                  msg.isInternal
                    ? 'bg-amber-50 border border-amber-200'
                    : msg.author === ticket.contactName
                    ? 'bg-gray-50 border border-gray-100'
                    : 'border border-green-100'
                }`}
                style={!msg.isInternal && msg.author !== ticket.contactName ? { background: '#f0fdf4' } : {}}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    style={{ background: msg.isInternal ? '#f59e0b' : msg.author === ticket.contactName ? '#6b7280' : '#015035' }}
                  >
                    {msg.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{msg.author}</span>
                  {msg.isInternal && (
                    <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">Internal</span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">{msg.timestamp}</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{msg.body}</p>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-black/5">
                    {msg.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline truncate"
                      >
                        📎 {att.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-100">
          <div className="flex items-start gap-2">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write a reply to the client..."
              className="flex-1 text-xs border border-gray-200 rounded-xl p-2.5 resize-none focus:outline-none focus:border-green-700 transition-colors"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => handleSend(false)}
              disabled={!reply.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              <Send size={12} /> Send Reply
            </button>
            <button
              onClick={() => handleSend(true)}
              disabled={!reply.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 text-amber-700 bg-amber-50 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-40"
            >
              Add Internal Note
            </button>
            {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
              <button
                onClick={() => onUpdateStatus(ticket.id, 'Resolved')}
                className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                <CheckCircle size={12} /> Resolve
              </button>
            )}
            <button
              onClick={() => { if (confirm('Delete this ticket permanently?')) onDelete(ticket.id) }}
              className={`${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'ml-auto' : ''} flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors`}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TicketsPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [localTickets, setLocalTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'All'>('All')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  useEffect(() => {
    // /api/tickets is cursor-paginated (100/page) — fetchAllPages() follows
    // X-Next-Cursor to completion instead of a raw fetch() that would
    // silently show only the newest page as "the full ticket list."
    fetchAllPages<Ticket>('/api/tickets')
      .then(setLocalTickets)
      .catch(() => toast('Failed to load tickets', 'error'))
      .finally(() => setLoading(false))
  }, [])

  // Deep-link support for global search (Cmd+K) results, which link here
  // with ?open=<id>.
  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && localTickets.length > 0 && !selected) {
      const match = localTickets.find(t => t.id === openId)
      // Deep-link sync, can't be computed during render since it depends on
      // the async ticket list that isn't available yet on first render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setSelected(match)
    }
  }, [searchParams, localTickets, selected])

  function sendReply(id: string, body: string, isInternal: boolean) {
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const newMsg: TicketMessage = {
      id: `m-${Date.now()}`,
      author: 'You',
      isInternal,
      body,
      timestamp,
    }
    const updatedDate = now.toISOString().split('T')[0]

    // Derives newMessages from `prev`, the functional update's true latest
    // state, not the `localTickets` closure — two replies sent in quick
    // succession (before a re-render) previously both read the same stale
    // base array, so whichever PATCH resolved last silently dropped the
    // other server-side.
    let newMessages: TicketMessage[] | null = null
    setLocalTickets(prev => prev.map(t => {
      if (t.id !== id) return t
      newMessages = [...t.messages, newMsg]
      return { ...t, messages: newMessages, updatedDate }
    }))

    if (newMessages) {
      fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      }).catch(() => toast('Failed to send reply', 'error'))
    }
    setSelected(prev => prev?.id === id ? { ...prev, messages: [...prev.messages, newMsg] } : prev)
  }

  async function deleteTicket(id: string) {
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('Failed to delete ticket', 'error')
        return
      }
      setLocalTickets(prev => prev.filter(t => t.id !== id))
      setSelected(null)
      toast('Ticket deleted', 'success')
    } catch {
      toast('Failed to delete ticket', 'error')
    }
  }

  function updateTicketStatus(id: string, status: TicketStatus) {
    setLocalTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
    fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => toast('Failed to update ticket status', 'error'))
  }

  async function handleNewTicket(data: NewTicketFormData) {
    const today = new Date().toISOString().split('T')[0]
    const timestamp = new Date().toLocaleString('en-CA', { hour12: false }).replace(',', '').slice(0, 16)
    const payload = {
      subject: data.subject,
      company: data.company,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      status: 'Open',
      priority: data.priority,
      source: 'Internal',
      serviceType: data.serviceType,
      assignedTo: data.assignedTo || null,
      tags: [],
      // AUDIT.md #205 — `data.attachments` (uploaded via the panel's
      // FileUpload) was previously never forwarded here, so files staff
      // uploaded when opening a ticket looked attached in the panel but
      // were silently dropped on save — matches the portal client's own
      // ticket-creation flow, which already includes attachments.
      messages: (data.body || data.attachments.length > 0) ? [{
        id: `m-${Date.now()}`,
        author: data.contactName,
        isInternal: false,
        body: data.body,
        timestamp,
        ...(data.attachments.length > 0 ? { attachments: data.attachments } : {}),
      }] : [],
    }
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saved = await res.json()
      setLocalTickets(prev => [saved, ...prev])
    } catch {
      setLocalTickets(prev => [{ id: `tkt-${Date.now()}`, createdDate: today, updatedDate: today, ...payload } as Ticket, ...prev])
    }
    setCreatingTicket(false)
  }

  const counts = useMemo(() => allStatuses.reduce((acc, s) => {
    acc[s] = localTickets.filter(t => t.status === s).length
    return acc
  }, {} as Record<TicketStatus, number>), [localTickets])

  const resolvedThisMonth = useMemo(() => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return localTickets.filter(t => t.status === 'Resolved' && t.updatedDate.startsWith(ym)).length
  }, [localTickets])

  const avgResponseTime = useMemo(() => {
    const times: number[] = []
    for (const t of localTickets) {
      if (!t.messages.length) continue
      const firstReply = t.messages.find(m => m.author !== t.contactName && !m.isInternal)
      if (!firstReply) continue
      const created = new Date(t.createdDate).getTime()
      const replied = new Date(firstReply.timestamp).getTime()
      if (replied > created) times.push(replied - created)
    }
    if (times.length === 0) return null
    const avg = times.reduce((s, v) => s + v, 0) / times.length
    const hours = Math.round(avg / (1000 * 60 * 60))
    if (hours < 1) return `${Math.round(avg / (1000 * 60))}m`
    if (hours < 24) return `${hours}h`
    return `${Math.round(hours / 24)}d`
  }, [localTickets])

  const filtered = useMemo(() => {
    let list = localTickets
    if (statusFilter !== 'All') list = list.filter(t => t.status === statusFilter)
    if (priorityFilter !== 'All') list = list.filter(t => t.priority === priorityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.company.toLowerCase().includes(q) ||
        t.contactName.toLowerCase().includes(q)
      )
    }
    return list
  }, [localTickets, statusFilter, priorityFilter, searchQuery])

  const allFilteredIds = filtered.map(t => t.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allFilteredIds))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    setLocalTickets(prev => prev.filter(t => !selectedIds.has(t.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tickets', ids }),
      })
      toast(`${ids.length} tickets deleted`, 'success')
    } catch {
      toast('Failed to delete tickets', 'error')
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header
        title="Tickets"
        subtitle="Client requests and support conversations"
        action={{ label: 'New Ticket', onClick: () => setCreatingTicket(true) }}
      />
      <div className="p-3 sm:p-6 flex-1">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="metric-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#01503512' }}>
                <MessageSquare size={16} style={{ color: '#015035' }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{localTickets.length}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Total Tickets</p>
          </div>
          <div className="metric-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#3b82f612' }}>
                <Circle size={16} className="text-blue-500" />
              </div>
              {counts['Open'] > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Active</span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{counts['Open']}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Open</p>
          </div>
          <div className="metric-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f59e0b12' }}>
                <Clock size={16} className="text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{avgResponseTime ?? '—'}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Avg Response Time</p>
          </div>
          <div className="metric-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#22c55e12' }}>
                <CheckCircle size={16} className="text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{resolvedThisMonth}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Resolved This Month</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-0.5">
          {filterTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`tab-btn flex-shrink-0 ${statusFilter === tab ? 'active' : ''}`}
            >
              {tab}{tab === 'All' ? ` (${localTickets.length})` : ` (${counts[tab] ?? 0})`}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by subject, company, or contact..."
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400 bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Priority</span>
            {priorityLevels.map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`filter-pill ${priorityFilter === p ? 'active' : ''}`}
              >
                {p !== 'All' && <span style={{ color: priorityFilter === p ? 'white' : priorityConfig[p].color }}>●</span>}
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/80">
                  <th className="w-10 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                    />
                  </th>
                  <th className="w-1" />
                  <th className="text-left py-3 px-4 font-semibold">Subject</th>
                  <th className="text-left py-3 px-4 font-semibold hidden sm:table-cell">Company</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Assignee</th>
                  <th className="text-left py-3 px-4 font-semibold hidden lg:table-cell">Created</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const sCfg = statusConfig[t.status]
                  const pCfg = priorityConfig[t.priority]
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-50/70 cursor-pointer border-b border-gray-100 last:border-0 transition-colors group ${selectedIds.has(t.id) ? 'bg-emerald-50/50' : ''}`}
                      onClick={() => setSelected(t)}
                    >
                      <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                        />
                      </td>
                      <td className="w-1 p-0">
                        <div className="w-1 h-full min-h-[56px] rounded-r-sm" style={{ background: pCfg.color }} />
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-emerald-800 transition-colors">{t.subject}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <span>{t.id.toUpperCase()}</span>
                          <span className="text-gray-300">·</span>
                          <span>{t.source}</span>
                          <span className="text-gray-300">·</span>
                          <span>{t.messages.length} msg{t.messages.length !== 1 ? 's' : ''}</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">
                        <Link
                          href="/crm/pipeline"
                          onClick={e => e.stopPropagation()}
                          className="text-sm font-medium text-gray-800 hover:text-emerald-700 transition-colors"
                        >
                          {t.company}
                        </Link>
                        <p className="text-[11px] text-gray-400 mt-0.5">{t.contactName}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                          style={{ background: sCfg.bg, color: sCfg.color }}
                        >
                          {sCfg.icon} {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        {t.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                              style={{ background: '#015035' }}
                            >
                              {t.assignedTo.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-xs text-gray-700 font-medium">{t.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-400">{formatDate(t.createdDate)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#01503510' }}>
                <Inbox size={22} style={{ color: '#015035' }} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No tickets found</p>
              <p className="text-xs text-gray-400 max-w-xs">
                {searchQuery || priorityFilter !== 'All' || statusFilter !== 'All'
                  ? 'Try adjusting your filters or search query.'
                  : 'Create your first ticket to start tracking client requests.'}
              </p>
              {!searchQuery && priorityFilter === 'All' && statusFilter === 'All' && (
                <button
                  onClick={() => setCreatingTicket(true)}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> New Ticket
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <TicketPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          onSendReply={sendReply}
          onUpdateStatus={updateTicketStatus}
          onDelete={deleteTicket}
        />
      )}
      {creatingTicket && (
        <NewTicketPanel onSave={handleNewTicket} onClose={() => setCreatingTicket(false)} />
      )}
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {
              const rows = selectedIds.size === 0 ? localTickets : localTickets.filter(t => selectedIds.has(t.id))
              downloadCsv(rows as unknown as Record<string, unknown>[], [
                { key: 'subject', label: 'Subject' },
                { key: 'company', label: 'Company' },
                { key: 'status', label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'assignedTo', label: 'Assigned To' },
                { key: 'createdDate', label: 'Created Date' },
              ], 'tickets-export.csv')
            } },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} tickets?`}
          description="This action cannot be undone. Selected tickets will be permanently removed."
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
    </>
  )
}
