'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  Globe, FileText, Download, ChevronRight, Search, BarChart3,
  Megaphone, Mail, PenTool, HelpCircle, Ticket, FolderKanban,
  Clock, ArrowLeft, Target, GraduationCap, Lightbulb,
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
  show_invoices?: boolean
  show_seo?: boolean
  show_reports?: boolean
  visible_services?: string[]
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

interface Project {
  id: string
  serviceType: string
  status: string
  progress: number
}

interface DashboardData {
  portalConfig: PortalConfig
  services: string[]
  company: CompanyInfo | null
  projects: Project[]
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
}

export default function ReportsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { setLoading(false); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: DashboardData | null) => setData(d))
      .catch(() => toast('Failed to load reports', 'error'))
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
          <FileText size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Reports unavailable</p>
        </div>
      </div>
    )
  }

  const config = data.portalConfig
  const companyInfo = data.company
  const clientLogo = config.client_logo_url
  const clientBrandColor = config.client_brand_color
  const manualReports: ReportEntry[] = config.reports ?? []
  const hasProjects = data.projects.length > 0

  const autoReports: ReportEntry[] = data.projects
    .filter(p => p.status !== 'Cancelled')
    .map(p => ({
      title: `${p.serviceType} Progress Report`,
      date: new Date().toISOString().split('T')[0],
      file_url: '',
      type: 'auto' as const,
    }))

  const allReports = [
    ...manualReports.map(r => ({ ...r, type: 'manual' as const })),
    ...autoReports,
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const navItems = [
    { href: '/portal', label: 'Dashboard', icon: Globe, visible: true },
    { href: '/portal/projects', label: 'Projects', icon: FolderKanban, visible: hasProjects },
    { href: '/portal/seo', label: 'SEO Strategy', icon: Search, visible: config.show_seo === true },
    { href: '/portal/reports', label: 'Reports', icon: BarChart3, visible: true },
    { href: '/portal/billing', label: 'Invoices', icon: FileText, visible: config.show_invoices !== false },
    { href: '/portal/tickets', label: 'Tickets', icon: Ticket, visible: true },
    { href: '/portal/help', label: 'Help Center', icon: HelpCircle, visible: true },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
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
            const isActive = item.href === '/portal/reports'
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reports</h2>
            <p className="text-sm text-gray-500 mt-0.5">View your auto-generated and uploaded reports.</p>
          </div>
          <Link
            href="/portal"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={12} /> Back to Dashboard
          </Link>
        </div>

        {allReports.length > 0 ? (
          <div className="flex flex-col gap-3">
            {allReports.map((report, idx) => {
              const Icon = report.type === 'auto'
                ? (SERVICE_ICONS[report.title.replace(' Progress Report', '')] ?? BarChart3)
                : FileText
              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4 hover:border-gray-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e6f0ec' }}>
                    <Icon size={16} style={{ color: clientBrandColor || '#015035' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{report.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(report.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        report.type === 'auto'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {report.type === 'auto' ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                  </div>
                  {report.type === 'manual' && report.file_url && (
                    <a
                      href={report.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: clientBrandColor || '#015035' }}
                    >
                      <Download size={12} /> Download
                    </a>
                  )}
                  {report.type === 'auto' && (
                    <Link
                      href="/portal/projects"
                      className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: clientBrandColor || '#015035' }}
                    >
                      View Details <ChevronRight size={11} />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center">
            <FileText size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No reports available yet</p>
            <p className="text-xs text-gray-400 mt-1">Reports will appear here as they are generated or uploaded.</p>
          </div>
        )}
      </div>
    </div>
  )
}
