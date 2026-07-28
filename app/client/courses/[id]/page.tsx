'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useClientCompany } from '@/lib/useClientCompany'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  ArrowLeft, BookOpen, CheckCircle, Circle, Play, FileText,
  HelpCircle, Award, ChevronLeft, ChevronRight,
} from 'lucide-react'

// AUDIT.md #471 — client-facing course viewer, ported from the internal
// staff viewer (app/courses/[id]/page.tsx) so a real client can actually
// open a course linked from app/client/services/[slug]/page.tsx's
// SalesTrainingService instead of hitting AppShell.tsx's client redirect
// (any userType: 'client' session on a path outside /client/** gets bounced
// back to /client before a bare /courses/[id] page ever renders).
//
// This intentionally duplicates app/courses/[id]/page.tsx's module/quiz
// rendering rather than sharing a component — matches how every other
// service already ported in this merge (WebDesignService, SocialMediaService
// in the same [slug]/page.tsx file) has its own client-specific copy rather
// than reusing the staff version. The underlying APIs
// (GET /api/courses/[id], GET/PATCH .../enrollments(/[enrollmentId]), POST
// .../quiz/[moduleId]/grade) were already made caller-scoped for non-staff
// callers (see the AUDIT comments in those route files) — nothing new is
// needed there, only a client-reachable route that calls them the same way
// the staff viewer does.
//
// Course catalog rows aren't company-scoped (any authenticated caller sees
// the same published courses — see courses/route.ts's comment), so unlike
// Web Design/Social Media there's no per-company course to look up. What IS
// gated is whether this client's company has Sales Training on their plan at
// all, checked the same way the sales-training hub gates entry to
// SalesTrainingService — a client without the entitlement shouldn't be able
// to reach a course page just by typing/pasting the URL, even though the
// course itself isn't tied to their company.

type ModuleType = 'video' | 'text' | 'quiz'

interface CourseModule {
  id: string
  title: string
  type: ModuleType
  content: string
}

interface Course {
  id: string
  title: string
  description: string
  modules: CourseModule[]
  status: string
}

interface Enrollment {
  id: string
  courseId: string
  studentName: string
  studentEmail: string
  progress: Record<string, string | boolean>
  completedAt: string | null
  status: string
}

// The client never receives `correctIndex` (stripped server-side for
// non-staff callers — see mapCourse/stripQuizAnswers in
// app/api/courses/[id]/route.ts), so the pre-submission question shape
// genuinely doesn't have it.
interface QuizQuestion {
  question: string
  options: string[]
}

// The post-submission review shape DOES include correctIndex — it comes
// back from POST /api/courses/[id]/quiz/[moduleId]/grade only after the
// server has graded the real answers, never before.
interface GradedQuestion {
  question: string
  options: string[]
  correctIndex: number
  selected: number | null
  isCorrect: boolean
}

interface GradeResult {
  score: number
  total: number
  threshold: number
  passed: boolean
  results: GradedQuestion[]
  enrollment: Enrollment | null
}

function extractVideoId(url: string): { type: 'youtube' | 'vimeo' | 'unknown'; id: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] }
  return { type: 'unknown', id: '' }
}

function VideoPlayer({ url }: { url: string }) {
  const video = extractVideoId(url)
  if (video.type === 'youtube') {
    return (
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${video.id}`}
          className="absolute inset-0 w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  if (video.type === 'vimeo') {
    return (
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://player.vimeo.com/video/${video.id}`}
          className="absolute inset-0 w-full h-full rounded-xl"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
      <Play size={24} className="mx-auto text-gray-400 mb-2" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline font-medium">
        Open Video
      </a>
    </div>
  )
}

function TextContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="prose prose-sm max-w-none">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />
        if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1.5">{line.slice(3)}</h3>
        if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold text-gray-700 mt-2 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="text-sm text-gray-700 ml-4 mb-1 list-disc">{line.slice(2)}</li>
        return <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{line}</p>
      })}
    </div>
  )
}

