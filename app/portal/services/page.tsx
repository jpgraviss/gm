'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  ArrowLeft, Search, Target, Globe, Megaphone, Mail,
  PenTool, GraduationCap, Lightbulb, ChevronRight,
} from 'lucide-react'

interface ServiceConfig {
  enabled: boolean
  frequency: string
  last_updated: string
  strategy: string
}

interface PortalData {
  portalConfig: {
    visible_services?: string[]
    services_config?: Record<string, ServiceConfig>
  }
  services: string[]
  projects: Array<{
    serviceType: string
    status: string
    progress: number
  }>
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

const SERVICE_COLORS: Record<string, string> = {
  'SEO': '#015035',
  'PPC': '#2563eb',
  'Web Design': '#7c3aed',
  'Social Media': '#ec4899',
  'Email Marketing': '#0891b2',
  'Content Creation': '#ea580c',
  'Sales Training': '#be123c',
  'Marketing Strategy': '#4f46e5',
}

const SERVICE_SLUGS: Record<string, string> = {
  'SEO': 'seo',
  'PPC': 'ppc',
  'Web Design': 'web-design',
  'Social Media': 'social-media',
  'Email Marketing': 'email-marketing',
  'Content Creation': 'content-creation',
  'Sales Training': 'sales-training',
  'Marketing Strategy': 'marketing-strategy',
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  'SEO': 'Search engine optimization, keyword rankings, and organic traffic growth',
  'PPC': 'Pay-per-click advertising, campaign management, and conversion tracking',
  'Web Design': 'Website design, development, and project milestones',
  'Social Media': 'Social media management, content scheduling, and engagement',
  'Email Marketing': 'Email campaigns, subscriber management, and performance analytics',
  'Content Creation': 'Blog posts, articles, and content calendar management',
  'Sales Training': 'Sales courses, certifications, and team development',
  'Marketing Strategy': 'Strategic planning, quarterly goals, and KPI tracking',
}

export default function ServicesHubPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => toast('Failed to load services', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) return <LoadingScreen />

  const config = data?.portalConfig
  const servicesFromConfig = config?.services_config
    ? Object.entries(config.services_config).filter(([, v]) => v.enabled).map(([k]) => k)
    : null
  const services = servicesFromConfig ?? config?.visible_services ?? data?.services ?? []
  const projects = data?.projects ?? []

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Active Services</h1>
        <p className="text-xs text-gray-500 mt-0.5">View details and performance metrics for each service</p>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        {services.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Globe size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No active services</p>
            <p className="text-xs text-gray-400 mt-1">Contact your account manager to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(svc => {
              const Icon = SERVICE_ICONS[svc] ?? Globe
              const color = SERVICE_COLORS[svc] ?? '#015035'
              const slug = SERVICE_SLUGS[svc]
              const description = SERVICE_DESCRIPTIONS[svc] ?? ''
              const project = projects.find(p => p.serviceType === svc)

              return (
                <div key={svc} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition-colors flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{svc}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 flex-1">{description}</p>
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
                  {slug ? (
                    <Link
                      href={`/portal/services/${slug}`}
                      className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color }}
                    >
                      View Details <ChevronRight size={11} />
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">Details coming soon</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
