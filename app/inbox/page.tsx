'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCrmContacts } from '@/lib/supabase'
import type { CRMContact } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import {
  Mail, RefreshCw, X, ChevronDown, Search, Link2,
  Inbox as InboxIcon, AlertCircle, CheckCircle, ExternalLink,
  Send, Reply, PenSquare, PenLine, CheckSquare, Calendar, Flag,
} from 'lucide-react'
import type { AppTaskCategory, TaskPriority } from '@/lib/types'
import { type EmailSignatureData, generateSignatureHtml } from '@/lib/email-signature'

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
  bodyHtml?: string
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
  const { toast } = useToast()
  const { gmailToken, gmailEmail, connectGmail, disconnectGmail, user } = useAuth()
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<GmailMessageFull | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [logModal, setLogModal] = useState(false)
  const [logContact, setLogContact] = useState('')
  const [logNote, setLogNote] = useState('')
  const [logSuccess, setLogSuccess] = useState(false)
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeCc, setComposeCc] = useState('')
  const [sending, setSending] = useState(false)
  const [isReply, setIsReply] = useState(false)
  const [userSignature, setUserSignature] = useState<EmailSignatureData | null>(null)
  const [teamMemberNames, setTeamMemberNames] = useState<{ id: string; name: string }[]>([])
  const [taskModal, setTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('Medium')
  const [taskSaving, setTaskSaving] = useState(false)

  useEffect(() => {
    fetchCrmContacts().then(d => { if (Array.isArray(d)) setCrmContacts(d) }).catch(() => {})
    fetch('/api/team-members').then(r => r.json()).then((members: Array<{ id: string; name: string; email: string; emailSignature?: EmailSignatureData }>) => {
      const me = members.find(m => m.email === user?.email)
      if (me?.emailSignature?.name) setUserSignature(me.emailSignature)
      setTeamMemberNames(members.map(m => ({ id: m.id, name: m.name })))
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load already-logged Gmail activity IDs from the API
  useEffect(() => {
    fetch('/api/crm/activities')
      .then(r => r.ok ? r.json() : [])
      .then((activities: { id: string }[]) => {
        setLoggedIds(new Set(
          activities
            .filter((a: { id: string }) => a.id.startsWith('gmail_'))
            .map((a: { id: string }) => a.id.replace('gmail_', ''))
        ))
      })
      .catch(() => toast('Failed to load logged activities', 'error'))
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
          setError('Gmail session expired. Click "Reconnect" above to sign back in.')
          // Clear just the token, not the email — so the UI shows "Session Expired" with context
          setMessages([])
          return
        }
        setError(e.error ?? 'Failed to load inbox')
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
    } catch { toast('Failed to load message details', 'error') }
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
    setLogNote('')
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

    fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: activity.id,
        type: 'email',
        title: `Email: ${activity.subject}`,
        body: logNote.trim() || activity.body,
        contactId: activity.contactId,
        contactName: activity.contactName,
        companyName: activity.companyName,
        user: activity.loggedBy,
        timestamp: activity.loggedAt,
      }),
    })
      .then(() => {
        // Update contact's lastActivity
        fetch(`/api/crm/contacts/${activity.contactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastActivity: activity.loggedAt }),
        }).catch(() => toast('Failed to update contact activity', 'error'))
        setLoggedIds(prev => new Set([...prev, selected.id]))
        setLogSuccess(true)
        setTimeout(() => setLogModal(false), 1200)
      })
      .catch(() => {
        toast('Failed to log activity', 'error')
      })
  }

  async function handleSendEmail() {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return
    setSending(true)
    try {
      let htmlBody = composeBody.replace(/\n/g, '<br/>')
      const bodyEl = document.querySelector<HTMLTextAreaElement>('[data-compose-body]')
      if (bodyEl?.dataset.signatureHtml) {
        htmlBody = htmlBody.replace(/<br\/>---<br\/>$/, '') + bodyEl.dataset.signatureHtml
      }
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user?.email ?? gmailEmail,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          htmlBody,
          cc: composeCc.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        toast(e.error || 'Failed to send email', 'error')
        return
      }
      toast('Email sent successfully', 'success')
      setShowCompose(false)
      setComposeTo('')
      setComposeSubject('')
      setComposeBody('')
      setComposeCc('')
      setIsReply(false)
      // Refresh inbox to show sent message
      fetchMessages(search)
    } catch {
      toast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  function openCompose() {
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('')
    setComposeCc('')
    setIsReply(false)
    setShowCompose(true)
  }

  function openReply() {
    if (!selected) return
    const { email: senderEmail } = parseSender(selected.from)
    setComposeTo(senderEmail)
    setComposeSubject(selected.subject.startsWith('Re:') ? selected.subject : `Re: ${selected.subject}`)
    setComposeBody('')
    setComposeCc('')
    setIsReply(true)
    setShowCompose(true)
  }

  function openTaskModal() {
    if (!selected) return
    const { name: senderName } = parseSender(selected.from)
    setTaskTitle(`Follow up: ${selected.subject}`)
    setTaskDesc(`From: ${senderName} (${parseSender(selected.from).email})\nDate: ${selected.date}\n\n${(selected.body || selected.snippet).slice(0, 300)}`)
    setTaskAssignee(teamMemberNames[0]?.name ?? user?.name ?? '')
    setTaskDue(new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0])
    setTaskPriority('Medium')
    setTaskModal(true)
  }

  async function saveEmailTask() {
    if (!selected || !taskTitle.trim()) return
    setTaskSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || undefined,
          category: 'Email' as AppTaskCategory,
          priority: taskPriority,
          status: 'Pending',
          assignedTo: taskAssignee,
          dueDate: taskDue,
          linkedId: `gmail_${selected.id}`,
        }),
      })
      if (!res.ok) {
        toast('Failed to create task', 'error')
        return
      }
      toast('Task created from email', 'success')
      setTaskModal(false)
    } catch {
      toast('Failed to create task', 'error')
    } finally {
      setTaskSaving(false)
    }
  }

  const filteredMessages = messages.filter(m =>
    !search ||
    m.subject.toLowerCase().includes(search.toLowerCase()) ||
    m.from.toLowerCase().includes(search.toLowerCase()) ||
    m.snippet.toLowerCase().includes(search.toLowerCase())
  )

  // — Not connected —
  if (!gmailToken) {
    const hasExpired = !!gmailEmail // We know which email was connected but token is gone
    return (
      <>
        <Header title="Inbox" subtitle="Gmail connected inbox" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <InboxIcon size={28} className="text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-800 mb-2">
              {hasExpired ? 'Gmail Session Expired' : 'Connect your Gmail'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {hasExpired
                ? `Your session for ${gmailEmail} has expired. Reconnect to continue browsing your inbox.`
                : 'Sign in with Google to browse your inbox and log emails as CRM activities.'
              }
            </p>
            <button
              onClick={connectGmail}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold mx-auto"
              style={{ background: '#015035' }}
            >
              <Mail size={15} />
              {hasExpired ? 'Reconnect Gmail' : 'Connect Gmail'}
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
          <button
            onClick={openCompose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
            style={{ background: '#015035' }}
          >
            <PenSquare size={13} />
            Compose
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
                    onClick={openReply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Reply size={12} /> Reply
                  </button>
                  <button
                    onClick={openTaskModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <CheckSquare size={12} /> Create Task
                  </button>
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
                ) : selected.bodyHtml ? (
                  <iframe
                    srcDoc={selected.bodyHtml}
                    sandbox="allow-same-origin"
                    className="w-full border-0"
                    style={{ minHeight: '400px' }}
                    onLoad={(e) => {
                      const iframe = e.target as HTMLIFrameElement;
                      if (iframe.contentDocument) {
                        iframe.style.height = iframe.contentDocument.documentElement.scrollHeight + 'px';
                      }
                    }}
                  />
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
      {/* Compose / Reply modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                {isReply ? <><Reply size={14} /> Reply</> : <><PenSquare size={14} /> New Email</>}
              </h3>
              <button onClick={() => setShowCompose(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
                <input
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                  placeholder="to@company.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CC <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  value={composeCc}
                  onChange={e => setComposeCc(e.target.value)}
                  placeholder="cc@company.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</label>
                <input
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</label>
                <textarea
                  data-compose-body
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  rows={8}
                  placeholder="Write your message..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 resize-none"
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <Send size={13} />
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
                {userSignature && (
                  <button
                    onClick={() => {
                      const sigHtml = generateSignatureHtml(userSignature)
                      setComposeBody(prev => prev + '\n\n---\n')
                      const bodyEl = document.querySelector<HTMLTextAreaElement>('[data-compose-body]')
                      if (bodyEl) {
                        bodyEl.dataset.signatureHtml = sigHtml
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                    style={{ borderColor: '#015035', color: '#015035' }}
                    title="Insert your email signature"
                  >
                    <PenLine size={13} /> Signature
                  </button>
                )}
                <button
                  onClick={() => setShowCompose(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

              {/* Optional note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Note <span className="normal-case font-normal text-gray-400">(optional — replaces email body in CRM)</span>
                </label>
                <textarea
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder="Add a note about this email interaction…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 resize-none"
                />
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

      {taskModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare size={14} /> Create Task from Email
              </h3>
              <button onClick={() => setTaskModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                <p className="text-xs font-semibold text-sky-800 mb-0.5">{selected.subject}</p>
                <p className="text-[11px] text-sky-600">{selected.from}</p>
                <p className="text-[11px] text-sky-500 mt-1 line-clamp-2">{selected.snippet}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Task Title *</label>
                <input
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assign To</label>
                  <div className="relative">
                    <select
                      value={taskAssignee}
                      onChange={e => setTaskAssignee(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-green-700 appearance-none pr-8"
                    >
                      {teamMemberNames.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Due Date *</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={e => setTaskDue(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {(['High', 'Medium', 'Low'] as TaskPriority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setTaskPriority(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        taskPriority === p
                          ? p === 'High' ? 'bg-red-100 text-red-700 border border-red-200' : p === 'Medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                          : 'border border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  onClick={saveEmailTask}
                  disabled={taskSaving || !taskTitle.trim() || !taskDue}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <CheckSquare size={13} />
                  {taskSaving ? 'Creating...' : 'Create Task'}
                </button>
                <button
                  onClick={() => setTaskModal(false)}
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
