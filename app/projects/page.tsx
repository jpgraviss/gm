'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
// data loaded from API
import { projectStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Project, ProjectStatus } from '@/lib/types'
import {
  X, CheckCircle, Calendar, ChevronRight, LayoutList, KanbanSquare,
  AlertTriangle, TrendingUp, StickyNote, Plus, Globe, BarChart2,
  Share2, Mail, Palette, Wrench, ChevronDown,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const statusOrder: ProjectStatus[] = [
  'Not Started', 'In Progress', 'Awaiting Client', 'Completed', 'Launched', 'In Maintenance',
]

const statusColumnColors: Record<ProjectStatus, string> = {
  'Not Started': '#9ca3af',
  'In Progress': '#3b82f6',
  'Awaiting Client': '#f59e0b',
  'Completed': '#22c55e',
  'Launched': '#10b981',
  'In Maintenance': '#8b5cf6',
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const fill = (pct / 100) * c
  const cx = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke="#015035" strokeWidth="3.5"
        strokeDasharray={`${fill} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text
        x={cx} y={cx + Math.round(size / 10)}
        textAnchor="middle"
        fontSize={Math.round(size / 5)}
        fontWeight="700"
        fill="#015035"
      >
        {pct}%
      </text>
    </svg>
  )
}

// ─── Project Card (Kanban) ────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const completedMilestones = project.milestones.filter(m => m.completed).length
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = project.tasks.filter(t => !t.completed && t.dueDate < today).length
  return (
    <div className="metric-card cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-bold text-gray-900 mb-1 leading-tight">{project.company}</p>
          <StatusBadge label={project.serviceType} colorClass={serviceTypeColors[project.serviceType]} />
        </div>
        <ProgressRing pct={project.progress} />
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500 font-medium">Milestones</span>
          <span className="text-gray-700 font-semibold">{completedMilestones}/{project.milestones.length}</span>
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
        <div className="flex items-center gap-2">
          {overdueTasks > 0 && (
            <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-semibold">
              {overdueTasks} overdue
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={11} />
            {new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Project Detail Panel ─────────────────────────────────────────────────────

function ProjectDetailPanel({
  project,
  onClose,
  onUpdateStatus,
}: {
  project: Project
  onClose: () => void
  onUpdateStatus: (id: string, status: ProjectStatus) => void
}) {
  const [tab, setTab] = useState<'overview' | 'milestones' | 'tasks' | 'notes'>('overview')
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [localTasks, setLocalTasks] = useState(project.tasks)
  const [notes, setNotes] = useState<Array<{ id: string; text: string; date: string; author: string }>>([])
  const [noteText, setNoteText] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = localTasks.filter(t => !t.completed && t.dueDate < today)
  // eslint-disable-next-line react-hooks/purity
  const daysLeft = useMemo(() => Math.max(0, Math.ceil((new Date(project.launchDate).getTime() - Date.now()) / 86400000)), [project.launchDate])
  const isFinished = ['Launched', 'In Maintenance', 'Completed'].includes(project.status)

  const toggleTask = (taskId: string) => {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t))
  }

  const saveNote = () => {
    if (!noteText.trim()) return
    setNotes(prev => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        text: noteText.trim(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        author: 'You',
      },
    ])
    setNoteText('')
    setShowNoteForm(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-1">
                {project.id.toUpperCase()} · Project
              </p>
              <h2 className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                {project.company}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                <StatusBadge label={project.serviceType} colorClass={serviceTypeColors[project.serviceType]} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ProgressRing pct={project.progress} size={54} />
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 ml-1">
                <X size={18} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Milestones', value: `${project.milestones.filter(m => m.completed).length}/${project.milestones.length}` },
              { label: 'Tasks', value: `${localTasks.filter(t => t.completed).length}/${localTasks.length}` },
              { label: 'Days Left', value: isFinished ? '—' : daysLeft.toString() },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'milestones', 'tasks', 'notes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2">
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

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">Overall Progress</span>
                  <span className="text-xs font-bold text-gray-900">{project.progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#015035' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Team</p>
                <div className="flex flex-col gap-2.5">
                  {project.assignedTeam.map((name, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: i === 0 ? '#015035' : '#6b7280' }}
                      >
                        {name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{name}</p>
                        <p className="text-[11px] text-gray-400">{i === 0 ? 'Project Lead' : 'Contributor'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {overdueTasks.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700">
                      {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-red-600 mt-0.5">
                      {overdueTasks.map(t => t.title).join(' · ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Milestones ── */}
          {tab === 'milestones' && (
            <div className="flex flex-col gap-1">
              {project.milestones.map((m, i) => {
                const isLast = i === project.milestones.length - 1
                const nextIncomplete = project.milestones.findIndex(ms => !ms.completed)
                const isCurrent = !m.completed && i === nextIncomplete
                return (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{
                          background: m.completed ? '#015035' : isCurrent ? '#fff' : '#f9fafb',
                          borderColor: m.completed ? '#015035' : isCurrent ? '#015035' : '#e5e7eb',
                        }}
                      >
                        {m.completed
                          ? <CheckCircle size={14} className="text-white" />
                          : <span className="text-[10px] font-bold" style={{ color: isCurrent ? '#015035' : '#9ca3af' }}>{i + 1}</span>
                        }
                      </div>
                      {!isLast && (
                        <div
                          className="w-0.5 flex-1 mt-1"
                          style={{ background: m.completed ? '#015035' : '#e5e7eb', minHeight: '24px' }}
                        />
                      )}
                    </div>
                    <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                      <div className={`p-3 rounded-xl border ${
                        m.completed ? 'border-emerald-100 bg-emerald-50' :
                        isCurrent ? 'border-green-200 bg-green-50/50' :
                        'border-gray-100 bg-gray-50'
                      }`}>
                        <div className="flex justify-between items-start gap-2">
                          <p className={`text-sm font-semibold ${
                            m.completed ? 'text-emerald-700' :
                            isCurrent ? 'text-gray-900' :
                            'text-gray-500'
                          }`}>
                            {m.name}
                          </p>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              CURRENT
                            </span>
                          )}
                          {m.completed && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Due {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Tasks ── */}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-4">
              {localTasks.length === 0 && (
                <div className="py-12 text-center text-gray-400 text-sm">No tasks yet</div>
              )}
              {(['High', 'Medium', 'Low'] as const).map(priority => {
                const priorityTasks = localTasks.filter(t => t.priority === priority)
                if (priorityTasks.length === 0) return null
                const dot = priority === 'High' ? '#ef4444' : priority === 'Medium' ? '#f59e0b' : '#9ca3af'
                return (
                  <div key={priority}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: dot }} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{priority} Priority</span>
                      <span className="text-[10px] text-gray-400">
                        {priorityTasks.filter(t => t.completed).length}/{priorityTasks.length} done
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {priorityTasks.map(task => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${
                            task.completed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer ${
                              task.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400'
                            }`}
                            onClick={() => toggleTask(task.id)}
                          >
                            {task.completed && <span className="text-white text-[8px] font-bold">✓</span>}
                          </div>
                          <span className={`text-sm flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!task.completed && task.dueDate < today && (
                              <span className="text-[10px] text-red-600 font-semibold">Overdue</span>
                            )}
                            <span className="text-xs text-gray-400">{task.assignee.split(' ')[0]}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Notes ── */}
          {tab === 'notes' && (
            <div className="flex flex-col gap-3">
              {notes.length === 0 && !showNoteForm && (
                <div className="py-12 text-center">
                  <StickyNote size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No project notes yet</p>
                  <p className="text-xs text-gray-300 mt-1">Notes and updates will appear here</p>
                </div>
              )}

              {notes.length > 0 && (
                <div className="flex flex-col gap-2">
                  {notes.map(note => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-gray-400 font-semibold">{note.author}</span>
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">{note.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showNoteForm ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-800/30 focus:border-green-800/40"
                    rows={4}
                    placeholder="Write a note..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveNote}
                      className="flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: '#015035' }}
                    >
                      Save Note
                    </button>
                    <button
                      onClick={() => { setShowNoteForm(false); setNoteText('') }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNoteForm(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Note
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0 relative">
          {showStatusPicker && (
            <div className="absolute bottom-full left-4 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-10 min-w-[180px]">
              {statusOrder.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    onUpdateStatus(project.id, s)
                    setShowStatusPicker(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                    project.status === s ? 'font-semibold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColumnColors[s] }} />
                  {s}
                  {project.status === s && <CheckCircle size={12} className="ml-auto text-emerald-500" />}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowStatusPicker(v => !v)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5"
            style={{ background: '#015035' }}
          >
            Update Status
            <ChevronDown size={14} className={`transition-transform ${showStatusPicker ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Service Type Config ──────────────────────────────────────────────────────

type ServiceTypeKey = 'Website' | 'SEO' | 'Social Media' | 'Branding' | 'Email Marketing' | 'Custom'

const serviceTypeIcons: Record<ServiceTypeKey, React.ReactNode> = {
  Website: <Globe size={18} />,
  SEO: <BarChart2 size={18} />,
  'Social Media': <Share2 size={18} />,
  'Email Marketing': <Mail size={18} />,
  Branding: <Palette size={18} />,
  Custom: <Wrench size={18} />,
}

const serviceTypeAccent: Record<ServiceTypeKey, string> = {
  Website: '#3b82f6',
  SEO: '#015035',
  'Social Media': '#ec4899',
  'Email Marketing': '#f59e0b',
  Branding: '#8b5cf6',
  Custom: '#6b7280',
}

// ─── Project Row (list view within a service type group) ──────────────────────

function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const completedMs = project.milestones.filter(m => m.completed).length
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = project.tasks.filter(t => !t.completed && t.dueDate < today).length

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors group"
      onClick={onClick}
    >
      <td className="py-3 px-4">
        <p className="text-sm font-semibold text-gray-900">{project.company}</p>
        <p className="text-xs text-gray-400">{project.id.toUpperCase()}</p>
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: '#015035' }} />
          </div>
          <span className="text-xs text-gray-600 font-semibold">{project.progress}%</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-600 font-medium">{completedMs}/{project.milestones.length}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-500">{formatDate(project.launchDate)}</span>
      </td>
      <td className="py-3 px-4">
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
      </td>
      <td className="py-3 px-4">
        {overdueTasks > 0 ? (
          <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-semibold">
            {overdueTasks} overdue
          </span>
        ) : (
          <span className="text-[10px] text-emerald-600">On track</span>
        )}
      </td>
      <td className="py-3 px-4">
        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
      </td>
    </tr>
  )
}

