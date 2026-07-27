'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useClientCompany } from '@/lib/useClientCompany'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  ArrowLeft, Globe, Calendar, CheckCircle, Circle, FolderKanban, Clock,
  Megaphone, GraduationCap, BookOpen, Play,
} from 'lucide-react'

// Real per-service detail pages ported from app/portal/services/* as part
// of the /portal -> /client merge (Batch 4). Chrome (header, cross-route
// nav) comes from app/client/layout.tsx; this route only renders the
// page-specific body, matching the pattern from Batch 3's
// app/client/seo/page.tsx and app/client/workflow/page.tsx.
//
// Only three slugs have real content — see the audit notes in
// app/client/services/page.tsx for why SEO redirects elsewhere and why
// ppc / email-marketing / content-creation / marketing-strategy are
// intentionally NOT handled here (dead data or a cross-tenant leak risk).
// Any other slug — known-dead, the leak-risk one, or just unrecognized —
// falls through to the same graceful "not available" state below instead
// of crashing or fetching anything. In particular, this file never calls
// GET /api/broadcasts.

const REAL_SERVICE_NAMES: Record<string, string> = {
  'web-design': 'Web Design',
  'social-media': 'Social Media',
  'sales-training': 'Sales Training',
}

function NotAvailable({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Globe size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-xs text-gray-400 mt-1">{message}</p>
          <Link href="/client/services" className="inline-flex items-center gap-1.5 text-xs font-semibold mt-4 hover:opacity-80" style={{ color: '#015035' }}>
            <ArrowLeft size={12} /> Back to Services
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ClientServiceDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug ?? ''
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const { company } = useClientCompany()

  const serviceName = REAL_SERVICE_NAMES[slug]

  // SEO already has a dedicated, fuller top-level route from Batch 3 —
  // redirect there instead of duplicating it.
  useEffect(() => {
    if (slug === 'seo') router.replace('/client/seo')
  }, [slug, router])

  // Entitlement check — same real per-company source and precedence as the
  // hub (app/client/services/page.tsx), so a client can't reach a service
  // detail page (even one with a real slug) unless it's actually in their
  // contracted services.
  const [entitled, setEntitled] = useState<string[] | null>(null)
  useEffect(() => {
    if (!serviceName || !company) { requestAnimationFrame(() => setEntitled([])); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const config = d?.portalConfig as { visible_services?: string[]; services_config?: Record<string, { enabled: boolean }> } | undefined
        const fromConfig = config?.services_config
          ? Object.entries(config.services_config).filter(([, v]) => v.enabled).map(([k]) => k)
          : null
        setEntitled(fromConfig ?? config?.visible_services ?? d?.services ?? [])
      })
      .catch(() => { toast('Failed to load service data', 'error'); setEntitled([]) })
  }, [serviceName, company, toast])

  if (slug === 'seo') return <LoadingScreen />

  if (!serviceName) {
    return (
      <NotAvailable
        title="Details coming soon"
        message="This service isn't available in the client portal yet. Contact your account manager for details."
      />
    )
  }

  if (entitled === null) return <LoadingScreen />

  if (!entitled.includes(serviceName)) {
    return (
      <NotAvailable
        title="Not part of your plan"
        message="This service isn't included in your current contract. Contact your account manager to add it."
      />
    )
  }

  if (slug === 'web-design') return <WebDesignService company={company} />
  if (slug === 'social-media') return <SocialMediaService company={company} />
  if (slug === 'sales-training') return <SalesTrainingService company={company} userEmail={user?.email} />

  return (
    <NotAvailable
      title="Details coming soon"
      message="This service isn't available in the client portal yet. Contact your account manager for details."
    />
  )
}

// ─── Web Design ─────────────────────────────────────────────────────────
// Ported from app/portal/services/web-design/page.tsx. Real data: finds the
// client's own Web Design project from GET /api/portal/dashboard (already
// company-scoped via requirePortalClient).

interface Milestone {
  id: string
  name: string
  dueDate: string
  completed: boolean
}

interface WebDesignProject {
  id: string
  serviceType: string
  status: string
  startDate: string
  launchDate: string
  progress: number
  milestones: Milestone[]
  overview: string
}

