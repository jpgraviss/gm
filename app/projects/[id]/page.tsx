'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import StatusBadge from '@/components/ui/StatusBadge'
import { projectStatusColors, formatDate } from '@/lib/utils'
import { SERVICE_NAMES, serviceTypeColors } from '@/lib/services'
import type { Project, ProjectStatus, AppTask, AppTaskStatus, TaskPriority } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { useTeamMembers } from '@/lib/useTeamMembers'
import FileUpload from '@/components/ui/FileUpload'
import CompanySelect from '@/components/ui/CompanySelect'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  ArrowLeft, Plus, X, CheckCircle2, Clock, Circle, LayoutList, Columns3,
  MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, Calendar,
  Users, Flag, AlertTriangle, CheckSquare, Settings,
  Globe, BarChart2, Share2, Mail, Palette, Wrench, StickyNote,
  FolderKanban, Milestone as MilestoneIcon, FileText, Briefcase, TrendingUp,
} from 'lucide-react'

type ViewMode = 'list' | 'board' | 'overview' | 'files'

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

const priorityConfig: Record<TaskPriority, { color: string; bg: string; label: string }> = {
  High:   { color: '#ef4444', bg: 'bg-red-50 text-red-700',    label: 'High' },
  Medium: { color: '#f59e0b', bg: 'bg-yellow-50 text-yellow-700', label: 'Medium' },
  Low:    { color: '#9ca3af', bg: 'bg-gray-100 text-gray-500',   label: 'Low' },
}

const taskStatusConfig: Record<AppTaskStatus, { icon: React.ReactNode; color: string; label: string }> = {
  Pending:       { icon: <Circle size={14} />,       color: '#9ca3af', label: 'To Do' },
  'In Progress': { icon: <Clock size={14} />,         color: '#3b82f6', label: 'In Progress' },
  Completed:     { icon: <CheckCircle2 size={14} />, color: '#22c55e', label: 'Done' },
}

const serviceTypeIcons: Partial<Record<string, React.ReactNode>> = {
  'Website Build': <Globe size={14} />,
  'Website Management': <Globe size={14} />,
  'SEO / AEO': <BarChart2 size={14} />,
  'Social Media': <Share2 size={14} />,
  'Email Marketing': <Mail size={14} />,
  'Fractional CMO': <Briefcase size={14} />,
  'Sales Training': <TrendingUp size={14} />,
  'Sales Enablement': <Briefcase size={14} />,
  'Sales Coaching': <TrendingUp size={14} />,
  'Sales Enablement Support': <Briefcase size={14} />,
  'Fractional Sales Lead / CRO': <Briefcase size={14} />,
  // Legacy values, kept so pre-existing project records still show an icon
  Website: <Globe size={14} />,
  SEO: <BarChart2 size={14} />,
  Branding: <Palette size={14} />,
  Custom: <Wrench size={14} />,
}

interface ProjectFile {
  name: string; size: number; url: string; path: string; type: string; createdAt?: string
}

// Shared with the initial load effect and with refetchProject() (AUDIT.md
// #294) so a failed PATCH's reconciliation fetch maps the response the same
// way the page does on first load.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjectResponse(proj: any): Project {
  return {
    id: proj.id,
    contractId: proj.contract_id ?? proj.contractId ?? '',
    company: proj.company,
    serviceType: proj.service_type ?? proj.serviceType,
    status: proj.status,
    startDate: proj.start_date ?? proj.startDate ?? '',
    launchDate: proj.launch_date ?? proj.launchDate ?? '',
    maintenanceStartDate: proj.maintenance_start_date ?? proj.maintenanceStartDate,
    assignedTeam: proj.assigned_team ?? proj.assignedTeam ?? [],
    progress: proj.progress ?? 0,
    milestones: proj.milestones ?? [],
    tasks: proj.tasks ?? [],
    notes: proj.notes ?? [],
    overview: proj.overview ?? '',
    sections: proj.sections ?? ['To Do', 'In Progress', 'Done'],
    color: proj.color ?? '#015035',
    description: proj.description ?? '',
  }
}

