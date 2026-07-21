'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, projectStatusColors, invoiceStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  Globe, CheckCircle, FolderKanban, FileText, MessageSquare,
  Download, Upload, Bell, ChevronRight, X, AlertTriangle, LogOut,
  Search, BarChart3, Star, Activity, TrendingUp, Share2,
} from 'lucide-react'

// AUDIT.md #199 — matches the shape app/tickets/page.tsx's staff viewer
// actually reads (`author`/`body`/`timestamp`, not `from`/`sender`/`text`).
// This was previously written as `{from, body, date}`, which crashed the
// staff ticket viewer (`msg.author.split(' ')`) on any real client-created
// ticket that included an initial message.
interface ClientTicketMessage {
  id: string
  author: string
  isInternal: boolean
  body: string
  timestamp: string
}

interface ClientTicket {
  id: string
  subject: string
  status: string
  priority: string
  createdDate: string
  messages: ClientTicketMessage[]
}

const TICKET_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Closed: 'bg-gray-100 text-gray-500',
}

interface PortalInsights {
  company: { name: string }
  period: { label: string }
  seo?: { clicks: number; impressions: number; avgPosition: number; ctr: number }
  traffic?: { sessions: number; users: number; pageviews: number; bounceRate: number }
  reputation?: { newReviews: number; averageRating: number; totalReviews: number }
  ranking?: { tracked: number; top3: number; top10: number; improved: number; declined: number }
  uptime?: { sitesMonitored: number; uptimePercent: number; incidents: number }
}
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'

