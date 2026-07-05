'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { fetchTeamMembers } from '@/lib/supabase'
import type { AppTask, AppTaskCategory, AppTaskStatus, TaskPriority, TeamMember, TeamServiceLine } from '@/lib/types'
import {
  CheckSquare, Clock, AlertCircle, CheckCircle2, Plus, X, ChevronRight, ChevronLeft,
  Building2, User, Calendar, Flag, Tag, Trash2, Circle, Repeat, Search,
  LayoutList, Columns3, Eye, Copy, Mail,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const categoryColors: Record<AppTaskCategory, string> = {
  Deal:     'bg-blue-100 text-blue-700',
  Contract: 'bg-green-100 text-green-700',
  Billing:  'bg-orange-100 text-orange-700',
  Renewal:  'bg-purple-100 text-purple-700',
  Project:  'bg-indigo-100 text-indigo-700',
  Ticket:   'bg-yellow-100 text-yellow-700',
  Email:    'bg-sky-100 text-sky-700',
  General:  'bg-gray-100 text-gray-600',
}

const priorityConfig: Record<TaskPriority, { badge: string; dot: string; label: string }> = {
  High:   { badge: 'bg-red-100 text-red-700',    dot: '#ef4444', label: 'High' },
  Medium: { badge: 'bg-yellow-100 text-yellow-700', dot: '#f59e0b', label: 'Medium' },
  Low:    { badge: 'bg-gray-100 text-gray-500',   dot: '#9ca3af', label: 'Low' },
}

type StatusColumn = 'Pending' | 'In Progress' | 'Review' | 'Completed'
type FilterTab = 'All' | 'Pending' | 'In Progress' | 'Review' | 'Completed'
type ViewMode = 'list' | 'kanban'

const STATUS_COLUMNS: { key: StatusColumn; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'Pending',     label: 'To Do',       color: '#6b7280', icon: <Circle size={14} /> },
  { key: 'In Progress', label: 'In Progress', color: '#3b82f6', icon: <Clock size={14} /> },
  { key: 'Review',      label: 'Review',      color: '#8b5cf6', icon: <Eye size={14} /> },
  { key: 'Completed',   label: 'Done',         color: '#015035', icon: <CheckCircle2 size={14} /> },
]

const STATUS_LABEL_MAP: Record<StatusColumn, string> = {
  Pending: 'To Do',
  'In Progress': 'In Progress',
  Review: 'Review',
  Completed: 'Done',
}

const STATUS_BADGE_MAP: Record<StatusColumn, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  Review: 'bg-purple-100 text-purple-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function isOverdue(dueDate: string, status: AppTaskStatus) {
  return status !== 'Completed' && dueDate < getToday()
}

function isDueToday(dueDate: string, status: AppTaskStatus) {
  return status !== 'Completed' && dueDate === getToday()
}

function dueDateLabel(dueDate: string, status: AppTaskStatus) {
  if (status === 'Completed') return { text: 'Completed', cls: 'text-emerald-600' }
  if (isOverdue(dueDate, status)) return { text: `Overdue`, cls: 'text-red-600 font-semibold' }
  if (isDueToday(dueDate, status)) return { text: 'Due Today', cls: 'text-orange-500 font-semibold' }
  return { text: dueDate, cls: 'text-gray-400' }
}

function copyTaskToClipboard(task: AppTask): string {
  const lines = [
    `TASK: ${task.title}`,
    `Priority: ${task.priority} | Status: ${task.status} | Due: ${task.dueDate}`,
    `Assigned to: ${task.assignedTo}`,
    `Category: ${task.category}${task.company ? ` | Company: ${task.company}` : ''}`,
  ]
  if (task.description) {
    lines.push('', task.description)
  }
  if (task.linkedId) {
    lines.push('', `Ref: ${task.linkedId}`)
  }
  return lines.join('\n')
}

function getTaskColumn(task: AppTask): StatusColumn {
  if (task.status === 'Completed') return 'Completed'
  if (task.status === 'In Progress' && task.category === 'Contract') return 'Review'
  return task.status as StatusColumn
}

