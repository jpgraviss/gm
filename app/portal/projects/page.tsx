'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatDate, projectStatusColors } from '@/lib/utils'
import {
  ArrowLeft, FolderKanban, CheckCircle, ChevronRight, Users, Calendar,
} from 'lucide-react'

interface Milestone {
  id: string
  name: string
  dueDate: string
  completed: boolean
}

interface Project {
  id: string
  company: string
  serviceType: string
  status: string
  startDate: string
  launchDate: string
  assignedTeam: string[]
  progress: number
  milestones: Milestone[]
  overview: string
}

export default function PortalProjectsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)

  useEffect(() => {
    if (!company) {
      requestAnimationFrame(() => setLoading(false))
      return
    }
    fetch(`/api/projects?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: Project[]) => setProjects(Array.isArray(d) ? d : []))
      .catch(() => toast('Failed to load projects', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (selected) {
    return (
      <div className="min-h-screen" style={{ background: '#f8fafc' }}>
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Projects
          </button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{selected.serviceType} Project</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Started {formatDate(selected.startDate)} {selected.launchDate ? `· Launch ${formatDate(selected.launchDate)}` : ''}
              </p>
            </div>
            <StatusBadge label={selected.status} colorClass={projectStatusColors[selected.status] ?? 'bg-gray-100 text-gray-600'} />
          </div>
        </div>
        <div className="p-4 sm:p-8 max-w-3xl mx-auto flex flex-col gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500 font-medium">Overall Progress</span>
              <span className="font-bold" style={{ color: '#015035' }}>{selected.progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all" style={{ width: `${selected.progress}%`, background: '#015035' }} />
            </div>
          </div>

          {selected.overview && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Overview</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{selected.overview}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Milestones</h3>
            {selected.milestones.length > 0 ? (
              <div className="flex flex-col gap-2">
                {selected.milestones.map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.completed ? '' : 'bg-gray-200'}`}
                      style={m.completed ? { background: '#015035' } : {}}
                    >
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
            ) : (
              <p className="text-xs text-gray-400">No milestones defined yet.</p>
            )}
          </div>

          {selected.assignedTeam.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Your Team</h3>
              <div className="flex flex-wrap gap-2">
                {selected.assignedTeam.map((name) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                      {name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Project Dashboards</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track progress across all active projects</p>
      </div>
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FolderKanban size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No active projects</p>
            <p className="text-xs text-gray-400 mt-1">Projects will appear here when they are created.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-[#015035]/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e6f0ec' }}>
                      <FolderKanban size={16} style={{ color: '#015035' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-[#015035] transition-colors">{p.serviceType}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                        {p.launchDate && (
                          <span className="flex items-center gap-1"><Calendar size={10} /> Launch {formatDate(p.launchDate)}</span>
                        )}
                        {p.assignedTeam.length > 0 && (
                          <span className="flex items-center gap-1"><Users size={10} /> {p.assignedTeam.length} member{p.assignedTeam.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge label={p.status} colorClass={projectStatusColors[p.status] ?? 'bg-gray-100 text-gray-600'} />
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#015035] transition-colors" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-bold" style={{ color: '#015035' }}>{p.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, background: '#015035' }} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
