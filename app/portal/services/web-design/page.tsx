'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Globe, Calendar, CheckCircle, Circle,
  FolderKanban, Flag, FileText, Clock,
} from 'lucide-react'

interface Milestone {
  id: string
  name: string
  dueDate: string
  completed: boolean
}

interface Deliverable {
  name: string
  type: string
  status: string
  url?: string
}

interface Project {
  id: string
  serviceType: string
  status: string
  startDate: string
  launchDate: string
  progress: number
  milestones: Milestone[]
  overview: string
  assignedTeam: string[]
}

export default function PortalWebDesignPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/dashboard?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const projects: Project[] = d?.projects ?? []
        const webProject = projects.find(p => p.serviceType === 'Web Design') ?? null
        setProject(webProject)
      })
      .catch(() => toast('Failed to load project data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#7c3aed' }} />
      </div>
    )
  }

  const milestones = project?.milestones ?? []
  const completedMilestones = milestones.filter(m => m.completed).length
  const totalMilestones = milestones.length

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#015035' + '12' }}>
                    <Flag size={14} style={{ color: '#015035' }} />
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
