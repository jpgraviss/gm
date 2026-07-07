'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, GraduationCap, BookOpen,
  CheckCircle, Play,
} from 'lucide-react'

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
  thumbnailUrl?: string
}

interface TrainingData {
  courses: Course[]
  enrollments: Enrollment[]
  totalCompleted: number
  totalInProgress: number
}

export default function PortalSalesTrainingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<TrainingData>({
    courses: [],
    enrollments: [],
    totalCompleted: 0,
    totalInProgress: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }

    fetch('/api/courses?limit=50')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(async (result) => {
        const courses: Course[] = (result.data ?? result ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          title: c.title as string ?? '',
          description: c.description as string ?? '',
          status: c.status as string ?? 'draft',
          modules: (c.modules as CourseModule[]) ?? [],
          enrolledCount: (c.enrolledCount as number) ?? 0,
          thumbnailUrl: c.thumbnailUrl as string ?? undefined,
        }))
        const published = courses.filter(c => c.status === 'published' || c.status === 'Published')

        const enrollments: Enrollment[] = []
        if (user?.email) {
          for (const c of published) {
            try {
              const res = await fetch(`/api/courses/${c.id}/enrollments?limit=200`)
              if (!res.ok) continue
              const enrResult = await res.json()
              const list = enrResult.data ?? enrResult ?? []
              const mine = list.find((e: Record<string, unknown>) =>
                (e.studentEmail as string)?.toLowerCase() === user.email.toLowerCase()
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
  }, [company, user?.email, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#be123c' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sales Training</h1>
          <p className="text-xs text-gray-500 mt-0.5">Courses, certifications, and upcoming sessions</p>
        </div>
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
                return (
                  <div key={c.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
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
                  </div>
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
