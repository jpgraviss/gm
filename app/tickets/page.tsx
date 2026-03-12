'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'

import NewTicketPanel, { type NewTicketFormData } from '@/components/crm/NewTicketPanel'
import { formatDate } from '@/lib/utils'
import {
  MessageSquare, CheckCircle, Clock, AlertTriangle, X, ExternalLink,
  Plus, ChevronRight, ArrowUpRight, Send, User, Tag, FolderKanban,
  Zap, Circle,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus = 'Open' | 'In Progress' | 'Waiting on Client' | 'Resolved' | 'Closed'
type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent'
type TicketSource = 'Client Portal' | 'Email' | 'Phone' | 'Internal'

interface TicketMessage {
  id: string
  author: string
  isInternal: boolean
  body: string
  timestamp: string
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

// ─── Status / Priority Config ─────────────────────────────────────────────────

const statusConfig: Record<TicketStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  'Open': { color: '#3b82f6', bg: '#eff6ff', icon: <Circle size={11} /> },
  'In Progress': { color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={11} /> },
  'Waiting on Client': { color: '#8b5cf6', bg: '#f5f3ff', icon: <User size={11} /> },
  'Resolved': { color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle size={11} /> },
  'Closed': { color: '#9ca3af', bg: '#f9fafb', icon: <X size={11} /> },
}

const priorityConfig: Record<TicketPriority, { color: string; label: string }> = {
  Low: { color: '#9ca3af', label: 'Low' },
  Medium: { color: '#f59e0b', label: 'Medium' },
  High: { color: '#ef4444', label: 'High' },
  Urgent: { color: '#dc2626', label: 'Urgent' },
}

const allStatuses: TicketStatus[] = ['Open', 'In Progress', 'Waiting on Client', 'Resolved', 'Closed']

// ─── Ticket Panel ─────────────────────────────────────────────────────────────

function TicketPanel({
  ticket, onClose, onSendReply, onUpdateStatus,
}: {
  ticket: Ticket
  onClose: () => void
  onSendReply: (id: string, body: string, isInternal: boolean) => void
  onUpdateStatus: (id: string, status: TicketStatus) => void
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
        style={{ width: 'min(480px, 100vw)', height: '100vh' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-white/50 text-[11px] mb-0.5">{ticket.id.toUpperCase()} · {ticket.source}</p>
              <h2 className="text-white text-sm font-bold leading-snug" style={{ fontFamily: 'var(--font-heading)' }}>
                {ticket.subject}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
              <X size={16} className="text-white/60" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.icon} {ticket.status}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: priCfg.color }}>
              ● {ticket.priority}
            </span>
            <span className="text-white/40 text-xs ml-auto">{ticket.company}</span>
          </div>
        </div>

        {/* Quick info */}
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

        {/* Linked project banner */}
        {ticket.projectId && (
          <div className="flex-shrink-0 mx-4 mt-3">
            <Link
              href="/projects"
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

        {/* Auto-create task banner for unassigned open tickets */}
        {ticket.status === 'Open' && !ticket.assignedTo && (
          <div className="flex-shrink-0 mx-4 mt-3">
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <Zap size={13} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-800 flex-1">Unassigned — assign this ticket to auto-create a project task</p>
              <button className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0">
                Assign →
              </button>
            </div>
          </div>
        )}

        {/* Message thread */}
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
              </div>
            ))}
        </div>

        {/* Reply box */}
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [localTickets, setLocalTickets] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'All'>('All')
  const [creatingTicket, setCreatingTicket] = useState(false)

  useEffect(() => {
    fetch('/api/tickets')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLocalTickets(data) })
      .catch(() => {})
  }, [])

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
    setLocalTickets(prev => prev.map(t =>
      t.id === id ? { ...t, messages: [...t.messages, newMsg], updatedDate } : t
    ))
    const updatedTicket = localTickets.find(t => t.id === id)
    if (updatedTicket) {
      const newMessages = [...updatedTicket.messages, newMsg]
      fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      }).catch(() => {})
    }
    setSelected(prev => prev?.id === id ? { ...prev, messages: [...prev.messages, newMsg] } : prev)
  }

  function updateTicketStatus(id: string, status: TicketStatus) {
    setLocalTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev)
    fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
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
      messages: data.body ? [{
        id: `m-${Date.now()}`,
        author: data.contactName,
        isInternal: false,
        body: data.body,
        timestamp,
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

  const filtered = statusFilter === 'All' ? localTickets : localTickets.filter(t => t.status === statusFilter)

  const counts = allStatuses.reduce((acc, s) => {
    acc[s] = localTickets.filter(t => t.status === s).length
    return acc
  }, {} as Record<TicketStatus, number>)

  const openUrgent = localTickets.filter(t => t.status === 'Open' && t.priority === 'Urgent').length
  const unassigned = localTickets.filter(t => !t.assignedTo && t.status !== 'Resolved' && t.status !== 'Closed').length

  return (
    <>
      <Header
        title="Tickets"
        subtitle="Client requests and support conversations"
        action={{ label: 'New Ticket', onClick: () => setCreatingTicket(true) }}
      />
      <div className="p-3 sm:p-6 flex-1">

        {/* Info banner — Tickets concept */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5">
          <MessageSquare size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Client Ticket System</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Clients submit requests via the <Link href="/portal" className="underline">Client Portal</Link> or email. Each ticket is linked to the client&apos;s project and can be converted to a project task automatically.
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'All', value: localTickets.length, color: '#6b7280', icon: <MessageSquare size={14} /> },
            { label: 'Open', value: counts['Open'], color: '#3b82f6', icon: <Circle size={14} /> },
            { label: 'In Progress', value: counts['In Progress'], color: '#f59e0b', icon: <Clock size={14} /> },
            { label: 'Waiting on Client', value: counts['Waiting on Client'], color: '#8b5cf6', icon: <User size={14} /> },
            { label: 'Resolved', value: counts['Resolved'], color: '#22c55e', icon: <CheckCircle size={14} /> },
          ].map(m => (
            <button
              key={m.label}
              onClick={() => setStatusFilter(m.label === 'All' ? 'All' : m.label as TicketStatus)}
              className={`metric-card text-left p-3 transition-all ${statusFilter === m.label ? 'ring-2 ring-green-800 ring-offset-1' : ''}`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{m.label}</p>
            </button>
          ))}
        </div>

        {/* Alert banners */}
        {(openUrgent > 0 || unassigned > 0) && (
          <div className="flex gap-3 mb-5 flex-wrap">
            {openUrgent > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={13} className="text-red-500" />
                <span className="text-xs font-semibold text-red-700">{openUrgent} urgent ticket{openUrgent > 1 ? 's' : ''} need immediate attention</span>
              </div>
            )}
            {unassigned > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <Zap size={13} className="text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">{unassigned} ticket{unassigned > 1 ? 's' : ''} unassigned</span>
              </div>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-0.5">
          <button onClick={() => setStatusFilter('All')} className={`tab-btn flex-shrink-0 ${statusFilter === 'All' ? 'active' : ''}`}>All ({localTickets.length})</button>
          {allStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}>
              {s} ({counts[s]})
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Subject</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Priority</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Assigned</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Created</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const cfg = statusConfig[t.status]
                const priCfg = priorityConfig[t.priority]
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors group"
                    onClick={() => setSelected(t)}
                  >
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.id.toUpperCase()} · {t.source} · {t.messages.length} msg{t.messages.length !== 1 ? 's' : ''}</p>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <p className="text-sm text-gray-700 font-medium">{t.company}</p>
                      <p className="text-xs text-gray-400">{t.contactName}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon} {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: priCfg.color }}>
                        ● {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {t.assignedTo ? (
                        <span className="text-xs text-gray-600">{t.assignedTo}</span>
                      ) : (
                        <span className="text-xs text-amber-500 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{t.serviceType}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(t.createdDate)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No tickets in this status</div>
          )}
        </div>

        {/* Auto-task explanation */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-start gap-3">
            <ArrowUpRight size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Auto-Task Integration</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                When a ticket is assigned to a team member and linked to a project, GravHub can automatically create a corresponding task inside that project — keeping client requests and delivery in sync. Ticket threads remain in the client portal; tasks appear on the internal project board.
              </p>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <TicketPanel
          ticket={selected}
          onClose={() => setSelected(null)}
          onSendReply={sendReply}
          onUpdateStatus={updateTicketStatus}
        />
      )}
      {creatingTicket && (
        <NewTicketPanel onSave={handleNewTicket} onClose={() => setCreatingTicket(false)} />
      )}
    </>
  )
}