function WebDesignService({ company }: { company: string }) {
  const { toast } = useToast()
  const [project, setProject] = useState<WebDesignProject | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const projects: WebDesignProject[] = d?.projects ?? []
        setProject(projects.find(p => p.serviceType === 'Web Design') ?? null)
      })
      .catch(() => toast('Failed to load project data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) return <LoadingScreen />

  const milestones = project?.milestones ?? []
  const completedMilestones = milestones.filter(m => m.completed).length
  const totalMilestones = milestones.length

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Web Design</h1>
            <p className="text-xs text-gray-500 mt-0.5">Project progress and milestones</p>
          </div>
          {project && (
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
              project.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
              project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {project.status}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        {!project ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Globe size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No active web design project</p>
            <p className="text-xs text-gray-400 mt-1">Contact your account manager to get started.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#7c3aed12' }}>
                    <FolderKanban size={14} style={{ color: '#7c3aed' }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{project.progress}%</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Overall Progress</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#01503512' }}>
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{completedMilestones}/{totalMilestones}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Milestones</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb12' }}>
                    <Calendar size={14} style={{ color: '#2563eb' }} />
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {project.startDate ? new Date(project.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Start Date</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ea580c12' }}>
                    <Clock size={14} style={{ color: '#ea580c' }} />
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {project.launchDate ? new Date(project.launchDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Launch Date</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Project Progress</h3>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className="h-3 rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#7c3aed' }} />
              </div>
              <p className="text-xs text-gray-500">{project.progress}% complete</p>
            </div>

            {project.overview && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Project Overview</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{project.overview}</p>
              </div>
            )}

            {milestones.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-800">Milestones</h3>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#7c3aed12', color: '#7c3aed' }}>
                    {completedMilestones}/{totalMilestones} Complete
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {milestones.map(m => (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                      {m.completed ? (
                        <CheckCircle size={16} style={{ color: '#015035' }} />
                      ) : (
                        <Circle size={16} className="text-gray-300" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${m.completed ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'}`}>
                          {m.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {m.dueDate ? new Date(m.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Social Media ───────────────────────────────────────────────────────
// Ported from app/portal/services/social-media/page.tsx. Real data:
// GET /api/social-posts?company=&limit=20, which is explicitly
// portal-scoped (requirePortalClient when a company param is present),
// unlike broadcasts — no leak risk here.
//
// AUDIT.md #416 — the `service=Social Media` param opts this call into the
// stricter requireEntitledService check server-side (403s if Social Media
// isn't actually in this company's portal_clients.services), matching the
// entitlement gate this page already enforces in React state above. The
// main /client dashboard's Social tab calls the same route WITHOUT this
// param on purpose — that approve/reject queue isn't entitlement-gated and
// must keep working regardless of this check.

interface SocialPost {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduledDate?: string
  publishedDate?: string
}

interface SocialData {
  posts: SocialPost[]
}

// AUDIT.md #428 — this used to show "Total Engagement"/"Avg. Reach" stat
// tiles and per-post like/comment counts computed from post.likes/comments/
// shares/impressions, fields that don't exist anywhere: mapPost() in
// lib/social-media.ts never returns them and social_posts has no such
// columns. There is no engagement-tracking pipeline in this codebase (no
// per-platform API pulls), so every client saw permanently-zero numbers
// that looked real but weren't. User decision: remove the fake tiles
// rather than build a real tracking pipeline right now.
function SocialMediaService({ company }: { company: string }) {
  const { toast } = useToast()
  const [data, setData] = useState<SocialData>({ posts: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/social-posts?company=${encodeURIComponent(company)}&limit=20&service=${encodeURIComponent('Social Media')}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(result => {
        const posts: SocialPost[] = (result.data ?? result ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          content: (p.content as string ?? '').slice(0, 120),
          platforms: p.platforms as string[] ?? [],
          status: p.status as string ?? 'Draft',
          scheduledDate: p.scheduledDate as string ?? p.scheduled_date as string ?? undefined,
          publishedDate: p.publishedDate as string ?? p.published_date as string ?? undefined,
        }))
        setData({ posts })
      })
      .catch(() => toast('Failed to load social media data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) return <LoadingScreen />

  // Real PostStatus values (lib/social-media.ts) are lowercase.
  const published = data.posts.filter(p => p.status === 'published')
  const scheduled = data.posts.filter(p => p.status === 'scheduled')

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Social Media</h1>
        <p className="text-xs text-gray-500 mt-0.5">Post calendar and content status</p>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Published Posts', value: published.length.toString(), icon: Megaphone, color: '#ec4899' },
            { label: 'Scheduled', value: scheduled.length.toString(), icon: Calendar, color: '#2563eb' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                    <Icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>

        {scheduled.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Upcoming Posts</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {scheduled.map(p => (
                <div key={p.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex gap-1 mt-0.5">
                      {p.platforms.map(pl => (
                        <span key={pl} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">{pl}</span>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{p.content}</p>
                      {p.scheduledDate && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Scheduled for {new Date(p.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Recent Posts</h3>
          </div>
          {published.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {published.slice(0, 10).map(p => (
                <div key={p.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {p.platforms.map(pl => (
                        <span key={pl} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">{pl}</span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 truncate flex-1">{p.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Megaphone size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Published posts will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sales Training ─────────────────────────────────────────────────────
// Ported from app/portal/services/sales-training/page.tsx. Real data:
// fetchAllPages('/api/courses') + per-course GET
// /api/courses/[id]/enrollments, both now genuinely portal-accessible
// (see the AUDIT comments in those routes — they used to 403 every client).

interface CourseModule {
  id: string
  title: string
  type: string
  content: string
}

interface Enrollment {
  id: string
  courseId: string
  progress: Record<string, boolean>
  status: string
}

interface Course {
  id: string
  title: string
  description: string
  status: string
  modules: CourseModule[]
  enrolledCount: number
}

interface TrainingData {
  courses: Course[]
  enrollments: Enrollment[]
  totalCompleted: number
  totalInProgress: number
}

function SalesTrainingService({ company, userEmail }: { company: string; userEmail?: string }) {
  const { toast } = useToast()
  const [data, setData] = useState<TrainingData>({ courses: [], enrollments: [], totalCompleted: 0, totalInProgress: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }

    fetchAllPages<Record<string, unknown>>('/api/courses')
      .then(async (result) => {
        const courses: Course[] = (result ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.title as string ?? '',
          description: c.description as string ?? '',
          status: c.status as string ?? 'draft',
          modules: (c.modules as CourseModule[]) ?? [],
          enrolledCount: (c.enrolledCount as number) ?? 0,
        }))
        const published = courses.filter(c => c.status === 'published' || c.status === 'Published')

        const enrollments: Enrollment[] = []
        if (userEmail) {
          for (const c of published) {
            try {
              const res = await fetch(`/api/courses/${c.id}/enrollments?limit=200`)
              if (!res.ok) continue
              const enrResult = await res.json()
              const list = enrResult.data ?? enrResult ?? []
              const mine = list.find((e: Record<string, unknown>) =>
                (e.studentEmail as string)?.toLowerCase() === userEmail.toLowerCase()
              )
              if (mine) {
                enrollments.push({
                  id: mine.id as string,
                  courseId: c.id,
                  progress: (mine.progress as Record<string, boolean>) ?? {},
                  status: (mine.status as string) ?? 'active',
                })
              }
            } catch { /* skip */ }
          }
        }

        const completed = published.filter(c => {
          const enr = enrollments.find(e => e.courseId === c.id)
          if (!enr || c.modules.length === 0) return false
          const done = c.modules.filter(m => enr.progress[m.id]).length
          return done === c.modules.length
        }).length

        setData({
          courses: published,
          enrollments,
          totalCompleted: completed,
          totalInProgress: published.length - completed,
        })
      })
      .catch(() => toast('Failed to load training data', 'error'))
      .finally(() => setLoading(false))
  }, [company, userEmail, toast])

  if (loading) return <LoadingScreen />

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Sales Training</h1>
        <p className="text-xs text-gray-500 mt-0.5">Courses, certifications, and upcoming sessions</p>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Available Courses', value: data.courses.length.toString(), icon: BookOpen, color: '#be123c' },
            { label: 'In Progress', value: data.totalInProgress.toString(), icon: Play, color: '#2563eb' },
            { label: 'Completed', value: data.totalCompleted.toString(), icon: CheckCircle, color: '#015035' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                    <Icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Courses</h3>
          </div>
          {data.courses.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {data.courses.map(c => {
                const totalModules = c.modules.length
                const enrollment = data.enrollments.find(e => e.courseId === c.id)
                const completedModules = enrollment
                  ? c.modules.filter(m => enrollment.progress[m.id]).length
                  : 0
                const progress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0
                // AUDIT.md #471 — these used to point at the internal staff
                // course viewer (/courses/[id]), which AppShell.tsx's client
                // redirect bounces any real client session away from before
                // it ever renders (any userType: 'client' path outside
                // /client/** gets sent back to /client). The real client
                // viewer now lives at /client/courses/[id].
                const href = enrollment ? `/client/courses/${c.id}?enrollment=${enrollment.id}` : `/client/courses/${c.id}`
                return (
                  <Link key={c.id} href={href} className="block px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#be123c12' }}>
                        <GraduationCap size={16} style={{ color: '#be123c' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                        {totalModules > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">{completedModules}/{totalModules} modules</span>
                              <span className="font-semibold" style={{ color: '#be123c' }}>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full transition-all" style={{ width: `${progress}%`, background: '#be123c' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <GraduationCap size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Training courses will appear here once available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