function NewTaskModal({ onSave, onClose, teamMembers }: { onSave: (t: AppTask) => void; onClose: () => void; teamMembers: TeamMember[] }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<AppTaskCategory>('General')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [assignedTo, setAssignedTo] = useState(teamMembers[0]?.name ?? '')
  const [dueDate, setDueDate] = useState(getToday())
  const [company, setCompany] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [recFrequency, setRecFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [recInterval, setRecInterval] = useState(1)
  const [recEndDate, setRecEndDate] = useState('')

  const canSave = title.trim() && dueDate

  function save() {
    if (!canSave) return
    onSave({
      id: `at-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      status: 'Pending',
      company: company.trim() || undefined,
      assignedTo,
      dueDate,
      createdDate: getToday(),
      recurrence: recurring ? { frequency: recFrequency, interval: recInterval, ...(recEndDate ? { endDate: recEndDate } : {}) } : null,
    })
  }

  const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 focus:border-[#015035] placeholder-gray-400 transition-colors"
  const selectCls = `${inputCls} bg-white`
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Task</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create and assign an action item</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Task Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Follow up on Apex proposal" autoFocus className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Additional context or steps..." rows={3} className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as AppTaskCategory)} className={selectCls}>
                {(['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'Email', 'General'] as AppTaskCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className={selectCls}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assign To</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={selectCls}>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Company (optional)</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Coastal Realty" className={inputCls} />
          </div>

          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="accent-[#015035] w-4 h-4" />
              <Repeat size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Repeat this task</span>
            </label>
            {recurring && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Frequency</label>
                  <select value={recFrequency} onChange={e => setRecFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Every</label>
                  <input type="number" min={1} max={99} value={recInterval} onChange={e => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#015035]/40" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End Date (optional)</label>
                  <input type="date" value={recEndDate} onChange={e => setRecEndDate(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#015035]/40" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={!canSave} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-90" style={{ background: '#015035' }}>
            Create Task
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskPanel({
  task,
  onClose,
  onUpdateStatus,
  onUpdate,
  onDelete,
  onCopy,
  teamMembers,
}: {
  task: AppTask
  onClose: () => void
  onUpdateStatus: (id: string, status: AppTaskStatus) => void
  onUpdate: (id: string, updates: Partial<AppTask>) => void
  onDelete: (id: string) => void
  onCopy: () => void
  teamMembers: TeamMember[]
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [editDesc, setEditDesc] = useState(task.description ?? '')
  const due = dueDateLabel(task.dueDate, task.status)
  const pri = priorityConfig[task.priority]
  const catColor = categoryColors[task.category]
  const overdue = isOverdue(task.dueDate, task.status)

  const fieldSelect = "text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white"

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(460px, 100vw)' }}>
        <div className="p-5 flex-shrink-0" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${catColor}`}>{task.category}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pri.badge}`}>{pri.label} Priority</span>
              {overdue && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">Overdue</span>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>
          {editingTitle ? (
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => { if (editTitle.trim() && editTitle !== task.title) onUpdate(task.id, { title: editTitle.trim() }); setEditingTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setEditTitle(task.title); setEditingTitle(false) } }}
              autoFocus
              className="w-full text-sm font-bold text-white bg-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          ) : (
            <h2 className="text-white text-sm font-bold leading-snug cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 py-0.5" onClick={() => { setEditTitle(task.title); setEditingTitle(true) }}>
              {task.title}
            </h2>
          )}
          {editingDesc ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onBlur={() => { onUpdate(task.id, { description: editDesc.trim() || undefined }); setEditingDesc(false) }}
              onKeyDown={e => { if (e.key === 'Escape') { setEditDesc(task.description ?? ''); setEditingDesc(false) } }}
              autoFocus
              rows={3}
              className="w-full text-xs text-white bg-white/10 rounded-lg px-2 py-1.5 mt-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Add a description..."
            />
          ) : (
            <p className="text-white/50 text-xs mt-2 leading-relaxed cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 py-0.5 min-h-[20px]" onClick={() => { setEditDesc(task.description ?? ''); setEditingDesc(true) }}>
              {task.description || 'Click to add description...'}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Assignee</label>
                <select value={task.assignedTo} onChange={e => onUpdate(task.id, { assignedTo: e.target.value })} className={fieldSelect}>
                  {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Due Date</label>
                <input type="date" value={task.dueDate} onChange={e => onUpdate(task.id, { dueDate: e.target.value })} className={fieldSelect} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Priority</label>
                <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })} className={fieldSelect}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Category</label>
                <select value={task.category} onChange={e => onUpdate(task.id, { category: e.target.value as AppTaskCategory })} className={fieldSelect}>
                  {(['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'Email', 'General'] as AppTaskCategory[]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Company</label>
              <input value={task.company ?? ''} onChange={e => onUpdate(task.id, { company: e.target.value || undefined })} placeholder="No company" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 placeholder-gray-300" />
            </div>
            {task.recurrence && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <Repeat size={12} />
                <span>Repeats {task.recurrence.frequency} every {task.recurrence.interval} {task.recurrence.frequency === 'daily' ? 'day(s)' : task.recurrence.frequency === 'weekly' ? 'week(s)' : 'month(s)'}</span>
              </div>
            )}
            {task.linkedId?.startsWith('gmail_') && (
              <div className="flex items-center gap-2 text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
                <Mail size={12} />
                <span>Created from email</span>
              </div>
            )}
          </div>

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status</p>
            <div className="flex flex-col gap-2">
              {(['Pending', 'In Progress', 'Completed'] as AppTaskStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(task.id, s)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${task.status === s ? 'text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  style={task.status === s ? { background: '#015035' } : {}}
                >
                  {s === 'Completed' ? <CheckCircle2 size={15} /> : s === 'In Progress' ? <Clock size={15} /> : <Circle size={15} />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {task.completedDate && (
            <p className="text-xs text-emerald-600 font-medium mt-3 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Completed on {task.completedDate}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {task.status !== 'Completed' ? (
            <button onClick={() => onUpdateStatus(task.id, 'Completed')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              <CheckCircle2 size={14} /> Mark Complete
            </button>
          ) : (
            <button onClick={() => onUpdateStatus(task.id, 'Pending')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              Reopen Task
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(copyTaskToClipboard(task))
              onCopy()
            }}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
            title="Copy task to clipboard"
          >
            <Copy size={14} className="text-gray-400" />
          </button>
          <button onClick={() => { onDelete(task.id); onClose() }} className="p-2.5 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors" title="Delete task">
            <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

function KanbanCard({ task, onClick, onToggleComplete, onCopy }: { task: AppTask; onClick: () => void; onToggleComplete: () => void; onCopy: () => void }) {
  const pri = priorityConfig[task.priority]
  const overdue = isOverdue(task.dueDate, task.status)
  const isCompleted = task.status === 'Completed'

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all group ${overdue ? 'border-red-200' : 'border-gray-150 hover:border-gray-300'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-medium leading-snug ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(copyTaskToClipboard(task)); onCopy() }}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
            title="Copy task"
          >
            <Copy size={11} className="text-gray-400" />
          </button>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${pri.badge}`}>{pri.label}</span>
        </div>
      </div>

      {task.company && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <Building2 size={10} />
          <span>{task.company}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
            {task.assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-xs text-gray-500 truncate max-w-[80px]">{task.assignedTo.split(' ')[0]}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
          <Calendar size={10} />
          <span>{task.dueDate.slice(5)}</span>
        </div>
      </div>
    </div>
  )
}

function KanbanBoard({ tasks, onSelectTask, onToggleComplete, onCopy }: { tasks: AppTask[]; onSelectTask: (t: AppTask) => void; onToggleComplete: (id: string) => void; onCopy: () => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {STATUS_COLUMNS.map(col => {
        const columnTasks = tasks.filter(t => getTaskColumn(t) === col.key)
        return (
          <div key={col.key} className="flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span style={{ color: col.color }}>{col.icon}</span>
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{columnTasks.length}</span>
              </div>
            </div>
            <div className="flex-1 bg-gray-50/70 rounded-xl p-2.5 flex flex-col gap-2.5 border border-gray-100">
              {columnTasks.map(task => (
                <KanbanCard key={task.id} task={task} onClick={() => onSelectTask(task)} onToggleComplete={() => onToggleComplete(task.id)} onCopy={onCopy} />
              ))}
              {columnTasks.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-8">
                  <p className="text-xs text-gray-300 font-medium">No tasks</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView({ tasks, onSelectTask, onToggleComplete }: { tasks: AppTask[]; onSelectTask: (t: AppTask) => void; onToggleComplete: (id: string, completed: boolean) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="hidden sm:grid grid-cols-[40px_1fr_100px_120px_100px_120px_100px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        <div />
        <div>Task</div>
        <div>Priority</div>
        <div>Due Date</div>
        <div>Status</div>
        <div>Assignee</div>
        <div>Category</div>
      </div>
      <div className="divide-y divide-gray-100">
        {tasks.map(task => {
          const due = dueDateLabel(task.dueDate, task.status)
          const pri = priorityConfig[task.priority]
          const isCompleted = task.status === 'Completed'
          const overdue = isOverdue(task.dueDate, task.status)
          const column = getTaskColumn(task)

          return (
            <div
              key={task.id}
              className={`grid grid-cols-1 sm:grid-cols-[40px_1fr_100px_120px_100px_120px_100px] gap-2 px-4 py-3 items-center hover:bg-gray-50/80 transition-colors cursor-pointer ${overdue ? 'bg-red-50/30' : ''} ${isCompleted ? 'opacity-60' : ''}`}
              onClick={() => onSelectTask(task)}
            >
              <div className="flex items-center justify-center">
                <button
                  onClick={e => { e.stopPropagation(); onToggleComplete(task.id, isCompleted) }}
                  className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${isCompleted ? 'border-[#015035] bg-[#015035]' : 'border-gray-300 hover:border-[#015035]'}`}
                >
                  {isCompleted && <CheckCircle2 size={10} className="text-white" />}
                </button>
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                {task.company && <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1"><Building2 size={9} /> {task.company}</p>}
              </div>
              <div className="hidden sm:block">
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${pri.badge}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: pri.dot }} />
                  {pri.label}
                </span>
              </div>
              <div className="hidden sm:block">
                <span className={`text-xs ${due.cls}`}>{due.text}</span>
              </div>
              <div className="hidden sm:block">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_MAP[column]}`}>
                  {STATUS_LABEL_MAP[column]}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                  {task.assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="text-xs text-gray-600 truncate">{task.assignedTo.split(' ')[0]}</span>
              </div>
              <div className="hidden sm:block">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${categoryColors[task.category]}`}>{task.category}</span>
              </div>
            </div>
          )
        })}
      </div>
      {tasks.length === 0 && (
        <div className="text-center py-16">
          <CheckSquare size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No tasks found</p>
          <p className="text-xs text-gray-300 mt-1">Try a different filter or create a new task</p>
        </div>
      )}
    </div>
  )
}

const categories: AppTaskCategory[] = ['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'Email', 'General']

export default function TasksPage() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filterTab, setFilterTab] = useState<FilterTab>('All')
  const [filterAssignee, setFilterAssignee] = useState<string>('All')
  const [selectedTask, setSelectedTask] = useState<AppTask | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterServiceLine, setFilterServiceLine] = useState<TeamServiceLine | 'All'>('All')
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'All'>('All')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setTasks(data) })
      .catch(() => toast('Failed to load tasks', 'error'))
      .finally(() => setLoading(false))
    fetchTeamMembers().then(setTeamMembers)
  }, [])

  function updateStatus(id: string, status: AppTaskStatus) {
    const today = getToday()
    const completedDate = status === 'Completed' ? today : undefined
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, completedDate } : t))
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status, completedDate } : null)
    }
    fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, completedDate: completedDate ?? null }),
    }).catch(() => toast('Failed to update task', 'error'))
  }

  function updateTask(id: string, updates: Partial<AppTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    if (selectedTask?.id === id) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null)
    }
    const apiBody: Record<string, unknown> = {}
    if (updates.title !== undefined) apiBody.title = updates.title
    if (updates.description !== undefined) apiBody.description = updates.description
    if (updates.category !== undefined) apiBody.category = updates.category
    if (updates.priority !== undefined) apiBody.priority = updates.priority
    if (updates.assignedTo !== undefined) apiBody.assignedTo = updates.assignedTo
    if (updates.dueDate !== undefined) apiBody.dueDate = updates.dueDate
    if (updates.company !== undefined) apiBody.company = updates.company
    fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    }).catch(() => toast('Failed to update task', 'error'))
  }

  function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => toast('Failed to delete task', 'error'))
  }

  function addTask(task: AppTask) {
    setTasks(prev => [task, ...prev])
    setCreatingTask(false)
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).then(res => {
      if (!res.ok) throw new Error('Failed')
      toast('Task created', 'success')
    }).catch(() => {
      setTasks(prev => prev.filter(t => t.id !== task.id))
      toast('Failed to save task', 'error')
    })
  }

  function toggleComplete(id: string, currentlyCompleted?: boolean) {
    updateStatus(id, currentlyCompleted ? 'Pending' : 'Completed')
  }

  const today = getToday()
  const totalTasks = tasks.length
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length
  const completedTodayCount = tasks.filter(t => t.completedDate === today).length
  const overdueCount = tasks.filter(t => isOverdue(t.dueDate, t.status)).length

  const filtered = tasks.filter(t => {
    if (filterTab !== 'All') {
      const col = getTaskColumn(t)
      if (col !== filterTab) return false
    }
    if (filterAssignee !== 'All' && t.assignedTo !== filterAssignee) return false
    if (filterServiceLine !== 'All' && t.teamServiceLine !== filterServiceLine) return false
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false
    if (filterDateFrom && t.dueDate < filterDateFrom) return false
    if (filterDateTo && t.dueDate > filterDateTo) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !(t.company ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1
    if (a.status !== 'Completed' && b.status === 'Completed') return -1
    if (isOverdue(a.dueDate, a.status) && !isOverdue(b.dueDate, b.status)) return -1
    if (!isOverdue(a.dueDate, a.status) && isOverdue(b.dueDate, b.status)) return 1
    const priorityOrder: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority]
    return a.dueDate.localeCompare(b.dueDate)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#015035]" /></div>

  return (
    <>
      <Header
        title="Tasks"
        subtitle="Action items across deals, billing, projects, and support"
        action={{ label: 'New Task', onClick: () => setCreatingTask(true) }}
      />
      <div className="page-content">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tasks',     value: totalTasks,          icon: <CheckSquare size={18} />,  color: '#015035', bg: 'bg-emerald-50' },
            { label: 'In Progress',     value: inProgressCount,     icon: <Clock size={18} />,         color: '#3b82f6', bg: 'bg-blue-50' },
            { label: 'Completed Today', value: completedTodayCount, icon: <CheckCircle2 size={18} />, color: '#10b981', bg: 'bg-emerald-50' },
            { label: 'Overdue',         value: overdueCount,        icon: <AlertCircle size={18} />,  color: '#ef4444', bg: 'bg-red-50' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${m.bg}`}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tracking-tight">{m.value}</p>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {(['All', 'Pending', 'In Progress', 'Review', 'Completed'] as FilterTab[]).map(t => (
              <button
                key={t}
                onClick={() => setFilterTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${filterTab === t ? 'text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                style={filterTab === t ? { background: '#015035' } : {}}
              >
                {t === 'Pending' ? 'To Do' : t === 'Completed' ? 'Done' : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} title="List view">
                <LayoutList size={16} />
              </button>
              <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`} title="Kanban view">
                <Columns3 size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or company..."
              className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 focus:border-[#015035] placeholder-gray-400 transition-colors"
            />
          </div>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white min-w-[160px]"
          >
            <option value="All">All Assignees</option>
            {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
          <select
            value={filterServiceLine}
            onChange={e => setFilterServiceLine(e.target.value as TeamServiceLine | 'All')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white min-w-[160px]"
          >
            <option value="All">All Service Lines</option>
            {(['Website', 'Development', 'SEO', 'Social Media', 'Marketing', 'Email Marketing', 'Content', 'Design', 'General'] as TeamServiceLine[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | 'All')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white min-w-[130px]"
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white"
              title="Due date from"
            />
            <span className="text-xs text-gray-400 flex-shrink-0">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#015035]/40 bg-white"
              title="Due date to"
            />
          </div>
          {(filterServiceLine !== 'All' || filterPriority !== 'All' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => { setFilterServiceLine('All'); setFilterPriority('All'); setFilterDateFrom(''); setFilterDateTo('') }}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 flex-shrink-0"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>

        {viewMode === 'kanban' ? (
          <KanbanBoard tasks={sortedFiltered} onSelectTask={setSelectedTask} onToggleComplete={id => toggleComplete(id)} onCopy={() => toast('Task copied to clipboard', 'success')} />
        ) : (
          <ListView tasks={sortedFiltered} onSelectTask={setSelectedTask} onToggleComplete={(id, completed) => toggleComplete(id, completed)} />
        )}

        {sortedFiltered.length > 0 && (
          <p className="text-xs text-gray-400 mt-4 text-right">
            Showing {sortedFiltered.length} of {tasks.length} tasks
          </p>
        )}
      </div>

      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={updateStatus}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onCopy={() => toast('Task copied to clipboard', 'success')}
          teamMembers={teamMembers}
        />
      )}
      {creatingTask && (
        <NewTaskModal onSave={addTask} onClose={() => setCreatingTask(false)} teamMembers={teamMembers} />
      )}
    </>
  )
}
