'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  Inbox as InboxIcon, Search, RefreshCw, MessageSquare, Mail, Zap,
  Megaphone, Users, ChevronRight, Circle,
} from 'lucide-react'

interface UnifiedThread {
  contactEmail: string
  contactName: string
  company?: string
  lastMessage: {
    source: 'ticket' | 'sequence' | 'broadcast' | 'activity' | 'gmail'
    title: string
    preview: string
    timestamp: string
    unread?: boolean
  }
  unreadCount: number
  totalMessages: number
  sources: string[]
}

const SOURCE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ticket:    { label: 'Ticket',    icon: <MessageSquare size={11} />, color: '#3b82f6' },
  sequence:  { label: 'Sequence',  icon: <Zap size={11} />,           color: '#8b5cf6' },
  broadcast: { label: 'Broadcast', icon: <Megaphone size={11} />,     color: '#f59e0b' },
  activity:  { label: 'Activity',  icon: <Mail size={11} />,          color: '#015035' },
  gmail:     { label: 'Gmail',     icon: <Mail size={11} />,          color: '#dc2626' },
}

export default function UnifiedInboxPage() {
  const { toast } = useToast()
  const { gmailToken, gmailEmail } = useAuth()
  const [threads, setThreads] = useState<UnifiedThread[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [selected, setSelected] = useState<UnifiedThread | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (gmailToken && gmailEmail) {
      params.set('gmailToken', gmailToken)
      params.set('gmailEmail', gmailEmail)
    }
    fetch(`/api/inbox/unified?${params}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setThreads(data) })
      .catch(() => toast('Failed to load inbox', 'error'))
      .finally(() => setLoading(false))
  }, [toast, gmailToken, gmailEmail])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    let list = threads
    if (sourceFilter !== 'all') {
      list = list.filter(t => t.sources.includes(sourceFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.contactEmail.toLowerCase().includes(q) ||
        t.contactName.toLowerCase().includes(q) ||
        t.company?.toLowerCase().includes(q) ||
        t.lastMessage.title.toLowerCase().includes(q) ||
        t.lastMessage.preview.toLowerCase().includes(q)
      )
    }
    return list
  }, [threads, search, sourceFilter])

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0)

  return (
    <>
      <Header
        title="Unified Inbox"
        subtitle={`${threads.length} conversations · ${totalUnread} unread`}
      />
      <div className="p-3 sm:p-6 flex-1 flex flex-col gap-4 min-h-0">

        {/* Tab nav */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <Link
            href="/inbox/unified"
            className="px-4 py-2.5 text-sm font-semibold border-b-2 border-emerald-600 text-gray-900"
          >
            <InboxIcon size={14} className="inline mr-1.5 -mt-0.5" />
            Unified
          </Link>
          <Link
            href="/inbox"
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            <Mail size={14} className="inline mr-1.5 -mt-0.5" />
            Gmail
          </Link>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {(['all', 'gmail', 'ticket', 'sequence', 'broadcast', 'activity'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 capitalize ${
                  sourceFilter === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading && threads.length === 0 ? (
          <LoadingScreen />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <InboxIcon size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? 'Try a different search' : 'Messages from tickets, sequences, and broadcasts will appear here.'}
            </p>
          </div>
        ) : (
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Thread list */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 w-full md:w-[400px] flex flex-col">
              <div className="overflow-y-auto flex-1">
                {filtered.map(thread => {
                  const isActive = selected?.contactEmail === thread.contactEmail
                  const initials = (thread.contactName || thread.contactEmail)
                    .split(/\s+|@/)
                    .slice(0, 2)
                    .map(s => s[0]?.toUpperCase())
                    .join('')
                  return (
                    <button
                      key={thread.contactEmail}
                      onClick={() => setSelected(thread)}
                      className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        isActive ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: '#015035' }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 truncate flex-1">
                              {thread.contactName || thread.contactEmail}
                            </p>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {formatDate(thread.lastMessage.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">
                            {thread.lastMessage.title}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">
                            {thread.lastMessage.preview || thread.contactEmail}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            {thread.sources.map(source => {
                              const m = SOURCE_META[source]
                              if (!m) return null
                              return (
                                <span
                                  key={source}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: `${m.color}15`, color: m.color }}
                                >
                                  {m.icon} {m.label}
                                </span>
                              )
                            })}
                            {thread.unreadCount > 0 && (
                              <Circle size={8} className="ml-auto text-emerald-500 fill-emerald-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Detail view */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden hidden md:flex flex-col">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Users size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Select a conversation</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-5 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">{selected.contactName || selected.contactEmail}</h2>
                    <p className="text-xs text-gray-500">{selected.contactEmail}{selected.company ? ` · ${selected.company}` : ''}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {selected.sources.map(source => {
                        const m = SOURCE_META[source]
                        if (!m) return null
                        return (
                          <span
                            key={source}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${m.color}15`, color: m.color }}
                          >
                            {m.icon} {m.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Latest {SOURCE_META[selected.lastMessage.source]?.label ?? 'message'}</p>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{selected.lastMessage.title}</p>
                      {selected.lastMessage.preview && (
                        <p className="text-xs text-gray-600 leading-relaxed">{selected.lastMessage.preview}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2">{formatDate(selected.lastMessage.timestamp)}</p>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <Link
                        href={`/crm/contacts?email=${encodeURIComponent(selected.contactEmail)}`}
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <span className="flex items-center gap-2"><Users size={14} /> View CRM contact</span>
                        <ChevronRight size={14} className="text-gray-400" />
                      </Link>
                      {selected.sources.includes('ticket') && (
                        <Link
                          href="/tickets"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex items-center gap-2"><MessageSquare size={14} /> Open tickets</span>
                          <ChevronRight size={14} className="text-gray-400" />
                        </Link>
                      )}
                      {selected.sources.includes('sequence') && (
                        <Link
                          href="/crm/sequences"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex items-center gap-2"><Zap size={14} /> Open sequences</span>
                          <ChevronRight size={14} className="text-gray-400" />
                        </Link>
                      )}
                      {selected.sources.includes('broadcast') && (
                        <Link
                          href="/marketing"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex items-center gap-2"><Megaphone size={14} /> Open broadcasts</span>
                          <ChevronRight size={14} className="text-gray-400" />
                        </Link>
                      )}
                      {selected.sources.includes('gmail') && (
                        <Link
                          href="/inbox"
                          className="flex items-center justify-between p-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className="flex items-center gap-2"><Mail size={14} /> Open Gmail</span>
                          <ChevronRight size={14} className="text-gray-400" />
                        </Link>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
