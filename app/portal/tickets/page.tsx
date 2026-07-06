'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, MessageSquare, Plus, ChevronRight, Send, Upload,
  AlertCircle, X,
} from 'lucide-react'

interface TicketMessage {
  sender: string
  text: string
  date: string
}

interface Ticket {
  id: string
  subject: string
  company: string
  contactName: string
  contactEmail: string
  status: string
  priority: string
  messages: TicketMessage[]
  createdDate: string
  updatedDate: string
}

const statusColors: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-gray-100 text-gray-600',
}

const priorityColors: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-600',
}

export default function PortalTicketsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const contactName = user?.name ?? ''
  const contactEmail = user?.email ?? ''

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  const [newSubject, setNewSubject] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState('Medium')
  const [submitting, setSubmitting] = useState(false)

  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (!company) { setLoading(false); return }
    fetch(`/api/tickets?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: Ticket[]) => setTickets(Array.isArray(d) ? d : []))
      .catch(() => toast('Failed to load tickets', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  async function handleNewTicket() {
    if (!newSubject.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim(),
          company,
          contactName,
          contactEmail,
          status: 'Open',
          priority: newPriority,
          source: 'Portal',
          messages: newDescription.trim() ? [{ sender: contactName, text: newDescription.trim(), date: new Date().toISOString() }] : [],
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setTickets(prev => [created, ...prev])
      setNewSubject('')
      setNewDescription('')
      setNewPriority('Medium')
      setShowNewForm(false)
      toast('Ticket submitted', 'success')
    } catch {
      toast('Failed to submit ticket', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply() {
    if (!selected || !replyText.trim()) return
    setReplying(true)
    try {
      const updatedMessages = [
        ...(selected.messages || []),
        { sender: contactName, text: replyText.trim(), date: new Date().toISOString() },
      ]
      const res = await fetch(`/api/tickets/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      if (!res.ok) throw new Error()
      const updated = { ...selected, messages: updatedMessages }
      setSelected(updated)
      setTickets(prev => prev.map(t => t.id === selected.id ? updated : t))
      setReplyText('')
      toast('Reply sent', 'success')
    } catch {
      toast('Failed to send reply', 'error')
    } finally {
      setReplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (selected) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
          <button
            onClick={() => { setSelected(null); setReplyText('') }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Tickets
          </button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selected.subject}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Opened {formatDate(selected.createdDate)} · Updated {formatDate(selected.updatedDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge label={selected.priority} colorClass={priorityColors[selected.priority] ?? 'bg-gray-100 text-gray-600'} />
              <StatusBadge label={selected.status} colorClass={statusColors[selected.status] ?? 'bg-gray-100 text-gray-600'} />
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-8 max-w-3xl mx-auto flex flex-col gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Thread</h3>
            {selected.messages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {selected.messages.map((msg, i) => {
                  const isClient = msg.sender === contactName
                  return (
                    <div key={i} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${isClient ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-[11px] font-semibold ${isClient ? 'text-white/70' : 'text-gray-500'}`}>{msg.sender}</p>
                          <p className={`text-[10px] ${isClient ? 'text-white/50' : 'text-gray-400'}`}>
                            {new Date(msg.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No messages yet. Send the first reply below.</p>
            )}
          </div>

          {selected.status !== 'Closed' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <button disabled className="flex items-center gap-1.5 text-xs text-gray-400 cursor-not-allowed" title="File attachments coming soon">
                  <Upload size={12} /> Attach file (coming soon)
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || replying}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                  style={{ background: '#015035' }}
                >
                  <Send size={12} /> {replying ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Support Tickets</h1>
            <p className="text-xs text-gray-500 mt-0.5">Submit requests and track status</p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#015035' }}
          >
            <Plus size={14} /> New Ticket
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
              <h2 className="text-sm font-bold text-white">New Support Ticket</h2>
              <button onClick={() => setShowNewForm(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X size={14} className="text-white/60" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Subject <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="Brief description of the issue"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Detailed description..."
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Priority</label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <button disabled className="flex items-center gap-1.5 text-xs text-gray-400 cursor-not-allowed" title="File attachments coming soon">
                <Upload size={12} /> Attach file (coming soon)
              </button>
              <div className="flex items-center gap-2 justify-end pt-2 border-t border-gray-100">
                <button onClick={() => setShowNewForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  onClick={handleNewTicket}
                  disabled={!newSubject.trim() || submitting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: '#015035' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        {tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No support tickets</p>
            <p className="text-xs text-gray-400 mt-1">Create a new ticket using the button above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col divide-y divide-gray-100">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-[#015035] transition-colors">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(t.createdDate)}
                      {t.messages.length > 0 ? ` · ${t.messages.length} message${t.messages.length > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge label={t.priority} colorClass={priorityColors[t.priority] ?? 'bg-gray-100 text-gray-600'} />
                    <StatusBadge label={t.status} colorClass={statusColors[t.status] ?? 'bg-gray-100 text-gray-600'} />
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#015035] transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
