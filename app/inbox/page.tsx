'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { crmContacts } from '@/lib/data'
import {
  Mail, RefreshCw, X, ChevronDown, Search, Link2,
  Inbox as InboxIcon, AlertCircle, CheckCircle, ExternalLink,
} from 'lucide-react'

interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  labelIds: string[]
  from: string
  to: string
  subject: string
  date: string
  internalDate: string
}

interface GmailMessageFull extends GmailMessage {
  body: string
}

interface LoggedActivity {
  id: string
  type: 'email'
  contactId: string
  contactName: string
  companyName: string
  subject: string
  from: string
  date: string
  body: string
  loggedAt: string
  loggedBy: string
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { name: from, email: from }
}

function formatDate(internalDate: string): string {
  if (!internalDate) return ''
  const d = new Date(parseInt(internalDate))
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 604800000) {
    return d.toLocaleDateString([], { weekday: 'short' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function isUnread(msg: GmailMessage) {
  return msg.labelIds?.includes('UNREAD')
}

export default function InboxPage() {
  const { gmailToken, gmailEmail, connectGmail, disconnectGmail, user } = useAuth()
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<GmailMessageFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [logModal, setLogModal] = useState(false)
  const [logContact, setLogContact] = useState('')
  const [logSuccess, setLogSuccess] = useState(false)
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())

  // Load already-logged activity IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gravhub_activities')
      if (stored) {
        const activities: LoggedActivity[] = JSON.parse(stored)
        setLoggedIds(new Set(activities.map(a => a.id.replace('gmail_', ''))))
      }
    } catch {/* ignore */}
  }, [])

  const fetchMessages = useCallback(async (query = '') => {
    if (!gmailToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/gmail/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: gmailToken, maxResults: 30, query }),
      })
      if (!res.ok) {
        const e = await res.json()
        if (res.status === 401) {
          setError('Gmail session expired. Please reconnect.')
          disconnectGmail()
        } else {
          setError(e.error ?? 'Failed to load inbox')
        }
        return
      }
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch {
      setError('Failed to load inbox. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [gmailToken, disconnectGmail])

  useEffect(() => {
    if (gmailToken) fetchMessages()
  }, [gmailToken, fetchMessages])

  async function openMessage(msg: GmailMessage) {
    setLoadingDetail(true)
    setSelected({ ...msg, body: '' })
    try {
      const res = await fetch('/api/gmail/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: gmailToken, id: msg.id }),
      })
      if (res.ok) {
        const full = await res.json()
        setSelected(full)
      }
    } catch {/* keep snippet */}
    finally {
      setLoadingDetail(false)
    }
  }

  // Find a CRM contact whose email matches the sender
  function findMatchingContact(fromEmail: string) {
    const email = fromEmail.toLowerCase()
    return crmContacts.find(c => c.emails.some(e => e.toLowerCase() === email)) ?? null
  }

  function openLogModal() {
    if (!selected) return
    const { email } = parseSender(selected.from)
    const match = findMatchingContact(email)
    setLogContact(match?.id ?? '')
    setLogModal(true)
    setLogSuccess(false)
  }

  function saveActivity() {
    if (!selected || !logContact) return
    const contact = crmContacts.find(c => c.id === logContact)
    if (!contact) return

    const activity: LoggedActivity = {
      id: `gmail_${selected.id}`,
      type: 'email',
      contactId: contact.id,
      contactName: contact.fullName,
      companyName: contact.companyName,
      subject: selected.subject,
      from: selected.from,
      date: selected.date,
      body: (selected.body || selected.snippet).slice(0, 500),
      loggedAt: new Date().toISOString(),
      loggedBy: user?.name ?? 'Unknown',
    }

    try {
      const existing: LoggedActivity[] = JSON.parse(localStorage.getItem('gravhub_activities') ?? '[]')
      const filtered = existing.filter(a => a.id !== activity.id)
      localStorage.setItem('gravhub_activities', JSON.stringify([activity, ...filtered]))
      setLoggedIds(prev => new Set([...prev, selected.id]))
      setLogSuccess(true)
      setTimeout(() => setLogModal(false), 1200)
    } catch {/* ignore */}
  }

  const filteredMessages = messages.filter(m =>
    !search ||
    m.subject.toLowerCase().includes(search.toLowerCase()) ||
    m.from.toLowerCase().includes(search.toLowerCase()) ||
    m.snippet.toLowerCase().includes(search.toLowerCase())
  )

  // — Not connected —
  if (!gmailToken) {
    return (
      <>
        <Header title="Inbox" subtitle="Gmail connected inbox" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <InboxIcon size={28} className="text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">Connect your Gmail</h2>
            <p className="text-sm text-gray-500 mb-6">
              Sign in with Google to browse your inbox and log emails as CRM activities.
            </p>
            <button
              onClick={connectGmail}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold mx-auto"
              style={{ background: '#015035' }}
            >
              <Mail size={15} />
              Connect Gmail
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Inbox"
        subtitle={gmailEmail ?? 'Gmail'}
        action={{ label: 'Disconnect', onClick: disconnectGmail }}
      />
      <div className="p-3 sm:p-6 flex-1 flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inbox…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-green-700"
            />
          </div>
          <button
            onClick={() => fetchMessages(search)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Message list */}
          <div className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-shrink-0 w-full md:w-[360px] lg:w-[400px]">
            {loading && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-gray-400">
                <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-gray-400">
                No messages found.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {filteredMessages.map(msg => {
                  const { name, email: senderEmail } = parseSender(msg.from)
                  const contact = findMatchingContact(senderEmail)
                  const isActive = selected?.id === msg.id
                  const unread = isUnread(msg)
                  const logged = loggedIds.has(msg.id)

                  return (
                    <button
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${isActive ? 'bg-green-50/70' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5"
                          style={{ background: contact ? '#015035' : '#6b7280' }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs truncate ${unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {name}
                            </span>
                            <span className="text-[11px] text-gray-400 flex-shrink-0">{formatDate(msg.internalDate)}</span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${unread ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                            {msg.subject}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{msg.snippet}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {contact && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                                {contact.fullName}
                              </span>
                            )}
                            {logged && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                                <CheckCircle size={8} /> Logged
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail pane — hidden on mobile when no message selected */}
          {selected ? (
            <div className="hidden md:flex flex-col flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden min-w-0">
              {/* Detail header */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">{selected.subject}</h3>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">From:</span> {selected.from}
                  </p>
                  {selected.to && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">To:</span> {selected.to}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{selected.date}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={openLogModal}
                    disabled={loggedIds.has(selected.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      loggedIds.has(selected.id)
                        ? 'bg-blue-50 text-blue-600 cursor-default'
                        : 'text-white'
                    }`}
                    style={loggedIds.has(selected.id) ? undefined : { background: '#015035' }}
                  >
                    {loggedIds.has(selected.id) ? (
                      <><CheckCircle size={12} /> Logged</>
                    ) : (
                      <><Link2 size={12} /> Log as Activity</>
                    )}
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <RefreshCw size={14} className="animate-spin" /> Loading…
                  </div>
                ) : (
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.body || selected.snippet}
                  </pre>
                )}
              </div>

              {/* CRM match banner */}
              {(() => {
                const { email: senderEmail } = parseSender(selected.from)
                const contact = findMatchingContact(senderEmail)
                if (!contact) return null
                return (
                  <div className="px-5 py-3 border-t border-gray-100 bg-green-50/50 flex items-center gap-2">
                    <CheckCircle size={13} className="text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-800 flex-1">
                      Sender matched to CRM contact: <strong>{contact.fullName}</strong> — {contact.companyName}
                    </p>
                    <ExternalLink size={12} className="text-green-600 flex-shrink-0" />
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center bg-white rounded-xl border border-gray-200 text-sm text-gray-400">
              Select an email to read
            </div>
          )}
        </div>
      </div>

      {/* Log as Activity modal */}
      {logModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Log Email as CRM Activity</h3>
              <button onClick={() => setLogModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {/* Email preview */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-0.5">{selected.subject}</p>
                <p className="text-[11px] text-gray-500">{selected.from}</p>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{selected.snippet}</p>
              </div>

              {/* Contact selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Link to CRM Contact
                </label>
                <div className="relative">
                  <select
                    value={logContact}
                    onChange={e => setLogContact(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-green-700 appearance-none pr-8"
                  >
                    <option value="">— Select a contact —</option>
                    {crmContacts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.companyName})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {logSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <CheckCircle size={14} /> Activity saved to CRM!
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveActivity}
                  disabled={!logContact || logSuccess}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  Save Activity
                </button>
                <button
                  onClick={() => setLogModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
