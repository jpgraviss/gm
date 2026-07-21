'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import {
  Clock, Send, AlertCircle, Ban, Mail, RefreshCw,
  X, Eye, Loader2, RotateCcw, Calendar,
} from 'lucide-react'

interface ScheduledEmail {
  id: string
  toEmail: string
  toName: string | null
  subject: string
  html: string
  sendAt: string
  sentAt: string | null
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  type: string
  recurring: string
  metadata: Record<string, unknown>
  error: string | null
  createdBy: string | null
  createdAt: string
}

const STATUS_TABS = ['pending', 'sent', 'failed', 'cancelled'] as const
type StatusTab = typeof STATUS_TABS[number]

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#dbeafe', color: '#1e40af', label: 'Pending' },
  sent:      { bg: '#d1fae5', color: '#065f46', label: 'Sent' },
  failed:    { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled' },
}

const TYPE_LABELS: Record<string, string> = {
  report: 'Report',
  template: 'Template',
  broadcast: 'Broadcast',
  notification: 'Notification',
}

export default function ScheduledEmailsPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [emails, setEmails] = useState<ScheduledEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.replace('/admin')
    }
  }, [user, authLoading, router])

  // AUDIT #267 — GET /api/email/scheduled?limit=200 with no offset
  // follow-up despite getScheduledEmails() supporting it, so the
  // Pending/Sent Today/Failed counts and list silently undercounted past
  // 200 entries in one status. Page through via offset until a page comes
  // back short of the page size.
  async function fetchAllScheduled(status?: string): Promise<ScheduledEmail[]> {
    const pageSize = 200
    const all: ScheduledEmail[] = []
    let offset = 0
    for (;;) {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
      if (status) params.set('status', status)
      const res = await fetch(`/api/email/scheduled?${params}`)
      if (!res.ok) throw new Error('Failed to load scheduled emails')
      const page: ScheduledEmail[] = await res.json()
      all.push(...page)
      if (page.length < pageSize) break
      offset += pageSize
    }
    return all
  }

  function load(status?: string) {
    setLoading(true)
    fetchAllScheduled(status)
      .then(setEmails)
      .catch(() => toast('Failed to load scheduled emails', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAllScheduled(activeTab)
      .then(data => { if (!cancelled) setEmails(data) })
      .catch(() => toast('Failed to load scheduled emails', 'error'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cancelEmail(id: string) {
    try {
      const res = await fetch(`/api/email/scheduled?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to cancel', 'error'); return }
      setEmails(prev => prev.map(e => e.id === id ? { ...e, status: 'cancelled' as const } : e))
      toast('Email cancelled', 'success')
    } catch {
      toast('Failed to cancel', 'error')
    }
  }

  async function retryEmail(email: ScheduledEmail) {
    // Guards against a duplicate real send from a rapid double-click —
    // scheduleEmail() has no idempotency key, so two in-flight retries for
    // the same row would otherwise both create a pending row and both
    // genuinely get sent by the cron worker.
    if (retryingId) return
    setRetryingId(email.id)
    try {
      const res = await fetch('/api/email/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.toEmail,
          toName: email.toName,
          subject: email.subject,
          html: email.html,
          sendAt: new Date().toISOString(),
          type: email.type,
          recurring: email.recurring,
          metadata: email.metadata,
        }),
      })
      if (!res.ok) { toast('Failed to retry', 'error'); return }
      toast('Re-scheduled for immediate send', 'success')
      load(activeTab)
    } catch {
      toast('Failed to retry', 'error')
    } finally {
      setRetryingId(null)
    }
  }

  const pending = emails.filter(e => e.status === 'pending')
  const sentToday = emails.filter(e => {
    if (e.status !== 'sent' || !e.sentAt) return false
    return new Date(e.sentAt).toDateString() === new Date().toDateString()
  })
  const failedCount = emails.filter(e => e.status === 'failed').length
  const nextDue = pending.length > 0 ? pending.reduce((a, b) => new Date(a.sendAt) < new Date(b.sendAt) ? a : b) : null

  const preview = previewId ? emails.find(e => e.id === previewId) : null

  return (
    <>
      <Header title="Scheduled Emails" subtitle="Manage queued and recurring email sends" />
      <div className="page-content">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#01503515', color: '#015035' }}><Clock size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Pending</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{pending.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#10b98115', color: '#10b981' }}><Send size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Sent Today</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{sentToday.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#ef444415', color: '#ef4444' }}><AlertCircle size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Failed</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{failedCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#3b82f615', color: '#3b82f6' }}><Calendar size={14} /></div>
              <span className="text-[10px] md:text-[11px] text-gray-500 uppercase tracking-wide font-semibold">Next Due</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">
              {nextDue ? formatDate(nextDue.sendAt) : 'None'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-white'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
              style={activeTab === tab ? { background: '#015035' } : undefined}
            >
              {STATUS_STYLE[tab].label}
            </button>
          ))}
          <button
            onClick={() => load(activeTab)}
            className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : emails.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Mail size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No {activeTab} emails</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Recipient</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Scheduled</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Recurring</th>
                    <th className="w-24 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {emails.map(e => {
                    const style = STATUS_STYLE[e.status]
                    return (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900 truncate">{e.toName || e.toEmail}</p>
                          {e.toName && <p className="text-[11px] text-gray-400 truncate">{e.toEmail}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 truncate max-w-[200px]">{e.subject}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-600">{TYPE_LABELS[e.type] ?? e.type}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] text-gray-500">
                          {formatDate(e.sendAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: style.bg, color: style.color }}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500 capitalize">
                          {e.recurring === 'none' ? '—' : e.recurring}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setPreviewId(e.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Preview"><Eye size={13} /></button>
                            {e.status === 'pending' && (
                              <button onClick={() => cancelEmail(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Cancel"><Ban size={13} /></button>
                            )}
                            {e.status === 'failed' && (
                              <button onClick={() => retryEmail(e)} disabled={retryingId === e.id} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-50" title="Retry"><RotateCcw size={13} className={retryingId === e.id ? 'animate-spin' : ''} /></button>
                            )}
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

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{preview.subject}</h3>
                <p className="text-xs text-gray-400 mt-0.5">To: {preview.toEmail}</p>
              </div>
              <button onClick={() => setPreviewId(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div><span className="text-gray-400">Status:</span> <span className="font-medium text-gray-700 capitalize">{preview.status}</span></div>
                <div><span className="text-gray-400">Type:</span> <span className="font-medium text-gray-700">{TYPE_LABELS[preview.type] ?? preview.type}</span></div>
                <div><span className="text-gray-400">Scheduled:</span> <span className="font-medium text-gray-700">{formatDate(preview.sendAt)}</span></div>
                <div><span className="text-gray-400">Recurring:</span> <span className="font-medium text-gray-700 capitalize">{preview.recurring}</span></div>
                {preview.sentAt && <div><span className="text-gray-400">Sent:</span> <span className="font-medium text-gray-700">{formatDate(preview.sentAt)}</span></div>}
                {preview.error && <div className="col-span-2"><span className="text-red-500">Error:</span> <span className="font-medium text-red-700">{preview.error}</span></div>}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <iframe
                  srcDoc={preview.html}
                  className="w-full h-[400px] border-0"
                  title="Email preview"
                  sandbox=""
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
