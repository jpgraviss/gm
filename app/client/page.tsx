'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useClientCompany, previewFetch } from '@/lib/useClientCompany'
import { formatCurrency, projectStatusColors, invoiceStatusColors, formatDate } from '@/lib/utils'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import type { Invoice } from '@/lib/types'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  Globe, CheckCircle, FolderKanban, FileText, MessageSquare,
  Download, Upload, ChevronRight, X, AlertTriangle,
  Search, BarChart3, Star, Activity, TrendingUp, Share2, Calendar,
} from 'lucide-react'

// AUDIT.md #199 — matches the shape app/tickets/page.tsx's staff viewer
// actually reads (`author`/`body`/`timestamp`, not `from`/`sender`/`text`).
// This was previously written as `{from, body, date}`, which crashed the
// staff ticket viewer (`msg.author.split(' ')`) on any real client-created
// ticket that included an initial message.
// Part D (Batch 4) — parity with app/portal/tickets/page.tsx's file
// attachments, uploaded through the same portal-scoped /api/files POST the
// Files tab above already uses.
interface ClientFileAttachment {
  name: string
  url: string
  path: string
  type: string
  size: number
}

interface ClientTicketMessage {
  id: string
  author: string
  isInternal: boolean
  body: string
  timestamp: string
  attachments?: ClientFileAttachment[]
}

interface ClientTicket {
  id: string
  subject: string
  status: string
  priority: string
  createdDate: string
  messages: ClientTicketMessage[]
}

// AUDIT.md #483 — this used to omit 'Urgent', which the audit flagged as
// likely an accidental workaround for the ticket API rejecting it (both
// routes validated priority against TASK_PRIORITIES, which never included
// Urgent). Now that lib/validation.ts has a dedicated TICKET_PRIORITIES
// enum that does include it, portal clients get the same options staff do.
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const

const TICKET_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
  Closed: 'bg-gray-100 text-gray-500',
}

const TICKET_PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-600',
  Medium: 'bg-blue-50 text-blue-700',
  High: 'bg-orange-50 text-orange-700',
  Urgent: 'bg-red-50 text-red-700',
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

// AUDIT.md #185 — app/admin/portal-management/page.tsx's per-service
// "Strategy Scheduling" panel writes services_config[key].frequency/
// .last_updated/.strategy for every service the client has enabled, but
// nothing client-facing ever read it (verified: the panel is genuinely
// service-agnostic — it renders identically for SEO, PPC, Web Design,
// Social Media, Email Marketing, Content Creation, Sales Training, and
// Marketing Strategy — so it doesn't belong solely on the new SEO Strategy
// page). Surfaced read-only below, in the one tab a client already sees
// cross-service company data. Also folds in the admin panel's "Client
// Reports" (manually-uploaded report files) per Part B of this batch — the
// former app/portal/reports/page.tsx's other content (a client-side
// synthesized "{service} Progress Report" list with no real file behind
// it) was materially redundant with the Project tab and wasn't ported.
interface PortalReportEntry {
  title: string
  date: string
  file_url: string
}

interface ServiceStrategyConfig {
  enabled?: boolean
  frequency: string
  last_updated: string
  strategy: string
}

const STRATEGY_FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannually: 'Semiannually',
  annually: 'Annually',
}

// Mirrors app/admin/portal-management/page.tsx's getNextUpdateDate() so the
// "Overdue" / next-due computation the client sees matches what staff see.
function getNextStrategyUpdateDate(lastUpdated: string, frequency: string): string {
  if (!lastUpdated) return ''
  const d = new Date(lastUpdated + 'T12:00:00')
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'biweekly': d.setDate(d.getDate() + 14); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'semiannually': d.setMonth(d.getMonth() + 6); break
    case 'annually': d.setFullYear(d.getFullYear() + 1); break
    default: d.setMonth(d.getMonth() + 1)
  }
  return d.toISOString().split('T')[0]
}
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'

