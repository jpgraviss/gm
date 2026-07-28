'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useClientCompany } from '@/lib/useClientCompany'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  Search, Target, Globe, Megaphone, Mail,
  PenTool, GraduationCap, Lightbulb, ChevronRight,
} from 'lucide-react'

// Ported from app/portal/services/page.tsx as part of the /portal -> /client
// merge (Batch 4). Chrome (company identity header, notifications,
// sign-out, cross-route nav) comes from app/client/layout.tsx instead of
// being reimplemented here.
//
// Gating (Part B, explicit product decision): this hub only ever lists a
// service if it's in THIS client's own contracted `services` — same real
// per-company source (`portal_clients.services` text[] via
// GET /api/portal/dashboard, company-scoped by requirePortalClient) the
// original portal hub already used. There's no "show everything to
// everyone" mode here.
//
// Real vs. dead vs. leak-risk (Part A audit, done directly against the live
// files, not inherited blindly from prior research):
//   - SEO           — real. Already ported to its own top-level route in
//                      Batch 3 (app/client/seo/page.tsx). This hub links
//                      straight there instead of duplicating the page.
//   - Web Design    — real (GET /api/portal/dashboard project data).
//   - Social Media  — real (GET /api/social-posts?company=, portal-scoped).
//   - Sales Training— real (GET /api/courses + per-course enrollments).
//   - PPC, Content Creation, Marketing Strategy — DEAD. All three read
//     `strategy.ppc` / `strategy.content` / `strategy.marketing_strategy`
//     from GET /api/portal/seo, but that route's response only ever
//     contains `{ strategy: { overview? }, showSeo }` — built solely from
//     the legacy `portal_config.seoStrategy` string. There is no code path
//     that ever populates ppc/content/marketing_strategy keys, so these
//     pages structurally always render their empty state regardless of
//     admin input. Confirmed by reading the API route, not just the pages.
//   - Email Marketing — NOT dead, but a real cross-tenant leak risk: the
//     legacy page calls GET /api/broadcasts?limit=50 with no company
//     filter, and `broadcasts` (app/api/broadcasts/route.ts) has no
//     company column to scope by at all — it's an org-wide table. Today
//     that route is requireRole-gated staff-only, so a portal client just
//     401s. Porting it with a swap to portal auth would let every client
//     see every other company's campaign stats. Decision: do not port.
//     GET /api/broadcasts is never called from any file under app/client.
//
// SERVICE_SLUGS only has entries for the services that got a real detail
// page. Anything else (PPC, Email Marketing, Content Creation, Marketing
// Strategy) falls through to the pre-existing "Details coming soon"
// treatment below rather than a broken or leaky link — no separate case
// needed since that fallback already existed in the ported hub UI.

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

// Only the services with a real, working destination. SEO links to its
// existing top-level route (app/client/seo); Web Design, Social Media, and
// Sales Training link into the dynamic per-service route added this batch.
const SERVICE_HREFS: Record<string, string> = {
  'SEO': '/client/seo',
  'Web Design': '/client/services/web-design',
  'Social Media': '/client/services/social-media',
  'Sales Training': '/client/services/sales-training',
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

export default function ClientServicesHubPage() {
  const { toast } = useToast()
  const { company, isPreview } = useClientCompany()
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
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
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
              // AUDIT #528 — useClientCompany() only detects preview via
              // ?company= in the URL; a static href with no query string
              // silently exits preview mode the moment it's clicked.
              const baseHref = SERVICE_HREFS[svc]
              const href = baseHref && isPreview ? `${baseHref}?company=${encodeURIComponent(company)}` : baseHref
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
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color }}
                    >
                      View Details <ChevronRight size={11} />
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400">Details coming soon — contact your account manager</span>
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
