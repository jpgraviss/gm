'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  GraduationCap, Users, Plus, X, Trash2, ChevronUp, ChevronDown,
  BookOpen, FileText, HelpCircle, DollarSign, Video, Type, Tag, Eye,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────────

type CourseStatus = 'Draft' | 'Published'
type AccessType = 'free' | 'paid'
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
  status: CourseStatus
  price: number
  accessType: AccessType
  tags: string[]
  enrolledCount: number
  createdAt: string
  updatedAt: string
}

interface Enrollment {
  id: string
  courseId: string
  studentName: string
  studentEmail: string
  progress: Record<string, unknown>
  completedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  Draft:     'bg-gray-100 text-gray-600',
  Published: 'bg-emerald-100 text-emerald-700',
}

const moduleTypeIcons: Record<ModuleType, React.ReactNode> = {
  video: <Video size={13} />,
  text:  <Type size={13} />,
  quiz:  <HelpCircle size={13} />,
}

// ─── Course Editor Panel ────────────────────────────────────────────────────────

function CoursePanel({
  course,
  onClose,
  onSave,
  onDelete,
}: {
  course: Course | null
  onClose: () => void
  onSave: (data: { title: string; description: string; status: CourseStatus; price: number; accessType: AccessType; modules: CourseModule[] }, id?: string) => void
  onDelete: (id: string) => void
}) {
  const { toast } = useToast()
  const [panelTab, setPanelTab] = useState<'details' | 'enrollments'>('details')

  // Course fields
  const [title, setTitle] = useState(course?.title ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [status, setStatus] = useState<CourseStatus>(course?.status as CourseStatus ?? 'Draft')
  const [price, setPrice] = useState(course?.price ?? 0)
  const [accessType, setAccessType] = useState<AccessType>(course?.accessType as AccessType ?? 'free')
  const [modules, setModules] = useState<CourseModule[]>(course?.modules ?? [])

  // Enrollments
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)
  const [enrollName, setEnrollName] = useState('')
  const [enrollEmail, setEnrollEmail] = useState('')

  const canSave = title.trim().length > 0

  // Fetch enrollments when panel opens on existing course
  const fetchEnrollments = useCallback(async () => {
    if (!course) return
    setLoadingEnrollments(true)
    try {
      const res = await fetch(`/api/courses/${course.id}/enrollments?limit=200`)
      if (!res.ok) throw new Error('Failed to fetch enrollments')
      const json = await res.json()
      setEnrollments(json.data ?? [])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingEnrollments(false)
    }
  }, [course, toast])

  useEffect(() => {
    if (course && panelTab === 'enrollments') {
      fetchEnrollments()
    }
  }, [course, panelTab, fetchEnrollments])

  // ── Module management ─────────────────────────────────────────────────────

  function addModule() {
    setModules([...modules, {
      id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      type: 'text',
      content: '',
    }])
  }

  function updateModule(idx: number, updates: Partial<CourseModule>) {
    setModules(modules.map((m, i) => (i === idx ? { ...m, ...updates } : m)))
  }

  function removeModule(idx: number) {
    setModules(modules.filter((_, i) => i !== idx))
  }

  function moveModule(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= modules.length) return
    const next = [...modules]
    const tmp = next[idx]
    next[idx] = next[target]
    next[target] = tmp
    setModules(next)
  }

  // ── Enroll student ────────────────────────────────────────────────────────

  async function enrollStudent() {
    if (!course || !enrollName.trim() || !enrollEmail.trim()) return
    try {
      const res = await fetch(`/api/courses/${course.id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: enrollName.trim(), studentEmail: enrollEmail.trim() }),
      })
      if (!res.ok) throw new Error('Failed to enroll student')
      const created = await res.json()
      setEnrollments(prev => [created, ...prev])
      setEnrollName('')
      setEnrollEmail('')
      toast('Student enrolled', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  // ── Compute progress % ────────────────────────────────────────────────────

  function progressPct(enrollment: Enrollment): number {
    if (enrollment.completedAt) return 100
    const prog = enrollment.progress
    if (!prog || typeof prog !== 'object') return 0
    const completed = Object.values(prog).filter(v => v === true || v === 'completed').length
    const total = modules.length || 1
    return Math.round((completed / total) * 100)
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(680px, 100vw)' }}>

        {/* Header */}
        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
              {course ? 'Edit Course' : 'New Course'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5">
              {course ? course.id.toUpperCase() : 'Create a new course'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Tabs (only show Enrollments for existing courses) */}
        {course && (
          <div className="flex border-b border-gray-200 px-5 flex-shrink-0">
            <button
              onClick={() => setPanelTab('details')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                panelTab === 'details'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Course Details
            </button>
            <button
              onClick={() => setPanelTab('enrollments')}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                panelTab === 'enrollments'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={12} className="inline mr-1 -mt-0.5" />
              Enrollments
            </button>
          </div>
        )}

        {/* ── Details Tab ────────────────────────────────────────────────────── */}
        {panelTab === 'details' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. SEO Fundamentals Course"
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Course overview and objectives..."
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as CourseStatus)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Access</label>
                  <select
                    value={accessType}
                    onChange={e => setAccessType(e.target.value as AccessType)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Modules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Modules ({modules.length})
                  </label>
                  <button
                    onClick={addModule}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    style={{ color: '#015035' }}
                  >
                    <Plus size={12} /> Add Module
                  </button>
                </div>

                {modules.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
                    <BookOpen size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">No modules yet. Add your first module.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {modules.map((mod, idx) => (
                      <div key={mod.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                          <input
                            value={mod.title}
                            onChange={e => updateModule(idx, { title: e.target.value })}
                            placeholder="Module title"
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                          />
                          <select
                            value={mod.type}
                            onChange={e => updateModule(idx, { type: e.target.value as ModuleType })}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="video">Video</option>
                            <option value="text">Text</option>
                            <option value="quiz">Quiz</option>
                          </select>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveModule(idx, -1)}
                              disabled={idx === 0}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => moveModule(idx, 1)}
                              disabled={idx === modules.length - 1}
                              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeModule(idx)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <textarea
                          value={mod.content}
                          onChange={e => updateModule(idx, { content: e.target.value })}
                          placeholder={
                            mod.type === 'video' ? 'Video URL (e.g. https://...)'
                            : mod.type === 'quiz' ? 'Quiz questions (JSON format)'
                            : 'Module content...'
                          }
                          rows={2}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none bg-white font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => onSave({ title: title.trim(), description, status, price, accessType, modules }, course?.id)}
                disabled={!canSave}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                {course ? 'Save Changes' : 'Create Course'}
              </button>
              {course && (
                <button onClick={() => onDelete(course.id)} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Enrollments Tab ────────────────────────────────────────────────── */}
        {panelTab === 'enrollments' && course && (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Enroll student form */}
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Enroll Student</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    value={enrollName}
                    onChange={e => setEnrollName(e.target.value)}
                    placeholder="Student name"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                  />
                  <input
                    value={enrollEmail}
                    onChange={e => setEnrollEmail(e.target.value)}
                    placeholder="Student email"
                    type="email"
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                  />
                </div>
                <button
                  onClick={enrollStudent}
                  disabled={!enrollName.trim() || !enrollEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
                  style={{ background: '#015035' }}
                >
                  <Plus size={12} /> Enroll Student
                </button>
              </div>

              {/* Enrollment list */}
              {loadingEnrollments ? (
                <div className="text-center py-10 text-gray-400 text-sm">Loading enrollments...</div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-10">
                  <Users size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">No students enrolled yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {enrollments.map(enr => {
                    const pct = progressPct(enr)
                    return (
                      <div key={enr.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{enr.studentName}</p>
                          <p className="text-xs text-gray-400 truncate">{enr.studentEmail}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: '#015035' }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-500 w-8 text-right">{pct}%</span>
                          </div>
                          {enr.completedAt && (
                            <p className="text-[10px] text-emerald-600 mt-0.5">
                              Completed {new Date(enr.completedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button
                onClick={() => setPanelTab('details')}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Back to Details
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<{ open: boolean; course: Course | null }>({ open: false, course: null })

  useEffect(() => {
    fetchCourses()
  }, [])

  async function fetchCourses() {
    try {
      const res = await fetch('/api/courses?limit=200')
      if (!res.ok) throw new Error('Failed to fetch courses')
      const json = await res.json()
      setCourses(json.data ?? [])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveCourse(data: { title: string; description: string; status: CourseStatus; price: number; accessType: AccessType; modules: CourseModule[] }, id?: string) {
    try {
      if (id) {
        const res = await fetch(`/api/courses/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to update course')
        const updated = await res.json()
        setCourses(prev => prev.map(c => (c.id === id ? updated : c)))
        toast('Course updated', 'success')
      } else {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to create course')
        const created = await res.json()
        setCourses(prev => [created, ...prev])
        toast('Course created', 'success')
      }
      setPanel({ open: false, course: null })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function deleteCourse(id: string) {
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete course')
      setCourses(prev => prev.filter(c => c.id !== id))
      setPanel({ open: false, course: null })
      toast('Course deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  function formatPrice(price: number, accessType: string) {
    if (accessType === 'free' || price === 0) return 'Free'
    return `$${price.toFixed(2)}`
  }

  return (
    <>
      <Header
        title="Courses"
        subtitle="Build and manage training courses"
        action={{ label: 'New Course', onClick: () => setPanel({ open: true, course: null }) }}
      />

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm mb-1">No courses yet</p>
            <p className="text-gray-400 text-xs mb-4">Create your first course to get started</p>
            <button
              onClick={() => setPanel({ open: true, course: null })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: '#015035' }}
            >
              <Plus size={14} /> New Course
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <button
                key={course.id}
                onClick={() => setPanel({ open: true, course })}
                className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-gray-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-1 flex-1">{course.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex-shrink-0 ml-2 ${statusColors[course.status] ?? statusColors['Draft']}`}>
                    {course.status}
                  </span>
                  {/* AUDIT #239 — app/courses/[id]/page.tsx had no link
                      pointing to it anywhere in the live UI; reachable only
                      by hand-typing the URL. */}
                  <Link
                    href={`/courses/${course.id}`}
                    onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 ml-2 p-1 rounded-lg text-gray-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                    title="Preview course"
                  >
                    <Eye size={14} />
                  </Link>
                </div>

                {course.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {course.description.slice(0, 120)}{course.description.length > 120 ? '...' : ''}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen size={12} />
                    {(course.modules ?? []).length} modules
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} />
                    {course.enrolledCount} enrolled
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign size={12} />
                    {formatPrice(course.price, course.accessType)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {panel.open && (
        <CoursePanel
          course={panel.course}
          onClose={() => setPanel({ open: false, course: null })}
          onSave={saveCourse}
          onDelete={deleteCourse}
        />
      )}
    </>
  )
}
