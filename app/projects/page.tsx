'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { projects } from '@/lib/data'
import { projectStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Project, ProjectStatus } from '@/lib/types'
import { X, CheckCircle, Circle, Clock, User, Calendar, ChevronRight, LayoutList, KanbanSquare } from 'lucide-react'

const allStatuses: ProjectStatus[] = ['Not Started', 'In Progress', 'Awaiting Client', 'Completed', 'Launched', 'In Maintenance']

function ProgressRing({ pct }: { pct: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const fill = (pct / 100) * c
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke="#015035" strokeWidth="3.5"
        strokeDasharray={`${fill} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#015035">
        {pct}%
      </text>
    </svg>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const completedMilestones = project.milestones.filter(m => m.completed).length
  return (
    <div className="metric-card cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 mb-1">{project.company}</p>
          <div className="flex items-center gap-1.5">
            <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
            <StatusBadge label={project.serviceType} colorClass={serviceTypeColors[project.serviceType]} />
          </div>
        </div>
        <ProgressRing pct={project.progress} />
      </div>

      {/* Milestones */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500">Milestones</span>
          <span className="text-gray-700 font-medium">{completedMilestones}/{project.milestones.length}</span>
        </div>
        <div className="flex gap-1">
          {project.milestones.map(m => (
            <div
              key={m.id}
              className="flex-1 h-1.5 rounded-full"
              style={{ background: m.completed ? '#015035' : '#e5e7eb' }}
              title={m.name}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
        <div className="flex -space-x-1.5">
          {project.assignedTeam.map((name, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
              style={{ background: i === 0 ? '#015035' : '#6b7280' }}
              title={name}
            >
              {name.split(' ').map(n => n[0]).join('')}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={11} />
          {new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

function ProjectDetail({ project, onClose }: { project: Project; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'tasks'>('overview')

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-6 border-b" style={{ background: '#012b1e' }}>
          <div>
            <p className="text-white/60 text-xs mb-1">{project.id.toUpperCase()} · Project</p>
            <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
              {project.company}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
              <StatusBadge label={project.serviceType} colorClass={serviceTypeColors[project.serviceType]} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing pct={project.progress} />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {(['overview', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Dates */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Start Date', value: formatDate(project.startDate) },
                  { label: 'Launch Date', value: formatDate(project.launchDate) },
                  { label: 'Maintenance', value: project.maintenanceStartDate ? formatDate(project.maintenanceStartDate) : 'Post-launch' },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Team */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Team</p>
                <div className="flex flex-col gap-2">
                  {project.assignedTeam.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: i === 0 ? '#015035' : '#6b7280' }}
                      >
                        {name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm text-gray-700">{name}</span>
                      {i === 0 && <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">Lead</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Milestones</p>
                <div className="flex flex-col gap-2">
                  {project.milestones.map((m, i) => (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${m.completed ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${m.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                        {m.completed && <CheckCircle size={13} className="text-white" />}
                        {!m.completed && <span className="text-[10px] text-gray-400 font-bold">{i + 1}</span>}
                      </div>
                      <span className={`text-sm flex-1 ${m.completed ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>{m.name}</span>
                      <span className="text-xs text-gray-400">{new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      {m.completed && <CheckCircle size={14} className="text-emerald-500" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'tasks' && (
            <div className="flex flex-col gap-2">
              {project.tasks.length === 0 && (
                <div className="py-8 text-center text-gray-400 text-sm">No tasks yet</div>
              )}
              {project.tasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${task.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                    {task.completed && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                  <span className={`text-sm flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    task.priority === 'High' ? 'text-red-600 bg-red-50' :
                    task.priority === 'Medium' ? 'text-yellow-600 bg-yellow-50' :
                    'text-gray-500 bg-gray-100'
                  }`}>{task.priority}</span>
                  <span className="text-xs text-gray-400">{task.assignee.split(' ')[0]}</span>
                  <span className="text-xs text-gray-400">{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
            Update Status
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const [selected, setSelected] = useState<Project | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? projects : projects.filter(p => p.status === statusFilter)

  return (
    <>
      <Header title="Project Management" subtitle="Track delivery across all service lines" action={{ label: 'New Project' }} />
      <div className="p-6 flex-1">
        {/* Filters & View Toggle */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex gap-1">
            <button onClick={() => setView('board')} className={`tab-btn ${view === 'board' ? 'active' : ''}`}>
              <span className="flex items-center gap-1.5"><KanbanSquare size={13} /> Board</span>
            </button>
            <button onClick={() => setView('list')} className={`tab-btn ${view === 'list' ? 'active' : ''}`}>
              <span className="flex items-center gap-1.5"><LayoutList size={13} /> List</span>
            </button>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <button onClick={() => setStatusFilter('All')} className={`tab-btn ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
          {allStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>{s}</button>
          ))}
          <span className="ml-auto text-sm text-gray-500">{filtered.length} projects</span>
        </div>

        {/* Board View */}
        {view === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 py-16 text-center text-gray-400 text-sm">
                No projects in this status
              </div>
            )}
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Progress</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Launch Date</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Team</th>
                  <th className="text-left py-2.5 px-4 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0" onClick={() => setSelected(p)}>
                    <td className="py-3 px-4">
                      <p className="text-sm font-semibold text-gray-900">{p.company}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={p.status} colorClass={projectStatusColors[p.status]} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={p.serviceType} colorClass={serviceTypeColors[p.serviceType]} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: '#015035' }} />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-500">{formatDate(p.launchDate)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex -space-x-1.5">
                        {p.assignedTeam.map((name, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: i === 0 ? '#015035' : '#6b7280' }}
                            title={name}
                          >
                            {name.split(' ').map(n => n[0]).join('')}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight size={14} className="text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ProjectDetail project={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
