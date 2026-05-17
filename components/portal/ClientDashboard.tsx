'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, projectStatusColors, invoiceStatusColors } from '@/lib/utils'
import {
  Globe, FolderKanban, FileText, MessageSquare, ChevronRight,
  Calendar, Download, Search, BarChart3, Megaphone, Mail,
  Palette, BookOpen, PenTool, HelpCircle, Ticket, Clock,
  CheckCircle, TrendingUp, Plus, Phone, Flag, Target,
  GraduationCap, Lightbulb,
} from 'lucide-react'

interface ServiceConfig {
  enabled: boolean
  frequency: string
  last_updated: string
  strategy: string
}

interface ReportEntry {
  title: string
  date: string
  file_url: string
  type: 'manual' | 'auto'
}

interface PortalConfig {
  show_agreement?: boolean
  show_renewal_info?: boolean
  show_invoices?: boolean
  show_seo?: boolean
  show_reports?: boolean
  visible_services?: string[]
  custom_welcome_message?: string
  seo_strategy?: Record<string, unknown>
  client_logo_url?: string
  client_brand_color?: string
  services_config?: Record<string, ServiceConfig>
  reports?: ReportEntry[]
}

interface CompanyInfo {
  name: string
  contact: string
  email: string
  service: string
  companyId: string | null
  createdAt: string | null
}

interface Contract {
  id: string
  company: string
  status: string
  value: number
  serviceType: string
  billingStructure: string
  startDate: string
  duration: number
  renewalDate: string
}

interface Project {
  id: string
  company: string
  serviceType: string
  status: string
  startDate: string
  launchDate: string
  progress: number
  milestones: Array<{ id: string; name: string; dueDate: string; completed: boolean }>
  assignedTeam: string[]
  overview: string
}

interface Invoice {
  id: string
  company: string
  amount: number
  status: string
  dueDate: string
  issuedDate: string
  serviceType: string
}

interface TicketSummary {
  id: string
  subject: string
  status: string
  priority: string
  createdDate: string
}

interface Activity {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  createdAt: string
}

interface DashboardData {
  portalConfig: PortalConfig
  services: string[]
  company: CompanyInfo | null
  contracts: Contract[]
  projects: Project[]
  invoices: Invoice[]
  tickets: TicketSummary[]
  recentActivity: Activity[]
}

const SERVICE_ICONS: Record<string, typeof Globe> = {
  'SEO': Search,
  'PPC': Target,
  'Web Design': Globe,
  'Social Media': Megaphone,
  'Email Marketing': Mail,
  'Content Creation': PenTool,
  'Sales Training': GraduationCap,
  'Marketing Strategy': Lightbulb,
  'Content Marketing': PenTool,
  'Branding': Palette,
  'Consulting': BookOpen,
}

const SERVICE_COLORS: Record<string, string> = {
  'SEO': '#015035',
  'PPC': '#2563eb',
  'Web Design': '#7c3aed',
  'Social Media': '#ec4899',
  'Email Marketing': '#0891b2',
  'Content Creation': '#ea580c',
  'Sales Training': '#be123c',
  'Marketing Strategy': '#4f46e5',
  'Content Marketing': '#ea580c',
  'Branding': '#be123c',
  'Consulting': '#4f46e5',
}

const SERVICE_LINKS: Record<string, string> = {
  'SEO': '/portal/seo',
  'PPC': '/portal/ppc',
  'Web Design': '/portal/web-design',
  'Social Media': '/portal/social-media',
  'Email Marketing': '/portal/email-marketing',
  'Content Creation': '/portal/content-creation',
  'Sales Training': '/portal/sales-training',
  'Marketing Strategy': '/portal/marketing-strategy',
}