function TaskRow({
  task,
  onToggle,
  onSelect,
  projectColor,
}: {
  task: AppTask
  onToggle: () => void
  onSelect: () => void
  projectColor: string
}) {
  const isCompleted = task.status === 'Completed'
  const overdue = !isCompleted && task.dueDate && task.dueDate < new Date().toISOString().split('T')[0]
  const pri = priorityConfig[task.priority]

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}
      onClick={onSelect}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle() }}
        className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isCompleted
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-gray-300 hover:border-emerald-400'
        }`}
      >
        {isCompleted && <CheckCircle2 size={10} className="text-white" />}
      </button>
      <span className={`flex-1 text-sm min-w-0 truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
        {task.title}
      </span>
      <div className="flex items-center gap-3 flex-shrink-0">
        {task.assignedTo && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: projectColor }}
            title={task.assignedTo}
          >
            {task.assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        )}
        {task.dueDate && (
          <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
            {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pri.color }} title={pri.label} />
      </div>
    </div>
  )
}

function SectionGroup({
  sectionName,
  tasks,
  onToggleTask,
  onSelectTask,
  onAddTask,
  onDeleteSection,
  onRenameSection,
  projectColor,
  isCollapsed,
  onToggleCollapse,
}: {
  sectionName: string
  tasks: AppTask[]
  onToggleTask: (id: string) => void
  onSelectTask: (task: AppTask) => void
  onAddTask: (section: string) => void
  onDeleteSection: (section: string) => void
  onRenameSection: (oldName: string, newName: string) => void
  projectColor: string
  isCollapsed: boolean
  onToggleCollapse: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sectionName)
  const completed = tasks.filter(t => t.status === 'Completed').length

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 py-2 group">
        <button onClick={onToggleCollapse} className="flex-shrink-0">
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </button>
        {editing ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== sectionName) onRenameSection(sectionName, name.trim()); setEditing(false) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(sectionName); setEditing(false) } }}
            autoFocus
            className="text-sm font-bold text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-emerald-600 outline-none px-0.5 py-0"
          />
        ) : (
          <h3
            className="text-sm font-bold text-gray-800 cursor-pointer hover:text-gray-600"
            onClick={() => setEditing(true)}
          >
            {sectionName}
          </h3>
        )}
        <span className="text-xs text-gray-400 font-medium">{completed}/{tasks.length}</span>
        <div className="flex-1" />
        <button
          onClick={() => onDeleteSection(sectionName)}
          className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete section"
        >
          <Trash2 size={12} className="text-gray-300 hover:text-red-500" />
        </button>
      </div>
      {!isCollapsed && (
        <div className="bg-white rounded-xl border border-gray-200 mx-2 overflow-hidden">
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => onToggleTask(task.id)}
              onSelect={() => onSelectTask(task)}
              projectColor={projectColor}
            />
          ))}
          {tasks.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-300">No tasks in this section</div>
          )}
          <button
            onClick={() => onAddTask(sectionName)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Plus size={14} /> Add task...
          </button>
        </div>
      )}
    </div>
  )
}