export default function ClientPortalPage() {
  const { toast } = useToast()
  const { user, logout } = useAuth()
  const company = user?.company ?? ''
  const contactName = user?.name ?? ''

  const [activeTab, setActiveTab] = useState<'overview' | 'project' | 'billing' | 'tickets' | 'files' | 'insights' | 'social'>('overview')
  const [insights, setInsights] = useState<PortalInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)

  // Notifications
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message?: string; link?: string; read: boolean; createdAt: string }>>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Social posts for approval
  const [pendingPosts, setPendingPosts] = useState<Array<{ id: string; content: string; platforms: string[]; scheduledAt?: string; status: string; approvalStatus: string }>>([])
  const [publishedPosts, setPublishedPosts] = useState<Array<{ id: string; content: string; platforms: string[]; publishedAt?: string; status: string }>>([])
  const [socialLoading, setSocialLoading] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [project, setProject] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientInvoices, setClientInvoices] = useState<any[]>([])
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState(false)
  const [existingTickets, setExistingTickets] = useState<ClientTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [files, setFiles] = useState<{ name: string; size: number; createdAt: string; url: string | null }[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)

  // AUDIT.md #201 — Stripe redirects back here after checkout; surface the
  // result and land on the Billing tab instead of silently landing back on
  // Overview with a stray query string.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.has('paid')) {
      setActiveTab('billing')
      toast('Payment received — thank you!', 'success')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('checkout') === 'cancelled') {
      setActiveTab('billing')
      toast('Checkout cancelled', 'info')
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!company) { setLoading(false); return }
    const q = encodeURIComponent(company)
    Promise.all([
      fetch(`/api/projects?company=${q}`).then(r => r.ok ? r.json() : []).then((d: unknown[]) => { if (Array.isArray(d)) setProject(d[0] ?? null) }).catch(() => toast('Failed to load project data', 'error')),
      fetch(`/api/contracts?company=${q}`).then(r => r.ok ? r.json() : []).then((d: unknown[]) => { if (Array.isArray(d)) setContract(d[0] ?? null) }).catch(() => toast('Failed to load contract data', 'error')),
      fetch(`/api/invoices?company=${q}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setClientInvoices(d) }).catch(() => toast('Failed to load invoices', 'error')),
      fetch(`/api/files?company=${q}`).then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setFiles(d) }).catch(() => toast('Failed to load files', 'error')),
    ]).finally(() => setLoading(false))
  }, [company])

  // Load portal insights lazily when the Insights tab opens
  useEffect(() => {
    if (activeTab !== 'insights' || !company || insights) return
    setInsightsLoading(true)
    fetch(`/api/portal/insights?company=${encodeURIComponent(company)}`)
      .then(async (r) => {
        if (!r.ok) return null
        return (await r.json()) as PortalInsights
      })
      .then((d) => { if (d) setInsights(d) })
      .catch(() => {/* non-fatal */})
      .finally(() => setInsightsLoading(false))
  }, [activeTab, company, insights])

  // Fetch notifications on mount
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/portal-clients/notifications?clientId=${encodeURIComponent(user.id)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
      .catch(() => {/* non-fatal */})
  }, [user?.id])

  // Load existing tickets when Support tab opens
  useEffect(() => {
    if (activeTab !== 'tickets' || !company) return
    setTicketsLoading(true)
    fetch(`/api/tickets?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setExistingTickets(data) })
      .catch(() => {/* non-fatal */})
      .finally(() => setTicketsLoading(false))
  }, [activeTab, company])

  // Load social posts lazily when Social tab opens
  useEffect(() => {
    if (activeTab !== 'social' || !company) return
    setSocialLoading(true)
    const q = encodeURIComponent(company)
    Promise.all([
      fetch(`/api/social-posts?company=${q}&status=pending_approval`).then(r => (r.ok ? r.json() : [])),
      fetch(`/api/social-posts?company=${q}&status=published`).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([pending, published]) => {
        if (Array.isArray(pending)) setPendingPosts(pending)
        if (Array.isArray(published)) setPublishedPosts(published.slice(0, 10))
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setSocialLoading(false))
  }, [activeTab, company])

  async function markNotificationRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    fetch('/api/portal-clients/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], read: true }),
    }).catch(() => {/* best-effort */})
  }

  async function handleApprovePost(postId: string) {
    try {
      const res = await fetch(`/api/social-posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: 'approved' }),
      })
      if (!res.ok) { toast('Failed to approve', 'error'); return }
      setPendingPosts(prev => prev.filter(p => p.id !== postId))
      toast('Post approved', 'success')
    } catch { toast('Failed to approve', 'error') }
  }

  async function handleRejectPost(postId: string) {
    try {
      const res = await fetch(`/api/social-posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: 'rejected', rejectionReason: rejectReason }),
      })
      if (!res.ok) { toast('Failed to reject', 'error'); return }
      setPendingPosts(prev => prev.filter(p => p.id !== postId))
      setRejectingId(null)
      setRejectReason('')
      toast('Post rejected', 'success')
    } catch { toast('Failed to reject', 'error') }
  }

  const selectedTicket = existingTickets.find(t => t.id === selectedTicketId) ?? null

  async function sendTicketReply() {
    if (!selectedTicket || !replyText.trim()) return
    setReplySending(true)
    try {
      const newMsg: ClientTicketMessage = {
        id: `m-${Date.now()}`,
        author: contactName,
        isInternal: false,
        body: replyText.trim(),
        timestamp: new Date().toISOString(),
      }
      const updatedMessages = [...selectedTicket.messages, newMsg]
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      if (!res.ok) throw new Error()
      setExistingTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: updatedMessages } : t))
      setReplyText('')
      toast('Reply sent', 'success')
    } catch {
      toast('Failed to send reply', 'error')
    } finally {
      setReplySending(false)
    }
  }

  // AUDIT.md #201 — the Billing tab previously had no way to actually pay
  // an invoice online despite POST /api/invoices/[id]/checkout being a
  // real, working Stripe Checkout endpoint already wired up for staff.
  async function handlePayInvoice(invoiceId: string) {
    setPayingInvoiceId(invoiceId)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast(data.error || 'Failed to start checkout', 'error')
        setPayingInvoiceId(null)
      }
    } catch {
      toast('Failed to start checkout', 'error')
      setPayingInvoiceId(null)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const openInvoices = clientInvoices.filter(i => i.status !== 'Paid')
  const paidInvoices = clientInvoices.filter(i => i.status === 'Paid')

  if (loading) return <LoadingScreen />

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f8fafc' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-sm" style={{ background: '#012b1e' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
            {company?.[0] ?? ''}
          </div>
          <div>
            <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{company}</p>
            <p className="text-white/50 text-[11px]">{user?.service ?? 'Client Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bell size={16} className="text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Notifications</p>
                  <button onClick={() => setShowNotifications(false)} className="p-1 rounded hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <button
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-emerald-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                            {n.message && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              {contactName.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-white/80 text-xs font-medium hidden sm:block">{contactName}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white text-xs font-medium"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex-shrink-0 flex gap-1 px-3 sm:px-6 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto">
        {([
          { id: 'overview', label: 'Overview',    icon: <Globe size={13} /> },
          { id: 'project',  label: 'My Project',  icon: <FolderKanban size={13} /> },
          { id: 'insights', label: 'Insights',    icon: <BarChart3 size={13} /> },
          { id: 'billing',  label: `Billing${openInvoices.length > 0 ? ` (${openInvoices.length})` : ''}`, icon: <FileText size={13} /> },
          { id: 'tickets',  label: 'Support',     icon: <MessageSquare size={13} /> },
          { id: 'social',   label: `Social${pendingPosts.length > 0 ? ` (${pendingPosts.length})` : ''}`, icon: <Share2 size={13} /> },
          { id: 'files',    label: 'Files',        icon: <Download size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 pb-2.5 text-xs font-semibold border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-green-800 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            {showWelcome && (
              <div className="flex items-start gap-3 p-4 rounded-xl border mb-2" style={{ background: '#012b1e', borderColor: '#015035' }}>
                <div>
                  <p className="text-white font-bold text-sm mb-1">Welcome to your client portal!</p>
                  <p className="text-white/70 text-xs leading-relaxed">Track your project progress, view invoices, submit support requests, and access shared files. Questions? Reply to any email from us or use the Support tab.</p>
                </div>
                <button onClick={() => setShowWelcome(false)} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 mt-0.5">
                  <X size={14} className="text-white/50" />
                </button>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome back, {contactName.split(' ')[0]}!</h2>
              <p className="text-sm text-gray-500">Here&apos;s a snapshot of your account with Graviss Marketing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {project && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban size={14} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Active Project</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">{project.serviceType}</p>
                  <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-bold" style={{ color: '#015035' }}>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#015035' }} />
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('project')} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    View details <ChevronRight size={11} />
                  </button>
                </div>
              )}

              {contract && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Contract</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">{contract.serviceType} Agreement</p>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Value</span><span className="font-bold text-gray-800">{formatCurrency(contract.value)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="text-gray-700">{contract.billingStructure}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Renewal</span><span className="text-gray-700">{formatDate(contract.renewalDate)}</span></div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} style={{ color: '#015035' }} />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Billing</p>
                </div>
                {openInvoices.length > 0 ? (
                  <>
                    <p className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(openInvoices.reduce((s, i) => s + i.amount, 0))}
                    </p>
                    <p className="text-xs text-orange-600 font-medium mb-3">{openInvoices.length} invoice{openInvoices.length > 1 ? 's' : ''} outstanding</p>
                    <button onClick={() => setActiveTab('billing')} className="w-full py-2 rounded-xl text-white text-xs font-semibold" style={{ background: '#015035' }}>
                      View Invoices
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-emerald-600 mb-1">All paid up!</p>
                    <p className="text-xs text-gray-400">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''} on file</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Project */}
        {activeTab === 'project' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {project ? (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{project.serviceType} Project</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Launch: {formatDate(project.launchDate)}</p>
                    </div>
                    <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500 font-medium">Overall Progress</span>
                      <span className="font-bold" style={{ color: '#015035' }}>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#015035' }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Milestones</h3>
                  <div className="flex flex-col gap-2">
                    {project.milestones.map((m: { id: string; name: string; dueDate: string; completed: boolean }) => (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={m.completed ? { background: '#015035' } : { background: '#e5e7eb' }}>
                          {m.completed && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-semibold ${m.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.name}</p>
                          <p className="text-[11px] text-gray-400">{formatDate(m.dueDate)}</p>
                        </div>
                        {m.completed && <span className="text-[11px] text-emerald-600 font-semibold">Complete</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <FolderKanban size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No active project yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Insights */}
        {activeTab === 'insights' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-base font-bold text-gray-900 mb-1">Performance Insights</h2>
              <p className="text-xs text-gray-500">Live data from your marketing services — last 28 days.</p>
            </div>

            {insightsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : !insights ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <BarChart3 size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Insights not yet available</p>
                <p className="text-xs text-gray-400 mt-1">
                  Your account manager will configure your integrations soon. Check back shortly.
                </p>
              </div>
            ) : (
              <>
                {insights.seo && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Search size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Search Performance</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InsightMetric label="Clicks" value={insights.seo.clicks.toLocaleString()} />
                      <InsightMetric label="Impressions" value={insights.seo.impressions.toLocaleString()} />
                      <InsightMetric label="Avg CTR" value={`${(insights.seo.ctr * 100).toFixed(2)}%`} />
                      <InsightMetric label="Avg Position" value={insights.seo.avgPosition.toFixed(1)} />
                    </div>
                  </div>
                )}

                {insights.traffic && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Website Traffic</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InsightMetric label="Sessions" value={insights.traffic.sessions.toLocaleString()} />
                      <InsightMetric label="Users" value={insights.traffic.users.toLocaleString()} />
                      <InsightMetric label="Pageviews" value={insights.traffic.pageviews.toLocaleString()} />
                      <InsightMetric label="Bounce Rate" value={`${(insights.traffic.bounceRate * 100).toFixed(1)}%`} />
                    </div>
                  </div>
                )}

                {insights.reputation && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Star size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Reputation</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <InsightMetric label="Average Rating" value={`${insights.reputation.averageRating.toFixed(1)} ★`} />
                      <InsightMetric label="New Reviews" value={insights.reputation.newReviews.toString()} />
                      <InsightMetric label="Total Reviews" value={insights.reputation.totalReviews.toString()} />
                    </div>
                  </div>
                )}

                {insights.ranking && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Keyword Rankings</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <InsightMetric label="Tracked" value={insights.ranking.tracked.toString()} />
                      <InsightMetric label="Top 3" value={insights.ranking.top3.toString()} />
                      <InsightMetric label="Top 10" value={insights.ranking.top10.toString()} />
                      <InsightMetric label="Improved" value={insights.ranking.improved.toString()} />
                      <InsightMetric label="Declined" value={insights.ranking.declined.toString()} />
                    </div>
                  </div>
                )}

                {insights.uptime && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={16} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Website Uptime</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <InsightMetric label="Sites" value={insights.uptime.sitesMonitored.toString()} />
                      <InsightMetric label="Uptime (30d)" value={`${insights.uptime.uptimePercent}%`} />
                      <InsightMetric label="Incidents" value={insights.uptime.incidents.toString()} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Billing */}
        {activeTab === 'billing' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {openInvoices.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">{formatCurrency(openInvoices.reduce((s, i) => s + i.amount, 0))} outstanding</p>
                  <p className="text-xs text-orange-600">{openInvoices.length} invoice{openInvoices.length > 1 ? 's' : ''} awaiting payment</p>
                </div>
                <span className="text-xs font-semibold text-orange-700">Payment due</span>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Invoice History</h3>
              </div>
              {clientInvoices.length > 0 ? (
                <div className="flex flex-col divide-y divide-gray-100">
                  {clientInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                        <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                        {inv.status !== 'Paid' && (
                          <button
                            onClick={() => handlePayInvoice(inv.id)}
                            disabled={payingInvoiceId === inv.id}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                            style={{ background: '#015035' }}
                          >
                            {payingInvoiceId === inv.id ? 'Redirecting…' : 'Pay Now'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">No invoices yet</div>
              )}
            </div>
          </div>
        )}

        {/* Support */}
        {activeTab === 'tickets' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {selectedTicket ? (
              // AUDIT.md #200 — the Support tab previously only listed
              // subject/status/message-count with no click-through — real
              // clients had no in-app way to see or respond to a staff
              // reply on their own ticket, despite the backend fully
              // supporting it. `messages` here is already server-filtered
              // to non-internal entries (requirePortalClient + mapTicket),
              // so it's safe to render as-is.
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedTicketId(null); setReplyText('') }}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium flex-shrink-0"
                  >
                    ← Back
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedTicket.subject}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TICKET_STATUS_COLORS[selectedTicket.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <div className="flex flex-col gap-3 p-5 max-h-96 overflow-y-auto">
                  {selectedTicket.messages.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
                  ) : (
                    selectedTicket.messages.map(m => {
                      const fromUs = m.author !== contactName
                      return (
                        <div key={m.id} className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${fromUs ? 'self-start bg-gray-50' : 'self-end text-white'}`} style={!fromUs ? { background: '#015035' } : {}}>
                          <p className="text-[10px] font-semibold mb-1 opacity-70">{m.author}</p>
                          <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                          <p className="text-[10px] mt-1 opacity-50">{formatDate(m.timestamp)}</p>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="border-t border-gray-100 p-4 flex flex-col gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={replySending || !replyText.trim()}
                      onClick={sendTicketReply}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#015035' }}
                    >
                      {replySending ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">Submit a Request</h3>
                  <p className="text-xs text-gray-400 mb-4">Have a question or need a change? Send us a message.</p>
                  {ticketSuccess ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <CheckCircle size={24} className="mx-auto mb-2 text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">Request submitted!</p>
                      <p className="text-xs text-emerald-600 mt-1">Our team will get back to you shortly.</p>
                      <button onClick={() => { setTicketSuccess(false); setTicketSubject(''); setTicketMessage('') }} className="mt-3 text-xs text-emerald-700 underline">Submit another</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <input
                        value={ticketSubject}
                        onChange={e => setTicketSubject(e.target.value)}
                        placeholder="Subject / brief description..."
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                      />
                      <textarea
                        value={ticketMessage}
                        onChange={e => setTicketMessage(e.target.value)}
                        placeholder="Describe your request in detail..."
                        rows={4}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          disabled={ticketSubmitting || !ticketSubject.trim()}
                          onClick={async () => {
                            setTicketSubmitting(true)
                            try {
                              const res = await fetch('/api/tickets', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  subject: ticketSubject.trim(),
                                  company,
                                  contactName,
                                  contactEmail: user?.email ?? '',
                                  source: 'Portal',
                                  messages: ticketMessage.trim() ? [{
                                    id: `m-${Date.now()}`,
                                    author: contactName,
                                    isInternal: false,
                                    body: ticketMessage.trim(),
                                    timestamp: new Date().toISOString(),
                                  }] : [],
                                }),
                              })
                              if (res.ok) {
                                setTicketSuccess(true)
                                fetch(`/api/tickets?company=${encodeURIComponent(company)}`)
                                  .then(r => r.ok ? r.json() : [])
                                  .then(data => { if (Array.isArray(data)) setExistingTickets(data) })
                                  .catch(() => {})
                              }
                            } finally {
                              setTicketSubmitting(false)
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                          style={{ background: '#015035' }}
                        >
                          {ticketSubmitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing tickets */}
                {ticketsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                  </div>
                ) : existingTickets.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Your Requests</h3>
                    </div>
                    <div className="flex flex-col divide-y divide-gray-100">
                      {existingTickets.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTicketId(t.id)}
                          className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{t.subject}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {t.createdDate ? formatDate(t.createdDate) : ''}
                                {t.messages && t.messages.length > 0 ? ` · ${t.messages.length} message${t.messages.length > 1 ? 's' : ''}` : ''}
                              </p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TICKET_STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {t.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Social — post approval */}
        {activeTab === 'social' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {socialLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : (
              <>
                {/* Pending approval */}
                {pendingPosts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Pending Your Approval</h3>
                    <p className="text-xs text-gray-500 mb-4">Review and approve these posts before they go live.</p>
                    <div className="flex flex-col gap-3">
                      {pendingPosts.map(post => (
                        <div key={post.id} className="p-4 border border-amber-200 bg-amber-50/50 rounded-xl">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap mb-2">{post.content.slice(0, 300)}{post.content.length > 300 ? '…' : ''}</p>
                          <div className="flex items-center gap-2 mb-3">
                            {post.platforms.map(p => {
                              const colors: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', linkedin: '#0A66C2', google_business: '#4285F4' }
                              const labels: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', google_business: 'Google' }
                              return (
                                <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${colors[p] ?? '#999'}18`, color: colors[p] ?? '#999' }}>
                                  {labels[p] ?? p}
                                </span>
                              )
                            })}
                            {post.scheduledAt && <span className="text-[10px] text-gray-400 ml-auto">{formatDate(post.scheduledAt)}</span>}
                          </div>
                          {rejectingId === post.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection (optional)"
                                rows={2}
                                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => handleRejectPost(post.id)} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">Confirm Reject</button>
                                <button onClick={() => { setRejectingId(null); setRejectReason('') }} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => handleApprovePost(post.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                                <CheckCircle size={12} /> Approve
                              </button>
                              <button onClick={() => setRejectingId(post.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                                <X size={12} /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingPosts.length === 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <CheckCircle size={28} className="text-emerald-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No posts pending approval</p>
                    <p className="text-xs text-gray-400 mt-1">Your team will submit posts here for your review before publishing.</p>
                  </div>
                )}

                {/* Recently published */}
                {publishedPosts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Recently Published</h3>
                    <div className="flex flex-col gap-2">
                      {publishedPosts.map(post => (
                        <div key={post.id} className="p-3 border border-gray-100 rounded-xl">
                          <p className="text-xs text-gray-700 line-clamp-2">{post.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {post.platforms.map(p => {
                              const colors: Record<string, string> = { facebook: '#1877F2', instagram: '#E4405F', linkedin: '#0A66C2', google_business: '#4285F4' }
                              const labels: Record<string, string> = { facebook: 'FB', instagram: 'IG', linkedin: 'LI', google_business: 'G' }
                              return <span key={p} className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: `${colors[p] ?? '#999'}15`, color: colors[p] ?? '#999' }}>{labels[p] ?? p}</span>
                            })}
                            {post.publishedAt && <span className="text-[10px] text-gray-400 ml-auto">{formatDate(post.publishedAt)}</span>}
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Published</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Files */}
        {activeTab === 'files' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Shared Files & Documents</h3>
                <label className={`flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-lg cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploading(true)
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('company', company)
                        const res = await fetch('/api/files', { method: 'POST', body: formData })
                        if (res.ok) {
                          const saved = await res.json()
                          setFiles(prev => [{ name: saved.name, size: saved.size, createdAt: new Date().toISOString(), url: saved.url }, ...prev])
                        }
                      } finally {
                        setUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              </div>
              {files.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {files.map(f => (
                    <div key={f.name} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{f.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`}
                          {f.createdAt ? ` · ${new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </p>
                      </div>
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                          <Download size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">No files shared yet. Upload documents using the button above.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