// ─── Service Type Group ───────────────────────────────────────────────────────

function ServiceTypeGroup({
  serviceType,
  groupProjects,
  onSelect,
  defaultOpen = true,
}: {
  serviceType: ServiceTypeKey
  groupProjects: Project[]
  onSelect: (p: Project) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const icon = serviceTypeIcons[serviceType]
  const accent = serviceTypeAccent[serviceType]
  const avgPct = groupProjects.length > 0
    ? Math.round(groupProjects.reduce((s, p) => s + p.progress, 0) / groupProjects.length)
    : 0
  const inProgress = groupProjects.filter(p => p.status === 'In Progress').length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-bold text-gray-800">{serviceType}</span>
          <span className="ml-2 text-xs text-gray-400">{groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {inProgress > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {inProgress} active
            </span>
          )}
          <span className="font-semibold text-gray-700">{avgPct}% avg</span>
        </div>
        <ChevronDown
          size={15}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Project table */}
      {open && (
        <div className="border-t border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                <th className="text-left py-2 px-4 font-semibold">Company</th>
                <th className="text-left py-2 px-4 font-semibold">Status</th>
                <th className="text-left py-2 px-4 font-semibold">Progress</th>
                <th className="text-left py-2 px-4 font-semibold">Milestones</th>
                <th className="text-left py-2 px-4 font-semibold">Launch</th>
                <th className="text-left py-2 px-4 font-semibold">Team</th>
                <th className="text-left py-2 px-4 font-semibold">Tasks</th>
                <th className="py-2 px-4" />
              </tr>
            </thead>
            <tbody>
              {groupProjects.map(p => (
                <ProjectRow key={p.id} project={p} onClick={() => onSelect(p)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Project) => void }) {
  const [company, setCompany] = useState('')
  const [serviceType, setServiceType] = useState<Project['serviceType']>('Website')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [launchDate, setLaunchDate] = useState('')
  const [team, setTeam] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = company.trim() && launchDate

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const payload = {
      contractId: '',
      company: company.trim(),
      serviceType,
      status: 'Not Started' as ProjectStatus,
      startDate,
      launchDate,
      assignedTeam: team.split(',').map(t => t.trim()).filter(Boolean),
      progress: 0,
      milestones: [],
      tasks: [],
    }
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const saved = await res.json()
        onSave(saved)
      } else {
        onSave({ id: `proj-${Date.now()}`, ...payload } as Project)
      }
    } catch {
      onSave({ id: `proj-${Date.now()}`, ...payload } as Project)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between" style={{ background: '#012b1e' }}>
          <h2 className="text-white text-sm font-bold">New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/60" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Name *</label>
            <input value={company} onChange={e => setCompany(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value as Project['serviceType'])}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              {(['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom'] as const).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Launch Date *</label>
              <input type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned Team (comma-separated)</label>
            <input value={team} onChange={e => setTeam(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" placeholder="Jonathan Graviss, JG Graviss" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            {saving ? 'Creating…' : 'Create Project'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [localProjects, setLocalProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Project | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [serviceFilter, setServiceFilter] = useState<ServiceTypeKey | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All')
  const [view, setView] = useState<'grouped' | 'kanban'>('grouped')

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLocalProjects(data) })
      .catch(() => {})
  }, [])

  const today = new Date().toISOString().split('T')[0]

  function updateProjectStatus(id: string, status: ProjectStatus) {
    setLocalProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    setSelected(prev => prev && prev.id === id ? { ...prev, status } : prev)
    fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }

  // Metrics
  const active = localProjects.filter(p => ['In Progress', 'Awaiting Client', 'Not Started'].includes(p.status))
  const avgProgress = Math.round(localProjects.reduce((s, p) => s + p.progress, 0) / localProjects.length)
  const allOverdue = localProjects.flatMap(p => p.tasks.filter(t => !t.completed && t.dueDate < today))
  const launched = localProjects.filter(p => ['Launched', 'In Maintenance', 'Completed'].includes(p.status))

  // Active service types (ones with projects)
  const activeServiceTypes = (Object.keys(serviceTypeIcons) as ServiceTypeKey[])
    .filter(st => localProjects.some(p => p.serviceType === st))

  // Apply filters
  const filtered = localProjects.filter(p => {
    if (serviceFilter !== 'All' && p.serviceType !== serviceFilter) return false
    if (statusFilter !== 'All' && p.status !== statusFilter) return false
    return true
  })

  const visibleStatuses = statusFilter === 'All' ? statusOrder : [statusFilter]

  return (
    <>
      <Header title="Projects" subtitle="Track delivery across all service lines" action={{ label: 'New Project', onClick: () => setCreatingProject(true) }} />
      <div className="page-content">

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Projects', value: active.length.toString(), icon: <KanbanSquare size={16} />, color: '#015035', sub: 'In progress or queued' },
            { label: 'Avg Completion',  value: `${avgProgress}%`,        icon: <TrendingUp size={16} />,  color: '#3b82f6', sub: 'Across all projects' },
            { label: 'Overdue Tasks',   value: allOverdue.length.toString(), icon: <AlertTriangle size={16} />, color: allOverdue.length > 0 ? '#ef4444' : '#22c55e', sub: allOverdue.length > 0 ? 'Needs attention' : 'All on track' },
            { label: 'Launched / Done', value: launched.length.toString(), icon: <CheckCircle size={16} />, color: '#10b981', sub: 'Completed projects' },
          ].map(m => (
            <div key={m.label} className="kpi-card" style={{ '--kpi-accent': m.color } as React.CSSProperties}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${m.color}15` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.label}</p>
              <p className="text-[11px] text-gray-400 mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Service Type Hub Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          <button
            onClick={() => setServiceFilter('All')}
            className={`metric-card text-left p-3 transition-all ${serviceFilter === 'All' ? 'ring-2 ring-green-800 ring-offset-1' : ''}`}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: '#f3f4f6' }}>
              <KanbanSquare size={15} className="text-gray-500" />
            </div>
            <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{localProjects.length}</p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5">All Types</p>
          </button>

          {activeServiceTypes.map(st => {
            const count = localProjects.filter(p => p.serviceType === st).length
            const accent = serviceTypeAccent[st]
            const inProg = localProjects.filter(p => p.serviceType === st && p.status === 'In Progress').length
            return (
              <button
                key={st}
                onClick={() => setServiceFilter(st)}
                className={`metric-card text-left p-3 transition-all ${serviceFilter === st ? 'ring-2 ring-offset-1' : ''}`}
                style={serviceFilter === st ? { outlineColor: accent } : {}}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: `${accent}18` }}>
                  <span style={{ color: accent }}>{serviceTypeIcons[st]}</span>
                </div>
                <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{count}</p>
                <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{st}</p>
                {inProg > 0 && (
                  <p className="text-[10px] text-blue-500 mt-0.5">{inProg} active</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          <div className="flex gap-1">
            <button onClick={() => setView('grouped')} className={`tab-btn ${view === 'grouped' ? 'active' : ''}`}>
              <span className="flex items-center gap-1.5"><LayoutList size={13} /> Grouped</span>
            </button>
            <button onClick={() => setView('kanban')} className={`tab-btn ${view === 'kanban' ? 'active' : ''}`}>
              <span className="flex items-center gap-1.5"><KanbanSquare size={13} /> Kanban</span>
            </button>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status:</span>
          <button onClick={() => setStatusFilter('All')} className={`tab-btn ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
          {statusOrder.map(s => {
            const count = filtered.filter(p => p.status === s).length
            return (
              <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>
                {s} {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
              </button>
            )
          })}
          <span className="ml-auto text-sm text-gray-500">{filtered.length} projects</span>
        </div>

        {/* Grouped View — service type sections */}
        {view === 'grouped' && (
          <div className="flex flex-col gap-4">
            {serviceFilter === 'All' ? (
              activeServiceTypes
                .filter(st => filtered.some(p => p.serviceType === st))
                .map(st => (
                  <ServiceTypeGroup
                    key={st}
                    serviceType={st}
                    groupProjects={filtered.filter(p => p.serviceType === st)}
                    onSelect={setSelected}
                  />
                ))
            ) : (
              <ServiceTypeGroup
                serviceType={serviceFilter}
                groupProjects={filtered}
                onSelect={setSelected}
                defaultOpen
              />
            )}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <KanbanSquare size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">No projects match this filter</p>
              </div>
            )}
          </div>
        )}

        {/* Kanban View — status columns */}
        {view === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {visibleStatuses.map(status => {
              const cols = filtered.filter(p => p.status === status)
              return (
                <div key={status} className="flex-shrink-0 w-[280px]">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColumnColors[status] }} />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{status}</span>
                    <span
                      className="ml-auto text-xs font-bold text-white px-1.5 py-0.5 rounded-full min-w-5 text-center"
                      style={{ background: statusColumnColors[status], fontSize: '10px' }}
                    >
                      {cols.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {cols.map(p => (
                      <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
                    ))}
                    {cols.length === 0 && (
                      <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">
                        No projects
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <ProjectDetailPanel
          project={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateProjectStatus}
        />
      )}

      {creatingProject && (
        <NewProjectModal
          onClose={() => setCreatingProject(false)}
          onSave={p => setLocalProjects(prev => [p, ...prev])}
        />
      )}
    </>
  )
}