function clientSinceDuration(dateStr: string | null): string {
  if (!dateStr) return ''
  const start = new Date(dateStr)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (years > 0 && remainingMonths > 0) return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`
  if (remainingMonths > 0) return `${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
  return 'Less than a month'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: DashboardData | null) => setData(d))
      .catch(() => toast('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (!data || !data.company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <Globe size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Dashboard unavailable</p>
          <p className="text-xs text-gray-400 mt-1">Please contact your account manager.</p>
        </div>
      </div>
    )
  }

  const config = data.portalConfig
  const companyInfo = data.company
  const servicesFromConfig = config.services_config
    ? Object.entries(config.services_config).filter(([, v]) => v.enabled).map(([k]) => k)
    : null
  const services = servicesFromConfig ?? config.visible_services ?? data.services ?? []
  const activeContract = data.contracts.find(c => ['Active', 'Signed by Client', 'Fully Executed'].includes(c.status)) ?? data.contracts[0]
  const activeProjects = data.projects.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled')
  const hasProjects = data.projects.length > 0
  const upcomingMilestones = data.projects
    .flatMap(p => p.milestones.filter(m => !m.completed).map(m => ({ ...m, projectName: p.serviceType })))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3)

  const welcomeName = user?.name?.split(' ')[0] ?? companyInfo.contact?.split(' ')[0] ?? 'there'
  const welcomeMessage = config.custom_welcome_message
    ? config.custom_welcome_message.replace('[name]', welcomeName)
    : `Welcome back, ${welcomeName}!`

  const clientLogo = config.client_logo_url
  const clientBrandColor = config.client_brand_color

  const navItems = [
    { href: '/portal', label: 'Dashboard', icon: Globe, visible: true },
    { href: '/portal/projects', label: 'Projects', icon: FolderKanban, visible: hasProjects },
    { href: '/portal/seo', label: 'SEO Strategy', icon: Search, visible: config.show_seo === true },
    { href: '/portal/reports', label: 'Reports', icon: BarChart3, visible: config.show_reports !== false },
    { href: '/portal/billing', label: 'Invoices', icon: FileText, visible: config.show_invoices !== false },
    { href: '/portal/agreement', label: 'Agreement', icon: FileText, visible: config.show_agreement === true },
    { href: '/portal/tickets', label: 'Tickets', icon: Ticket, visible: true },
    { href: '/portal/help', label: 'Help Center', icon: HelpCircle, visible: true },
  ]

  const startMs = activeContract?.startDate ? new Date(activeContract.startDate + 'T12:00:00').getTime() : 0
  const endMs = activeContract?.renewalDate ? new Date(activeContract.renewalDate + 'T12:00:00').getTime() : 0
  const totalDays = endMs > startMs ? Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) : 0
  const daysRemaining = endMs > nowMs ? Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)) : 0
  const agreementPct = totalDays > 0 ? Math.min(100, Math.max(0, ((totalDays - daysRemaining) / totalDays) * 100)) : 0

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', ...(clientBrandColor ? { '--portal-accent': clientBrandColor } as React.CSSProperties : {}) }}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {clientLogo ? (
                <div className="flex items-center gap-3">
                  <img src={clientLogo} alt={companyInfo.name} className="h-10 w-auto max-w-[120px] object-contain" />
                  <span className="text-xs text-gray-300 font-medium select-none">&times;</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#015035' }}>
                      G
                    </div>
                    <span className="text-[11px] font-semibold text-gray-400">Graviss Marketing</span>
                  </div>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white" style={{ background: '#015035' }}>
                  {companyInfo.name[0]}
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {companyInfo.name}
                </h1>
                <div className="flex items-center gap-3 mt-0.5">
                  {companyInfo.createdAt && (
                    <span className="text-xs text-gray-500">
                      Client since {new Date(companyInfo.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      {' '}&middot;{' '}{clientSinceDuration(companyInfo.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200 bg-white overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex gap-1">
          {navItems.filter(n => n.visible).map(item => {
            const Icon = item.icon
            const isActive = item.href === '/portal'
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={isActive ? { borderColor: clientBrandColor || '#015035' } : {}}
              >
                <Icon size={13} /> {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
        {/* Welcome */}
        <div>
          <h2 className="text-lg font-bold text-gray-900">{welcomeMessage}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Here is an overview of your account with Graviss Marketing.</p>
        </div>

        {/* Agreement Status Card */}
        {config.show_agreement && activeContract && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e6f0ec' }}>
                  <FileText size={14} style={{ color: '#015035' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Active Agreement</h3>
                  <p className="text-[11px] text-gray-400">{activeContract.serviceType}</p>
                </div>
              </div>
              <Link
                href="/portal/agreement"
                className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: '#015035' }}
              >
                View Agreement <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Start Date</p>
                <p className="text-xs font-semibold text-gray-800">{activeContract.startDate ? formatDate(activeContract.startDate) : '---'}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">End Date</p>
                <p className="text-xs font-semibold text-gray-800">{activeContract.renewalDate ? formatDate(activeContract.renewalDate) : '---'}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Billing</p>
                <p className="text-xs font-semibold text-gray-800">{activeContract.billingStructure}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Days Remaining</p>
                <p className="text-xs font-bold" style={{ color: '#015035' }}>{daysRemaining}</p>
              </div>
            </div>
            {totalDays > 0 && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-400">Term Progress</span>
                  <span className="font-semibold" style={{ color: '#015035' }}>{Math.round(agreementPct)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${agreementPct}%`, background: '#015035' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Services */}
        {services.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3">Active Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(svc => {
                const Icon = SERVICE_ICONS[svc] ?? Globe
                const color = SERVICE_COLORS[svc] ?? '#015035'
                const project = activeProjects.find(p => p.serviceType === svc)
                const serviceLink = SERVICE_LINKS[svc] ?? '/portal/projects'
                return (
                  <div key={svc} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
                          <Icon size={16} style={{ color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{svc}</p>
                          {project && (
                            <StatusBadge
                              label={project.status}
                              colorClass={projectStatusColors[project.status] ?? 'bg-gray-100 text-gray-600'}
                            />
                          )}
                          {!project && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {project && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-bold" style={{ color }}>{project.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${project.progress}%`, background: color }} />
                        </div>
                      </div>
                    )}
                    <Link
                      href={serviceLink}
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color }}
                    >
                      View Details <ChevronRight size={11} />
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Activity</h3>
            {data.recentActivity.length > 0 ? (
              <div className="flex flex-col gap-2">
                {data.recentActivity.slice(0, 10).map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#e6f0ec' }}>
                      {a.type === 'project' ? <FolderKanban size={12} style={{ color: '#015035' }} />
                        : a.type === 'billing' ? <FileText size={12} style={{ color: '#015035' }} />
                        : <TrendingUp size={12} style={{ color: '#015035' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 font-medium">{a.title}</p>
                      {a.message && <p className="text-xs text-gray-500 mt-0.5">{a.message}</p>}
                      <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                    </div>
                    {a.link && (
                      <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
                        <ChevronRight size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <TrendingUp size={20} className="mx-auto mb-2 text-gray-300" />
                <p className="text-xs">No recent activity yet. Updates will appear here.</p>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-5">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <Link
                  href="/portal/tickets"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={14} style={{ color: '#015035' }} /> Submit Ticket
                </Link>
                {config.show_invoices !== false && (
                  <Link
                    href="/portal/billing"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download size={14} style={{ color: '#015035' }} /> Download Invoice
                  </Link>
                )}
                <Link
                  href="/portal/help"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <HelpCircle size={14} style={{ color: '#015035' }} /> Help Center
                </Link>
                <a
                  href="mailto:hello@gravissmarketing.com"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Phone size={14} style={{ color: '#015035' }} /> Contact Us
                </a>
              </div>
            </div>

            {/* Upcoming Milestones */}
            {upcomingMilestones.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Upcoming Milestones</h3>
                <div className="flex flex-col gap-2">
                  {upcomingMilestones.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <Flag size={10} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{m.name}</p>
                        <p className="text-[11px] text-gray-400">{m.projectName} &middot; {formatDate(m.dueDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Tickets Summary */}
            {data.tickets.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Open Tickets</h3>
                  <Link href="/portal/tickets" className="text-xs font-medium hover:opacity-80" style={{ color: '#015035' }}>
                    View All
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {data.tickets.filter(t => t.status !== 'Closed' && t.status !== 'Resolved').slice(0, 3).map(t => (
                    <Link
                      key={t.id}
                      href="/portal/tickets"
                      className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <MessageSquare size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 font-medium truncate flex-1">{t.subject}</span>
                      <StatusBadge
                        label={t.status}
                        colorClass={
                          t.status === 'Open' ? 'bg-blue-100 text-blue-700'
                            : t.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }
                      />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