export default function ClientPortalPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { company, contactName, isPreview } = useClientCompany()

  const [activeTab, setActiveTab] = useState<'overview' | 'project' | 'billing' | 'tickets' | 'files' | 'insights' | 'social'>('overview')
  const [insights, setInsights] = useState<PortalInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  // AUDIT.md #185 / Part B — see the comment on ServiceStrategyConfig above.
  // `null` means "not fetched yet" (distinct from a real empty array), so
  // the effect below only fetches once per Insights-tab visit.
  const [portalReports, setPortalReports] = useState<PortalReportEntry[] | null>(null)
  const [serviceStrategies, setServiceStrategies] = useState<Array<{ key: string; config: ServiceStrategyConfig }> | null>(null)
  const [showWelcome, setShowWelcome] = useState(true)

  // Social posts for approval
  const [pendingPosts, setPendingPosts] = useState<Array<{ id: string; content: string; platforms: string[]; scheduledAt?: string; status: string; approvalStatus: string }>>([])
  const [publishedPosts, setPublishedPosts] = useState<Array<{ id: string; content: string; platforms: string[]; publishedAt?: string; status: string }>>([])
  const [socialLoading, setSocialLoading] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  // AUDIT — /api/projects?company= can return more than one row for a
  // company with concurrent engagements; this used to keep only d[0], so
  // every project but the newest was silently invisible to the client with
  // no list/selector and no error. Now keeps the full list and derives the
  // displayed project from a selection, defaulting to the first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const project = projects.find(p => p.id === selectedProjectId) ?? projects[0] ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null)
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([])
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketPriority, setTicketPriority] = useState<typeof TICKET_PRIORITIES[number]>('Medium')
  const [ticketAttachments, setTicketAttachments] = useState<ClientFileAttachment[]>([])
  const [ticketAttachUploading, setTicketAttachUploading] = useState(false)
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState(false)
  const [existingTickets, setExistingTickets] = useState<ClientTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [replyAttachments, setReplyAttachments] = useState<ClientFileAttachment[]>([])
  const [replyAttachUploading, setReplyAttachUploading] = useState(false)
  const [files, setFiles] = useState<{ name: string; size: number; createdAt: string; url: string | null; path: string }[]>([])
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
      fetch(`/api/projects?company=${q}`).then(r => r.ok ? r.json() : []).then((d: unknown[]) => { if (Array.isArray(d)) setProjects(d) }).catch(() => toast('Failed to load project data', 'error')),
      fetch(`/api/contracts?company=${q}`).then(r => r.ok ? r.json() : []).then((d: unknown[]) => { if (Array.isArray(d)) setContract(d[0] ?? null) }).catch(() => toast('Failed to load contract data', 'error')),
      // AUDIT — /api/invoices is cursor-paginated at 100/page; a raw
      // fetch() silently truncated a long-tenured client's billing view
      // (and the totals computed from it) to only their newest 100
      // invoices, same bug class as #206/#212.
      fetchAllPages<Invoice>(`/api/invoices?company=${q}`).then(d => setClientInvoices(d)).catch(() => toast('Failed to load invoices', 'error')),
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

  // AUDIT.md #185 / Part B — load the admin-configured, per-company/
  // per-service strategy scheduling data + manually-uploaded reports
  // alongside Insights. /api/portal/dashboard is already company-scoped via
  // requirePortalClient, so this can't leak another client's data.
  useEffect(() => {
    if (activeTab !== 'insights' || !company || portalReports !== null) return
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d) => {
        const config = (d?.portalConfig ?? {}) as {
          reports?: PortalReportEntry[]
          services_config?: Record<string, ServiceStrategyConfig>
        }
        const enabledServices: string[] = Array.isArray(d?.services) ? d.services : []
        const svcConfig = config.services_config ?? {}
        setPortalReports(Array.isArray(config.reports) ? config.reports : [])
        setServiceStrategies(
          enabledServices
            .map(key => ({ key, config: svcConfig[key] }))
            .filter((s): s is { key: string; config: ServiceStrategyConfig } =>
              !!s.config && (!!s.config.strategy?.trim() || !!s.config.last_updated))
        )
      })
      .catch(() => {/* non-fatal */})
  }, [activeTab, company, portalReports])

  // Load existing tickets when Support tab opens
  useEffect(() => {
    if (activeTab !== 'tickets' || !company) return
    setTicketsLoading(true)
    // AUDIT — /api/tickets is cursor-paginated at 100/page; a raw fetch()
    // silently truncated a client with a long support history to only
    // their newest 100 tickets, same bug class as #206/#212.
    fetchAllPages<ClientTicket>(`/api/tickets?company=${encodeURIComponent(company)}`)
      .then(data => setExistingTickets(data))
      // AUDIT.md #475 — this used to fail silently with no toast, unlike
      // the initial company-data load's explicit per-source error toasts
      // (see the Promise.all above) — a network error read as "no support
      // tickets" (a genuine empty state) instead of an unknown failure.
      .catch(() => toast('Failed to load support tickets', 'error'))
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
      // AUDIT.md #475 — this used to fail silently with no toast, unlike
      // the initial company-data load's explicit per-source error toasts
      // (see the Promise.all above) — a network error read as "no pending/
      // published posts" (a genuine empty state) instead of an unknown
      // failure.
      .catch(() => toast('Failed to load social posts', 'error'))
      .finally(() => setSocialLoading(false))
  }, [activeTab, company])

  async function handleApprovePost(postId: string) {
    if (isPreview) { toast("You're previewing this client's account — this action is disabled in preview mode.", 'error'); return }
    try {
      const res = await previewFetch(isPreview, `/api/social-posts/${postId}`, {
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
    if (isPreview) { toast("You're previewing this client's account — this action is disabled in preview mode.", 'error'); return }
    try {
      const res = await previewFetch(isPreview, `/api/social-posts/${postId}`, {
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

  // Part D — same /api/files upload the Files tab already uses, portal-
  // scoped via requirePortalClient(company). Shared by both the new-ticket
  // form and the reply box below (parity with app/portal/tickets/page.tsx's
  // handleFileUpload).
  async function uploadTicketAttachment(
    file: File,
    setAttachments: React.Dispatch<React.SetStateAction<ClientFileAttachment[]>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    if (isPreview) { toast("You're previewing this client's account — file uploads are disabled in preview mode.", 'error'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('company', company)
      const res = await fetch('/api/files', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error || 'Failed to upload file', 'error')
        return
      }
      const data = await res.json()
      setAttachments(prev => [...prev, { name: data.name, url: data.url, path: data.path, type: file.type, size: file.size }])
    } catch {
      toast('Failed to upload file', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function sendTicketReply() {
    if (!selectedTicket || (!replyText.trim() && replyAttachments.length === 0)) return
    if (isPreview) { toast("You're previewing this client's account — replying is disabled in preview mode.", 'error'); return }
    setReplySending(true)
    try {
      const newMsg: ClientTicketMessage = {
        id: `m-${Date.now()}`,
        author: contactName,
        isInternal: false,
        body: replyText.trim(),
        timestamp: new Date().toISOString(),
        ...(replyAttachments.length > 0 ? { attachments: replyAttachments } : {}),
      }
      const updatedMessages = [...selectedTicket.messages, newMsg]
      const res = await previewFetch(isPreview, `/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      if (!res.ok) throw new Error()
      setExistingTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: updatedMessages } : t))
      setReplyText('')
      setReplyAttachments([])
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
    if (isPreview) { toast("You're previewing this client's account — payment is disabled in preview mode.", 'error'); return }
    setPayingInvoiceId(invoiceId)
    try {
      const res = await previewFetch(isPreview, `/api/invoices/${invoiceId}/checkout`, { method: 'POST' })
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

  // Excludes Cancelled the same way the staff Billing page's own
  // "Copy Payment Link" affordance already does — a cancelled invoice isn't
  // payable, but without this it counted toward the "$X outstanding —
  // payment due" banner and got a live "Pay Now" button below.
  const openInvoices = clientInvoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled')
  const paidInvoices = clientInvoices.filter(i => i.status === 'Paid')

  if (loading) return <LoadingScreen />

  return (
    <>
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
            {projects.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${p.id === project?.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    style={p.id === project?.id ? { background: '#015035', borderColor: '#015035' } : undefined}
                  >
                    {p.serviceType}
                  </button>
                ))}
              </div>
            )}
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
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <InsightMetric label="Sites" value={insights.uptime.sitesMonitored.toString()} />
                      <InsightMetric label="Uptime (30d)" value={`${insights.uptime.uptimePercent}%`} />
                      <InsightMetric label="Incidents" value={insights.uptime.incidents.toString()} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* AUDIT.md #185 / Part B — reports folded in from the retired
                app/portal/reports/page.tsx (manual uploads only — its other
                content was a client-side-synthesized, file-less "progress
                report" list redundant with the Project tab, not ported),
                plus the admin panel's per-service Strategy Scheduling data
                (#185), both read-only for the client. */}
            {portalReports && portalReports.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-emerald-700" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Reports</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {portalReports.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.date ? new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </p>
                      </div>
                      {r.file_url && (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0"
                          style={{ background: '#015035' }}
                        >
                          <Download size={12} /> Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {serviceStrategies && serviceStrategies.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-emerald-700" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Strategy & Scheduling</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {serviceStrategies.map(({ key, config }) => {
                    const nextUpdate = config.last_updated ? getNextStrategyUpdateDate(config.last_updated, config.frequency) : ''
                    const isOverdue = !!nextUpdate && new Date(nextUpdate + 'T12:00:00') < new Date()
                    return (
                      <div key={key} className="border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          <span className="text-sm font-bold text-gray-800">{key}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            {STRATEGY_FREQUENCY_LABELS[config.frequency] ?? config.frequency}
                          </span>
                          {isOverdue && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Overdue</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2.5 text-xs">
                          <div>
                            <span className="text-gray-400">Last Updated </span>
                            <span className="font-medium text-gray-700">{config.last_updated || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Next Due </span>
                            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>{nextUpdate || 'N/A'}</span>
                          </div>
                        </div>
                        {config.strategy && (
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{config.strategy}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
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
                        {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
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
                    onClick={() => { setSelectedTicketId(null); setReplyText(''); setReplyAttachments([]) }}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium flex-shrink-0"
                  >
                    ← Back
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedTicket.subject}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TICKET_PRIORITY_COLORS[selectedTicket.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {selectedTicket.priority}
                  </span>
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
                          {m.attachments && m.attachments.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/10">
                              {m.attachments.map((att, j) => (
                                <a
                                  key={j}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 w-fit ${fromUs ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-white/10 text-white/90 hover:bg-white/20'} transition-colors`}
                                >
                                  <Download size={10} />
                                  <span className="truncate max-w-[180px]">{att.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
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
                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {replyAttachments.map((att, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-lg px-2 py-1">
                          <FileText size={10} />
                          <span className="truncate max-w-[120px]">{att.name}</span>
                          <button onClick={() => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 text-gray-400 hover:text-gray-600">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className={`flex items-center gap-1.5 text-xs text-[#015035] cursor-pointer hover:underline ${replyAttachUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Upload size={12} /> {replyAttachUploading ? 'Uploading…' : 'Attach file'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={replyAttachUploading}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) uploadTicketAttachment(file, setReplyAttachments, setReplyAttachUploading)
                        }}
                      />
                    </label>
                    <button
                      disabled={replySending || (!replyText.trim() && replyAttachments.length === 0)}
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
                      <button onClick={() => { setTicketSuccess(false); setTicketSubject(''); setTicketMessage(''); setTicketPriority('Medium'); setTicketAttachments([]) }} className="mt-3 text-xs text-emerald-700 underline">Submit another</button>
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
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-600">Priority</label>
                        <select
                          value={ticketPriority}
                          onChange={e => setTicketPriority(e.target.value as typeof TICKET_PRIORITIES[number])}
                          className="w-full sm:w-48 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={`flex items-center gap-1.5 text-xs text-[#015035] cursor-pointer hover:underline ${ticketAttachUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          <Upload size={12} /> {ticketAttachUploading ? 'Uploading…' : 'Attach file'}
                          <input
                            type="file"
                            className="hidden"
                            disabled={ticketAttachUploading}
                            onChange={e => {
                              const file = e.target.files?.[0]
                              e.target.value = ''
                              if (file) uploadTicketAttachment(file, setTicketAttachments, setTicketAttachUploading)
                            }}
                          />
                        </label>
                        {ticketAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {ticketAttachments.map((att, i) => (
                              <span key={i} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-lg px-2 py-1">
                                <FileText size={10} />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                                <button onClick={() => setTicketAttachments(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 text-gray-400 hover:text-gray-600">
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          disabled={ticketSubmitting || !ticketSubject.trim()}
                          onClick={async () => {
                            if (isPreview) { toast("You're previewing this client's account — submitting a ticket is disabled in preview mode.", 'error'); return }
                            setTicketSubmitting(true)
                            try {
                              const res = await previewFetch(isPreview, '/api/tickets', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  subject: ticketSubject.trim(),
                                  priority: ticketPriority,
                                  company,
                                  contactName,
                                  contactEmail: user?.email ?? '',
                                  source: 'Portal',
                                  messages: (ticketMessage.trim() || ticketAttachments.length > 0) ? [{
                                    id: `m-${Date.now()}`,
                                    author: contactName,
                                    isInternal: false,
                                    body: ticketMessage.trim(),
                                    timestamp: new Date().toISOString(),
                                    ...(ticketAttachments.length > 0 ? { attachments: ticketAttachments } : {}),
                                  }] : [],
                                }),
                              })
                              // AUDIT #282 — this only handled the success
                              // branch; a failed submission just stopped
                              // the spinner with zero indication anything
                              // went wrong.
                              if (res.ok) {
                                setTicketSuccess(true)
                                setTicketPriority('Medium')
                                setTicketAttachments([])
                                fetchAllPages<ClientTicket>(`/api/tickets?company=${encodeURIComponent(company)}`)
                                  .then(data => setExistingTickets(data))
                                  .catch(() => {})
                              } else {
                                toast('Failed to submit your request. Please try again.', 'error')
                              }
                            } catch {
                              toast('Failed to submit your request. Please try again.', 'error')
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
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TICKET_PRIORITY_COLORS[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                              {t.priority}
                            </span>
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
                      if (isPreview) { toast("You're previewing this client's account — file uploads are disabled in preview mode.", 'error'); return }
                      setUploading(true)
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('company', company)
                        const res = await fetch('/api/files', { method: 'POST', body: formData })
                        // AUDIT #283 — this only handled the success
                        // branch; a rejected upload (415 wrong MIME type,
                        // 413 too large) just reverted the "Uploading…"
                        // label with zero explanation.
                        if (res.ok) {
                          const saved = await res.json()
                          setFiles(prev => [{ name: saved.name, size: saved.size, createdAt: new Date().toISOString(), url: saved.url, path: saved.path }, ...prev])
                        } else {
                          const err = await res.json().catch(() => ({}))
                          toast(err.error || 'Failed to upload file', 'error')
                        }
                      } catch {
                        toast('Failed to upload file', 'error')
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
                    <div key={f.path} className="flex items-center gap-3 px-5 py-3.5">
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
    </>
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