function QuizContent({
  content,
  courseId,
  moduleId,
  enrollmentId,
  isCompleted,
  onGraded,
}: {
  content: string
  courseId: string
  moduleId: string
  enrollmentId: string | null
  isCompleted: boolean
  onGraded: (enrollment: Enrollment | null) => void
}) {
  const { toast } = useToast()
  const [answers, setAnswers] = useState<Record<number, number>>({})
  // Grading happens server-side, which is the only place the real
  // correctIndex values live. `submitted` starts true when the enrollment
  // already shows this module complete purely so a previously-passed quiz
  // renders in its answered state on reload — there is no locally cached
  // score to show in that case (only the server has one), so `result` stays
  // null until the student actually re-submits.
  const [submitted, setSubmitted] = useState(isCompleted)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<GradeResult | null>(null)

  const questions: QuizQuestion[] = useMemo(() => {
    try {
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [content])

  if (questions.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No quiz questions available.</p>
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/courses/${courseId}/quiz/${moduleId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(enrollmentId ? { enrollmentId } : {}),
          answers,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to grade quiz')
      }
      const graded: GradeResult = await res.json()
      setResult(graded)
      setSubmitted(true)
      onGraded(graded.enrollment)
    } catch (e) {
      toast((e as Error).message || 'Failed to submit quiz', 'error')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {questions.map((q, qi) => {
        const graded = result?.results[qi]
        return (
          <div key={qi} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-800 mb-3">
              {qi + 1}. {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi
                // Correct/incorrect highlighting only exists once the server
                // has returned a graded review for this attempt — before
                // that, the client has no correctIndex to compare against.
                const isCorrect = !!graded && oi === graded.correctIndex
                const isWrong = !!graded && isSelected && oi !== graded.correctIndex
                return (
                  <label
                    key={oi}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                      isCorrect ? 'border-green-400 bg-green-50' :
                      isWrong ? 'border-red-400 bg-red-50' :
                      isSelected ? 'border-emerald-500 bg-emerald-50' :
                      'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${moduleId}-${qi}`}
                      checked={isSelected}
                      onChange={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
                      disabled={submitted}
                      className="accent-emerald-600"
                    />
                    <span className={`text-sm ${isCorrect ? 'text-green-700 font-medium' : isWrong ? 'text-red-600' : 'text-gray-700'}`}>
                      {opt}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length < questions.length}
          className="self-end px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
          style={{ background: '#015035' }}
        >
          {submitting ? 'Submitting...' : 'Submit Answers'}
        </button>
      ) : result && (
        <div className={`p-4 rounded-xl border text-center ${result.passed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="text-sm font-semibold">
            Score: {result.score}/{result.total} ({Math.round((result.score / result.total) * 100)}%)
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {result.passed ? 'Passed! Module marked complete.' : 'You need 60% to pass. Try again.'}
          </p>
          {!result.passed && (
            <button
              onClick={() => { setAnswers({}); setSubmitted(false); setResult(null) }}
              className="mt-2 text-xs font-medium text-emerald-600 hover:underline"
            >
              Retry Quiz
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NotEntitled() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Not part of your plan</p>
          <p className="text-xs text-gray-400 mt-1">Sales Training isn&apos;t included in your current contract. Contact your account manager to add it.</p>
          <Link href="/client/services/sales-training" className="inline-flex items-center gap-1.5 text-xs font-semibold mt-4 hover:opacity-80" style={{ color: '#015035' }}>
            <ArrowLeft size={12} /> Back to Sales Training
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ClientCourseViewerPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const enrollmentId = searchParams.get('enrollment')
  const { user } = useAuth()
  const { toast } = useToast()
  const { company } = useClientCompany()

  // Entitlement check — same real per-company source and precedence as the
  // Sales Training hub (app/client/services/[slug]/page.tsx's
  // SalesTrainingService) and the Services hub above it. Course rows aren't
  // company-scoped so the course-fetch API below can't enforce this itself
  // — without this check a client could reach a course just by pasting the
  // URL even if Sales Training isn't on their plan.
  const [entitled, setEntitled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setEntitled(false)); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const config = d?.portalConfig as { visible_services?: string[]; services_config?: Record<string, { enabled: boolean }> } | undefined
        const fromConfig = config?.services_config
          ? Object.entries(config.services_config).filter(([, v]) => v.enabled).map(([k]) => k)
          : null
        const entitledServices: string[] = fromConfig ?? config?.visible_services ?? d?.services ?? []
        setEntitled(entitledServices.includes('Sales Training'))
      })
      .catch(() => { toast('Failed to load service data', 'error'); setEntitled(false) })
  }, [company, toast])

  const [course, setCourse] = useState<Course | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModuleIdx, setActiveModuleIdx] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (entitled !== true) return
    async function load() {
      try {
        const courseRes = await fetch(`/api/courses/${id}`)
        if (!courseRes.ok) throw new Error('Course not found')
        const courseData: Course = await courseRes.json()
        setCourse(courseData)

        // GET /api/courses/[id]/enrollments already scopes a non-staff
        // caller to their own enrollment(s) server-side (AUDIT.md #203), so
        // this only ever sees this client's own rows for the course.
        if (enrollmentId) {
          const enrData = await fetchAllPages<Enrollment>(`/api/courses/${id}/enrollments`).catch(() => [])
          const found = enrData.find(e => e.id === enrollmentId)
          if (found) setEnrollment(found)
        } else if (user?.email) {
          const enrData = await fetchAllPages<Enrollment>(`/api/courses/${id}/enrollments`).catch(() => [])
          const found = enrData.find(e => e.studentEmail === user.email)
          if (found) setEnrollment(found)
        }
      } catch {
        toast('Failed to load course', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [entitled, id, enrollmentId, user?.email, toast])

  const modules = course?.modules ?? []
  const activeModule = modules[activeModuleIdx] ?? null

  const completedModules = useMemo(() => {
    if (!enrollment?.progress) return new Set<string>()
    return new Set(
      Object.entries(enrollment.progress)
        .filter(([, v]) => v === true || v === 'completed')
        .map(([k]) => k)
    )
  }, [enrollment?.progress])

  const progressPct = modules.length > 0
    ? Math.round((completedModules.size / modules.length) * 100)
    : 0

  const isFullyComplete = modules.length > 0 && completedModules.size === modules.length

  const markModuleComplete = useCallback(async (moduleId: string) => {
    if (!enrollment || !course || completedModules.has(moduleId)) return
    setSaving(true)
    try {
      const newProgress = { ...enrollment.progress, [moduleId]: true }
      const allComplete = modules.every(m => newProgress[m.id] === true)
      const res = await fetch(`/api/courses/${course.id}/enrollments/${enrollment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: newProgress,
          ...(allComplete ? { completed: true } : {}),
        }),
      })
      if (!res.ok) throw new Error('Failed to save progress')
      const updated = await res.json()
      setEnrollment(updated)
    } catch {
      toast('Failed to save progress', 'error')
    }
    setSaving(false)
  }, [enrollment, course, modules, completedModules, toast])

  if (entitled === null) {
    return <LoadingScreen fullScreen />
  }

  if (entitled === false) {
    return <NotEntitled />
  }

  if (loading) {
    return <LoadingScreen fullScreen />
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-3">
        <BookOpen size={48} className="text-gray-300" />
        <p className="text-gray-500 text-sm">Course not found</p>
        <Link href="/client/services/sales-training" className="text-sm text-emerald-600 hover:underline">Back to Sales Training</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page-bg, #f8f9fa)' }}>
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 flex items-center gap-4">
        <Link href="/client/services/sales-training" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={14} /> Sales Training
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-gray-900 truncate">{course.title}</h1>
          {enrollment && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 max-w-[200px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: '#015035' }} />
              </div>
              <span className="text-[10px] font-semibold text-gray-500">{progressPct}% complete</span>
            </div>
          )}
        </div>
        {isFullyComplete && enrollment?.completedAt && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <Award size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">Course Completed</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Module Sidebar */}
        <aside className="w-64 lg:w-72 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 hidden md:flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Modules</p>
          </div>
          <nav className="flex-1 p-2">
            {modules.map((mod, idx) => {
              const done = completedModules.has(mod.id)
              const active = idx === activeModuleIdx
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModuleIdx(idx)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 transition-all ${
                    active ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50'
                  }`}
                >
                  {done ? (
                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Circle size={16} className={`flex-shrink-0 ${active ? 'text-emerald-400' : 'text-gray-300'}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${active ? 'text-emerald-700' : done ? 'text-gray-600' : 'text-gray-700'}`}>
                      {mod.title || `Module ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-gray-400 capitalize">{mod.type}</p>
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {modules.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BookOpen size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">This course has no modules yet.</p>
              </div>
            </div>
          ) : activeModule ? (
            <div className="max-w-3xl mx-auto px-4 py-6 sm:px-8 sm:py-8">
              {/* Mobile module selector */}
              <div className="md:hidden mb-4">
                <select
                  value={activeModuleIdx}
                  onChange={e => setActiveModuleIdx(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {modules.map((mod, idx) => (
                    <option key={mod.id} value={idx}>
                      {completedModules.has(mod.id) ? '✓ ' : ''}{mod.title || `Module ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Module {activeModuleIdx + 1} of {modules.length}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                    activeModule.type === 'video' ? 'bg-blue-50 text-blue-600' :
                    activeModule.type === 'quiz' ? 'bg-purple-50 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {activeModule.type === 'video' && <Play size={10} className="inline mr-0.5 -mt-0.5" />}
                    {activeModule.type === 'text' && <FileText size={10} className="inline mr-0.5 -mt-0.5" />}
                    {activeModule.type === 'quiz' && <HelpCircle size={10} className="inline mr-0.5 -mt-0.5" />}
                    {activeModule.type}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  {activeModule.title || `Module ${activeModuleIdx + 1}`}
                </h2>
              </div>

              {/* Module Content */}
              <div className="mb-8">
                {activeModule.type === 'video' && (
                  <VideoPlayer url={activeModule.content} />
                )}
                {activeModule.type === 'text' && (
                  <TextContent content={activeModule.content} />
                )}
                {activeModule.type === 'quiz' && (
                  <QuizContent
                    content={activeModule.content}
                    courseId={course.id}
                    moduleId={activeModule.id}
                    enrollmentId={enrollment?.id ?? null}
                    isCompleted={completedModules.has(activeModule.id)}
                    onGraded={(updated) => { if (updated) setEnrollment(updated) }}
                  />
                )}
              </div>

              {/* Mark Complete + Navigation */}
              <div className="flex items-center justify-between border-t border-gray-200 pt-5">
                <button
                  onClick={() => setActiveModuleIdx(Math.max(0, activeModuleIdx - 1))}
                  disabled={activeModuleIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {enrollment && activeModule.type !== 'quiz' && !completedModules.has(activeModule.id) && (
                  <button
                    onClick={() => markModuleComplete(activeModule.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity"
                    style={{ background: '#015035' }}
                  >
                    <CheckCircle size={14} />
                    {saving ? 'Saving...' : 'Mark Complete'}
                  </button>
                )}

                {completedModules.has(activeModule.id) && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <CheckCircle size={14} /> Completed
                  </span>
                )}

                <button
                  onClick={() => setActiveModuleIdx(Math.min(modules.length - 1, activeModuleIdx + 1))}
                  disabled={activeModuleIdx === modules.length - 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>

              {/* Completion Banner */}
              {isFullyComplete && (
                <div className="mt-8 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <Award size={40} className="mx-auto text-emerald-500 mb-3" />
                  <h3 className="text-lg font-bold text-emerald-800 mb-1">Course Completed!</h3>
                  <p className="text-sm text-emerald-600">
                    Congratulations! You have completed all modules in this course.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