function BoardColumn({
  status,
  tasks,
  onToggleTask,
  onSelectTask,
  projectColor,
}: {
  status: AppTaskStatus
  tasks: AppTask[]
  onToggleTask: (id: string) => void
  onSelectTask: (task: AppTask) => void
  projectColor: string
}) {
  const cfg = taskStatusConfig[status]
  return (
    <div className="flex flex-col min-w-[260px] max-w-[320px] flex-1">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="text-sm font-semibold text-gray-700">{cfg.label}</span>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div className="flex-1 bg-gray-50/70 rounded-xl p-2.5 flex flex-col gap-2 border border-gray-100 min-h-[200px]">
        {tasks.map(task => {
          const pri = priorityConfig[task.priority]
          const overdue = task.status !== 'Completed' && task.dueDate && task.dueDate < new Date().toISOString().split('T')[0]
          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task)}
              className={`bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all group ${overdue ? 'border-red-200' : 'border-gray-150 hover:border-gray-300'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); onToggleTask(task.id) }}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      task.status === 'Completed' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400'
                    }`}
                  >
                    {task.status === 'Completed' && <span className="text-white text-[7px] font-bold">✓</span>}
                  </button>
                  <p className={`text-sm font-medium leading-snug ${task.status === 'Completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                </div>
              </div>
              {task.section && (
                <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 mb-2 inline-block">{task.section}</span>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  {task.assignedTo && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ background: projectColor }}
                      title={task.assignedTo}
                    >
                      {task.assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {task.dueDate && (
                    <span className={`text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className="w-2 h-2 rounded-full" style={{ background: pri.color }} title={pri.label} />
                </div>
              </div>
            </div>
          )
        })}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-xs text-gray-300">No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  teamMembers,
  sections,
  projectColor,
}: {
  task: AppTask
  onClose: () => void
  onUpdate: (id: string, updates: Partial<AppTask>) => void
  onDelete: (id: string) => void
  teamMembers: string[]
  sections: string[]
  projectColor: string
}) {
  const [editTitle, setEditTitle] = useState(task.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editDesc, setEditDesc] = useState(task.description ?? '')
  const [editingDesc, setEditingDesc] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>
        <div className="p-5 flex-shrink-0" style={{ background: projectColor }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityConfig[task.priority].bg}`}>{task.priority}</span>
              {task.section && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white/20 text-white">{task.section}</span>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X size={18} className="text-white/60" />
            </button>
          </div>
          {editingTitle ? (
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => { if (editTitle.trim() && editTitle !== task.title) onUpdate(task.id, { title: editTitle.trim() }); setEditingTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              autoFocus
              className="w-full text-lg font-bold text-white bg-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          ) : (
            <h2 className="text-white text-lg font-bold cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 -mx-1" onClick={() => { setEditTitle(task.title); setEditingTitle(true) }}>
              {task.title}
            </h2>
          )}
          {editingDesc ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onBlur={() => { onUpdate(task.id, { description: editDesc.trim() || undefined }); setEditingDesc(false) }}
              autoFocus rows={3}
              className="w-full text-sm text-white bg-white/10 rounded-lg px-2 py-1.5 mt-2 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
              placeholder="Add description..."
            />
          ) : (
            <p className="text-white/50 text-sm mt-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 -mx-1 min-h-[24px]" onClick={() => { setEditDesc(task.description ?? ''); setEditingDesc(true) }}>
              {task.description || 'Click to add description...'}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Status</label>
                <select
                  value={task.status}
                  onChange={e => onUpdate(task.id, {
                    status: e.target.value as AppTaskStatus,
                    completedDate: e.target.value === 'Completed' ? new Date().toISOString().split('T')[0] : undefined,
                  })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Pending">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Priority</label>
                <select
                  value={task.priority}
                  onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Assignee</label>
                <select
                  value={task.assignedTo}
                  onChange={e => onUpdate(task.id, { assignedTo: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Due Date</label>
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={e => onUpdate(task.id, { dueDate: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Section</label>
              <select
                value={task.section ?? ''}
                onChange={e => onUpdate(task.id, { section: e.target.value || undefined })}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">No section</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {task.completedDate && (
            <p className="text-xs text-emerald-600 font-medium mt-4 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Completed on {task.completedDate}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {task.status !== 'Completed' ? (
            <button
              onClick={() => onUpdate(task.id, { status: 'Completed', completedDate: new Date().toISOString().split('T')[0] })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: projectColor }}
            >
              <CheckCircle2 size={14} /> Mark Complete
            </button>
          ) : (
            <button
              onClick={() => onUpdate(task.id, { status: 'Pending', completedDate: undefined })}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              Reopen
            </button>
          )}
          <button
            onClick={() => { onDelete(task.id); onClose() }}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
            title="Delete task"
          >
            <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddTaskInline({
  section,
  onAdd,
  onCancel,
  teamMembers,
}: {
  section: string
  onAdd: (task: { title: string; section: string; assignedTo: string; dueDate: string; priority: TaskPriority }) => void
  onCancel: () => void
  teamMembers: string[]
}) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(teamMembers[0] ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('Medium')

  return (
    <div className="mx-2 bg-white rounded-xl border-2 border-emerald-200 p-4 flex flex-col gap-3 shadow-sm">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task name..."
        autoFocus
        className="w-full text-sm font-medium border-none outline-none placeholder-gray-400 text-gray-900"
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onAdd({ title: title.trim(), section, assignedTo: assignee, dueDate, priority }); setTitle('') } if (e.key === 'Escape') onCancel() }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select value={assignee} onChange={e => setAssignee(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
          <option value="">Unassigned</option>
          {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
        <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => { if (title.trim()) onAdd({ title: title.trim(), section, assignedTo: assignee, dueDate, priority }) }}
          disabled={!title.trim()}
          className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-40"
          style={{ background: '#015035' }}
        >
          Add
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ProjectSettingsModal({
  project,
  onClose,
  onUpdate,
}: {
  project: Project
  onClose: () => void
  onUpdate: (updates: Partial<Project>) => void
}) {
  const teamMembers = useTeamMembers()
  const [company, setCompany] = useState(project.company)
  const [companyId, setCompanyId] = useState<string | null | undefined>(project.companyId)
  const [serviceType, setServiceType] = useState(project.serviceType)
  const [status, setStatus] = useState(project.status)
  const [startDate, setStartDate] = useState(project.startDate)
  const [launchDate, setLaunchDate] = useState(project.launchDate)
  const [color, setColor] = useState(project.color ?? '#015035')
  const [selectedTeam, setSelectedTeam] = useState(project.assignedTeam)
  const [description, setDescription] = useState(project.description ?? '')
  const [overview, setOverview] = useState(project.overview ?? '')

  const colors = ['#015035', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Project Settings</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company</label>
            <CompanySelect value={company} onChange={(name, id) => { setCompany(name); setCompanyId(id ?? null) }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" placeholder="Project description..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overview</label>
            <textarea value={overview} onChange={e => setOverview(e.target.value.slice(0, 5000))} rows={4} maxLength={5000} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-y" placeholder="Longer-form project overview, shown on the Overview tab..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value as Project['serviceType'])} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white">
                {SERVICE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as ProjectStatus)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white">
                {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Launch Date</label>
              <input type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Team</label>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map(m => (
                <label key={m} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedTeam.includes(m) ? 'bg-emerald-50 border-emerald-600 text-emerald-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedTeam.includes(m)} onChange={e => setSelectedTeam(prev => e.target.checked ? [...prev, m] : prev.filter(x => x !== m))} className="hidden" />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { onUpdate({ company, companyId, serviceType, status, startDate, launchDate, color, assignedTeam: selectedTeam, description, overview }); onClose() }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ background: color }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const allTeamMembers = useTeamMembers()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedTask, setSelectedTask] = useState<AppTask | null>(null)
  const [addingToSection, setAddingToSection] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [newSectionName, setNewSectionName] = useState('')
  const [showAddSection, setShowAddSection] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneDue, setNewMilestoneDue] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/tasks?projectId=${id}&limit=500`).then(r => r.ok ? r.json() : []),
    ]).then(([proj, taskData]) => {
      if (proj && !proj.error) {
        setProject(mapProjectResponse(proj))
      }
      const list = Array.isArray(taskData) ? taskData : (taskData?.data ?? [])
      setTasks(list)
    }).catch(() => toast('Failed to load project', 'error'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const projectColor = project?.color ?? '#015035'
  const sections = project?.sections ?? ['To Do', 'In Progress', 'Done']

  const tasksBySection = useMemo(() => {
    const map: Record<string, AppTask[]> = {}
    for (const s of sections) map[s] = []
    map['Unsorted'] = []
    for (const t of tasks) {
      const sec = t.section && sections.includes(t.section) ? t.section : 'Unsorted'
      if (!map[sec]) map[sec] = []
      map[sec].push(t)
    }
    return map
  }, [tasks, sections])

  const tasksByStatus = useMemo(() => {
    const map: Record<AppTaskStatus, AppTask[]> = { Pending: [], 'In Progress': [], Completed: [] }
    for (const t of tasks) map[t.status]?.push(t)
    return map
  }, [tasks])

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'Completed').length
  const overdueTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]).length
  const computedProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : project?.progress ?? 0

  // AUDIT.md #294 — reverting to a `previous` closure snapshot on failure is
  // itself a race: if two edits to the same task fire back-to-back and the
  // first request's failure arrives after the second already succeeded,
  // reverting to the first's stale snapshot would clobber the second's
  // (already-persisted) result in the UI. There's no single-task GET
  // endpoint, so on failure these refetch this project's task list (the
  // same scoped call the page uses on load) and merge only the ONE
  // affected task's fresh server state back into local state, leaving
  // every other task (including any other edit that's mid-flight)
  // untouched.
  const refetchTask = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks?projectId=${id}&limit=500`)
      const data = res.ok ? await res.json() : []
      const list: AppTask[] = Array.isArray(data) ? data : (data?.data ?? [])
      const match = list.find(t => t.id === taskId)
      if (match) {
        setTasks(prev => prev.map(t => t.id === taskId ? match : t))
        setSelectedTask(prev => prev?.id === taskId ? match : prev)
      } else {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setSelectedTask(prev => prev?.id === taskId ? null : prev)
      }
    } catch {
      // Best-effort reconciliation; if this also fails we simply leave the
      // (already-optimistic) local state as-is rather than guessing.
    }
  }, [id])

  const toggleTaskStatus = useCallback((taskId: string) => {
    const previous = tasks.find(t => t.id === taskId)
    if (!previous) return
    const newStatus: AppTaskStatus = previous.status === 'Completed' ? 'Pending' : 'Completed'
    const completedDate = newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : undefined
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, completedDate } : t))
    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completedDate: completedDate ?? null }),
    }).then(res => {
      if (!res.ok) throw new Error('Failed')
    }).catch(() => {
      refetchTask(taskId)
      toast('Failed to update task', 'error')
    })
  }, [tasks, toast, refetchTask])

  const updateTask = useCallback((taskId: string, updates: Partial<AppTask>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, ...updates } : prev)
    const apiBody: Record<string, unknown> = {}
    if (updates.title !== undefined) apiBody.title = updates.title
    if (updates.description !== undefined) apiBody.description = updates.description
    if (updates.priority !== undefined) apiBody.priority = updates.priority
    if (updates.status !== undefined) apiBody.status = updates.status
    if (updates.assignedTo !== undefined) apiBody.assignedTo = updates.assignedTo
    if (updates.dueDate !== undefined) apiBody.dueDate = updates.dueDate
    if (updates.section !== undefined) apiBody.section = updates.section
    if (updates.completedDate !== undefined) apiBody.completedDate = updates.completedDate ?? null
    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    }).then(res => {
      if (!res.ok) throw new Error('Failed')
    }).catch(() => {
      refetchTask(taskId)
      toast('Failed to update task', 'error')
    })
  }, [toast, refetchTask])

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }).then(res => {
      if (!res.ok) throw new Error('Failed')
    }).catch(() => {
      refetchTask(taskId)
      toast('Failed to delete task', 'error')
    })
  }, [toast, refetchTask])

  const addTask = useCallback((data: { title: string; section: string; assignedTo: string; dueDate: string; priority: TaskPriority }) => {
    const newTask: AppTask = {
      id: `task-${Date.now()}`,
      title: data.title,
      category: 'Project',
      priority: data.priority,
      status: 'Pending',
      assignedTo: data.assignedTo,
      dueDate: data.dueDate,
      createdDate: new Date().toISOString().split('T')[0],
      projectId: id,
      section: data.section,
      sortOrder: tasks.length,
    }
    setTasks(prev => [...prev, newTask])
    setAddingToSection(null)
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    }).then(res => {
      if (!res.ok) throw new Error('Failed')
    }).catch(() => {
      setTasks(prev => prev.filter(t => t.id !== newTask.id))
      toast('Failed to create task', 'error')
    })
  }, [id, tasks.length, toast])

  // AUDIT.md #294 — reverting to the `previous` ref snapshot on failure is
  // itself a race: if two updates to the project fire back-to-back and the
  // first request's failure arrives after the second already succeeded,
  // reverting to the first's stale snapshot would clobber the second's
  // (already-persisted) result in the UI. Unlike the tasks/records handlers
  // elsewhere in this file, a real single-record GET exists for projects
  // (`/api/projects/[id]`), so on failure we refetch and re-map the
  // authoritative server state instead of trusting a pre-edit snapshot.
  const refetchProject = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/projects/${id}`)
      const proj = res.ok ? await res.json() : null
      if (proj && !proj.error) setProject(mapProjectResponse(proj))
    } catch {
      // Best-effort reconciliation; if this also fails we simply leave the
      // (already-optimistic) local state as-is rather than guessing.
    }
  }, [id])

  const updateProject = useCallback((updates: Partial<Project>) => {
    // AUDIT #293 — this previously fired the PATCH fetch as a side effect
    // inside the setProject updater callback. React's contract requires
    // updaters to be pure (it invokes them twice under StrictMode in dev,
    // and may re-invoke them in other batching scenarios), so that risked
    // firing the same PATCH request more than once per call. Fire the fetch
    // as a normal statement instead.
    setProject(prev => (prev ? { ...prev, ...updates } as Project : prev))
    fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(res => {
      if (!res.ok) throw new Error('Failed')
    }).catch(() => {
      refetchProject()
      toast('Failed to update project', 'error')
    })
  }, [id, toast, refetchProject])

  const deleteProject = useCallback(async () => {
    if (!id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('Failed to delete project', 'error')
        setDeleting(false)
        return
      }
      toast('Project deleted', 'success')
      router.push('/projects')
    } catch {
      toast('Failed to delete project', 'error')
      setDeleting(false)
    }
  }, [id, router, toast])

  const toggleMilestone = useCallback((milestoneId: string) => {
    if (!project) return
    const updated = project.milestones.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m)
    updateProject({ milestones: updated })
  }, [project, updateProject])

  const addMilestone = useCallback(() => {
    if (!project || !newMilestoneName.trim() || !newMilestoneDue) return
    const newMilestone = { id: `ms-${Date.now()}`, name: newMilestoneName.trim(), dueDate: newMilestoneDue, completed: false }
    updateProject({ milestones: [...project.milestones, newMilestone] })
    setNewMilestoneName('')
    setNewMilestoneDue('')
    setShowAddMilestone(false)
  }, [project, newMilestoneName, newMilestoneDue, updateProject])

  // AUDIT #225 — addMilestone/addNote had no corresponding delete path, so
  // once created either was permanent short of a DB admin.
  const deleteMilestone = useCallback((milestoneId: string) => {
    if (!project) return
    updateProject({ milestones: project.milestones.filter(m => m.id !== milestoneId) })
  }, [project, updateProject])

  const addNote = useCallback(() => {
    if (!project || !noteText.trim()) return
    const newNote = {
      id: `note-${Date.now()}`,
      text: noteText.trim(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: 'You',
    }
    updateProject({ notes: [...(project.notes ?? []), newNote] })
    setNoteText('')
    setShowNoteForm(false)
  }, [project, noteText, updateProject])

  const deleteNote = useCallback((noteId: string) => {
    if (!project) return
    updateProject({ notes: (project.notes ?? []).filter(n => n.id !== noteId) })
  }, [project, updateProject])

  const addSection = useCallback((name: string) => {
    if (!name.trim() || sections.includes(name.trim())) return
    const newSections = [...sections, name.trim()]
    updateProject({ sections: newSections })
    setShowAddSection(false)
    setNewSectionName('')
  }, [sections, updateProject])

  const deleteSection = useCallback((name: string) => {
    const sectionTasks = tasks.filter(t => t.section === name)
    if (sectionTasks.length > 0) {
      for (const t of sectionTasks) {
        updateTask(t.id, { section: sections[0] })
      }
    }
    updateProject({ sections: sections.filter(s => s !== name) })
  }, [sections, tasks, updateProject, updateTask])

  const renameSection = useCallback((oldName: string, newName: string) => {
    const newSections = sections.map(s => s === oldName ? newName : s)
    updateProject({ sections: newSections })
    for (const t of tasks.filter(tk => tk.section === oldName)) {
      updateTask(t.id, { section: newName })
    }
  }, [sections, tasks, updateProject, updateTask])

  useEffect(() => {
    if (!project || !id) return
    if (project.progress !== computedProgress) {
      fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: computedProgress }),
      }).catch(() => {})
    }
  }, [computedProgress, project, id])

  if (loading) return <LoadingScreen />
  if (!project) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <FolderKanban size={40} className="text-gray-300" />
      <p className="text-sm text-gray-500">Project not found</p>
      <Link href="/projects" className="text-sm text-emerald-600 hover:underline">Back to projects</Link>
    </div>
  )

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/projects" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-3 h-3 rounded" style={{ background: projectColor }} />
                <h1 className="text-lg font-bold text-gray-900 truncate">{project.company}</h1>
                <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                <StatusBadge label={project.serviceType} colorClass={serviceTypeColors[project.serviceType]} />
              </div>
              {project.description && <p className="text-xs text-gray-400 mt-1 truncate">{project.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex -space-x-2">
                {project.assignedTeam.slice(0, 4).map((name, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                    style={{ background: i === 0 ? projectColor : ['#3b82f6', '#8b5cf6', '#6b7280'][i - 1] ?? '#6b7280' }}
                    title={name}
                  >
                    {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                ))}
              </div>
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title="Project settings">
                <Settings size={16} />
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete project">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckSquare size={12} />
              <span><b className="text-gray-800">{completedTasks}</b>/{totalTasks} tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${computedProgress}%`, background: projectColor }} />
              </div>
              <span className="font-bold text-gray-800">{computedProgress}%</span>
            </div>
            {overdueTasks > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <AlertTriangle size={12} /> {overdueTasks} overdue
              </span>
            )}
            {project.startDate && <span><Calendar size={11} className="inline mr-1" />{formatDate(project.startDate)} — {project.launchDate ? formatDate(project.launchDate) : 'TBD'}</span>}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-[1px]">
            {([
              { key: 'list' as ViewMode, icon: <LayoutList size={14} />, label: 'List' },
              { key: 'board' as ViewMode, icon: <Columns3 size={14} />, label: 'Board' },
              { key: 'overview' as ViewMode, icon: <FolderKanban size={14} />, label: 'Overview' },
              { key: 'files' as ViewMode, icon: <FileText size={14} />, label: 'Files' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  viewMode === tab.key
                    ? 'border-current text-gray-900 bg-gray-50'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                style={viewMode === tab.key ? { borderColor: projectColor } : {}}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            {(viewMode === 'list' || viewMode === 'board') && (
              <button
                onClick={() => {
                  const sec = sections[0] ?? 'To Do'
                  setAddingToSection(sec)
                  setViewMode('list')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-semibold"
                style={{ background: projectColor }}
              >
                <Plus size={14} /> Add Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5">
        {viewMode === 'list' && (
          <div>
            {sections.map(sec => (
              <SectionGroup
                key={sec}
                sectionName={sec}
                tasks={tasksBySection[sec] ?? []}
                onToggleTask={toggleTaskStatus}
                onSelectTask={setSelectedTask}
                onAddTask={setAddingToSection}
                onDeleteSection={deleteSection}
                onRenameSection={renameSection}
                projectColor={projectColor}
                isCollapsed={collapsedSections.has(sec)}
                onToggleCollapse={() => setCollapsedSections(prev => {
                  const next = new Set(prev)
                  if (next.has(sec)) next.delete(sec)
                  else next.add(sec)
                  return next
                })}
              />
            ))}
            {(tasksBySection['Unsorted']?.length ?? 0) > 0 && (
              <SectionGroup
                sectionName="Unsorted"
                tasks={tasksBySection['Unsorted']}
                onToggleTask={toggleTaskStatus}
                onSelectTask={setSelectedTask}
                onAddTask={setAddingToSection}
                onDeleteSection={() => {}}
                onRenameSection={() => {}}
                projectColor={projectColor}
                isCollapsed={collapsedSections.has('Unsorted')}
                onToggleCollapse={() => setCollapsedSections(prev => {
                  const next = new Set(prev)
                  if (next.has('Unsorted')) next.delete('Unsorted')
                  else next.add('Unsorted')
                  return next
                })}
              />
            )}

            {addingToSection && (
              <AddTaskInline
                section={addingToSection}
                onAdd={addTask}
                onCancel={() => setAddingToSection(null)}
                teamMembers={allTeamMembers}
              />
            )}

            {showAddSection ? (
              <div className="flex items-center gap-2 mt-4 px-4">
                <input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  placeholder="Section name..."
                  autoFocus
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600 flex-1"
                  onKeyDown={e => { if (e.key === 'Enter' && newSectionName.trim()) addSection(newSectionName.trim()); if (e.key === 'Escape') { setShowAddSection(false); setNewSectionName('') } }}
                />
                <button
                  onClick={() => { if (newSectionName.trim()) addSection(newSectionName.trim()) }}
                  disabled={!newSectionName.trim()}
                  className="px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
                  style={{ background: projectColor }}
                >
                  Add
                </button>
                <button onClick={() => { setShowAddSection(false); setNewSectionName('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddSection(true)}
                className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Add Section
              </button>
            )}
          </div>
        )}

        {viewMode === 'board' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {(['Pending', 'In Progress', 'Completed'] as AppTaskStatus[]).map(status => (
              <BoardColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onToggleTask={toggleTaskStatus}
                onSelectTask={setSelectedTask}
                projectColor={projectColor}
              />
            ))}
          </div>
        )}

        {viewMode === 'overview' && (
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {/* AUDIT #252 — project.overview round-tripped through the API
                and client mapping but was never rendered anywhere, easy to
                miss given this tab is also named "Overview". */}
            {project.overview && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Overview</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{project.overview}</p>
              </div>
            )}

            {/* Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
                <span className="text-sm font-bold" style={{ color: projectColor }}>{computedProgress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${computedProgress}%`, background: projectColor }} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-xl font-bold text-gray-900">{totalTasks}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Tasks</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                  <p className="text-xl font-bold text-emerald-700">{completedTasks}</p>
                  <p className="text-[10px] text-emerald-600 uppercase font-semibold">Completed</p>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background: overdueTasks > 0 ? '#fef2f2' : '#f9fafb' }}>
                  <p className={`text-xl font-bold ${overdueTasks > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdueTasks}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Overdue</p>
                </div>
              </div>
            </div>

            {/* Dates & Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Start Date', value: project.startDate ? formatDate(project.startDate) : 'Not set' },
                  { label: 'Launch Date', value: project.launchDate ? formatDate(project.launchDate) : 'Not set' },
                  { label: 'Service', value: project.serviceType },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Team */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Team</h3>
              <div className="flex flex-col gap-2.5">
                {project.assignedTeam.map((name, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: i === 0 ? projectColor : '#6b7280' }}>
                      {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{name}</p>
                      <p className="text-[11px] text-gray-400">{i === 0 ? 'Project Lead' : 'Contributor'}</p>
                    </div>
                  </div>
                ))}
                {project.assignedTeam.length === 0 && <p className="text-sm text-gray-400">No team members assigned</p>}
              </div>
            </div>

            {/* Milestones */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Milestones</h3>
              {project.milestones.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {project.milestones.map((m, i) => (
                    <div
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${m.completed ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/60' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                    >
                      <button onClick={() => toggleMilestone(m.id)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {m.completed ? <CheckCircle2 size={12} /> : i + 1}
                        </div>
                        <span className={`text-sm flex-1 truncate ${m.completed ? 'text-emerald-700' : 'text-gray-800'}`}>{m.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(m.dueDate)}</span>
                      </button>
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {showAddMilestone ? (
                <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                    placeholder="Milestone name"
                    value={newMilestoneName}
                    onChange={e => setNewMilestoneName(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                    value={newMilestoneDue}
                    onChange={e => setNewMilestoneDue(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={addMilestone} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: projectColor }}>Add</button>
                    <button
                      onClick={() => { setShowAddMilestone(false); setNewMilestoneName(''); setNewMilestoneDue('') }}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddMilestone(true)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Milestone
                </button>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
              {(project.notes ?? []).length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {project.notes!.map(note => (
                    <div key={note.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{note.author} · {note.date}</p>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
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
                    <button onClick={addNote} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: projectColor }}>
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
          </div>
        )}

        {viewMode === 'files' && (
          <div className="max-w-2xl mx-auto">
            <ProjectFilesSection company={project.company} />
          </div>
        )}
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          teamMembers={allTeamMembers}
          sections={sections}
          projectColor={projectColor}
        />
      )}

      {/* Project settings modal */}
      {showSettings && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onUpdate={updateProject}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete Project?"
          description={`This will permanently delete ${project.company}. This action cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          onConfirm={deleteProject}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

function ProjectFilesSection({ company }: { company: string }) {
  const { toast } = useToast()
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/files?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setFiles(data.map((f: ProjectFile) => ({ ...f, type: f.type ?? '' }))) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [company])

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading files...</div>

  return (
    <FileUpload
      company={company}
      files={files}
      onUpload={file => setFiles(prev => [file, ...prev])}
      onRemove={file => {
        setFiles(prev => prev.filter(f => f.path !== file.path))
        fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: file.path }) })
          .then(res => {
            if (!res.ok) throw new Error('Failed')
          })
          .catch(() => {
            setFiles(prev => [file, ...prev])
            toast('Failed to remove file', 'error')
          })
      }}
    />
  )
}
