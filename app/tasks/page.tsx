'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { fetchTeamMembers } from '@/lib/supabase'
import type { AppTask, AppTaskCategory, AppTaskStatus, TaskPriority, TeamMember } from '@/lib/types'
import {
  CheckSquare, Clock, AlertCircle, CheckCircle2, Plus, X, ChevronRight, ChevronLeft,
  Building2, User, Calendar, Flag, Tag, Trash2, Circle, Repeat, Search,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// ─── Config ───────────────────────────────────────────────────────────────────

const categoryColors: Record<AppTaskCategory, string> = {
  Deal:     'bg-blue-100 text-blue-700',
  Contract: 'bg-green-100 text-green-700',
  Billing:  'bg-orange-100 text-orange-700',
  Renewal:  'bg-purple-100 text-purple-700',
  Project:  'bg-indigo-100 text-indigo-700',
  Ticket:   'bg-yellow-100 text-yellow-700',
  General:  'bg-gray-100 text-gray-600',
}

const priorityConfig: Record<TaskPriority, { badge: string; dot: string; label: string }> = {
  High:   { badge: 'bg-red-100 text-red-700',    dot: '#ef4444', label: 'High' },
  Medium: { badge: 'bg-yellow-100 text-yellow-700', dot: '#f59e0b', label: 'Medium' },
  Low:    { badge: 'bg-gray-100 text-gray-500',   dot: '#9ca3af', label: 'Low' },
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
  if (isOverdue(dueDate, status)) return { text: `Overdue · ${dueDate}`, cls: 'text-red-600 font-semibold' }
  if (isDueToday(dueDate, status)) return { text: 'Due Today', cls: 'text-orange-500 font-semibold' }
  return { text: `Due ${dueDate}`, cls: 'text-gray-400' }
}

// ─── New Task Panel ────────────────────────────────────────────────────────────

function NewTaskPanel({ onSave, onClose, teamMembers }: { onSave: (t: AppTask) => void; onClose: () => void; teamMembers: TeamMember[] }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<AppTaskCategory>('General')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [assignedTo, setAssignedTo] = useState('')
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

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(460px, 100vw)' }}>

        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">New Task</h2>
            <p className="text-white/50 text-xs mt-0.5">Assign and track an action item</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Task Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Follow up on Apex proposal"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional context or steps..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as AppTaskCategory)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {(['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'General'] as AppTaskCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assign To</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company (optional)</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Coastal Realty"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          {/* Recurrence toggle */}
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={e => setRecurring(e.target.checked)}
                className="accent-emerald-600 w-4 h-4"
              />
              <Repeat size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Repeat this task</span>
            </label>
            {recurring && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Frequency</label>
                  <select
                    value={recFrequency}
                    onChange={e => setRecFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Every</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={recInterval}
                    onChange={e => setRecInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={recEndDate}
                    onChange={e => setRecEndDate(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Create Task
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Detail Panel ─────────────────────────────────────────────────────────

function TaskPanel({
  task,
  onClose,
  onUpdateStatus,
  onUpdate,
  onDelete,
  teamMembers,
}: {
  task: AppTask
  onClose: () => void
  onUpdateStatus: (id: string, status: AppTaskStatus) => void
  onUpdate: (id: string, updates: Partial<AppTask>) => void
  onDelete: (id: string) => void
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

  const fieldSelect = "text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(460px, 100vw)' }}>

        {/* Header */}
        <div className="p-5 flex-shrink-0" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${catColor}`}>
                {task.category}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${pri.badge}`}>
                {pri.label} Priority
              </span>
              {overdue && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">
                  Overdue
                </span>
              )}
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
            <p
              className="text-white/50 text-xs mt-2 leading-relaxed cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 py-0.5 min-h-[20px]"
              onClick={() => { setEditDesc(task.description ?? ''); setEditingDesc(true) }}
            >
              {task.description || 'Click to add description...'}
            </p>
          )}
        </div>

        {/* Editable Fields */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Assignee</label>
                <select
                  value={task.assignedTo}
                  onChange={e => onUpdate(task.id, { assignedTo: e.target.value })}
                  className={fieldSelect}
                >
                  {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Due Date</label>
                <input
                  type="date"
                  value={task.dueDate}
                  onChange={e => onUpdate(task.id, { dueDate: e.target.value })}
                  className={fieldSelect}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Priority</label>
                <select
                  value={task.priority}
                  onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
                  className={fieldSelect}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Category</label>
                <select
                  value={task.category}
                  onChange={e => onUpdate(task.id, { category: e.target.value as AppTaskCategory })}
                  className={fieldSelect}
                >
                  {(['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'General'] as AppTaskCategory[]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Company</label>
              <input
                value={task.company ?? ''}
                onChange={e => onUpdate(task.id, { company: e.target.value || undefined })}
                placeholder="No company"
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-300"
              />
            </div>

            {task.recurrence && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <Repeat size={12} />
                <span>Repeats {task.recurrence.frequency} every {task.recurrence.interval} {task.recurrence.frequency === 'daily' ? 'day(s)' : task.recurrence.frequency === 'weekly' ? 'week(s)' : 'month(s)'}</span>
              </div>
            )}
          </div>

          {/* Status control */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status</p>
            <div className="flex flex-col gap-2">
              {(['Pending', 'In Progress', 'Completed'] as AppTaskStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => onUpdateStatus(task.id, s)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    task.status === s
                      ? 'text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={task.status === s ? { background: '#015035' } : {}}
                >
                  {s === 'Completed'
                    ? <CheckCircle2 size={15} />
                    : s === 'In Progress'
                    ? <Clock size={15} />
                    : <Circle size={15} />
                  }
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {task.status !== 'Completed' ? (
            <button
              onClick={() => onUpdateStatus(task.id, 'Completed')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              <CheckCircle2 size={14} /> Mark Complete
            </button>
          ) : (
            <button
              onClick={() => onUpdateStatus(task.id, 'Pending')}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              Reopen Task
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = 'All' | 'Due Today' | 'Overdue' | 'In Progress' | 'Pending' | 'Completed'

const categories: AppTaskCategory[] = ['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'General']

export default function TasksPage() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filterTab, setFilterTab] = useState<FilterTab>('All')
  const [filterCategory, setFilterCategory] = useState<AppTaskCategory | 'All'>('All')
  const [filterAssignee, setFilterAssignee] = useState<string>('All')
  const [selectedTask, setSelectedTask] = useState<AppTask | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTasks(data) })
      .catch(() => toast('Failed to load tasks', 'error'))
      .finally(() => setLoading(false))
    fetchTeamMembers().then(setTeamMembers)
  }, [])

  function updateStatus(id: string, status: AppTaskStatus) {
    const today = getToday()
    const completedDate = status === 'Completed' ? today : undefined
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status, completedDate } : t
    ))
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
    setTasks(prev => prev.filter(t => t.id !== id))
    fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      .catch(() => toast('Failed to delete task', 'error'))
  }

  function addTask(task: AppTask) {
    setTasks(prev => [task, ...prev])
    setCreatingTask(false)
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).catch(() => toast('Failed to save task', 'error'))
  }

  // Computed stats
  const overdueTasks = tasks.filter(t => isOverdue(t.dueDate, t.status))
  const dueTodayTasks = tasks.filter(t => isDueToday(t.dueDate, t.status))
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress')
  const completedTasks = tasks.filter(t => t.status === 'Completed')

  // Filter
  const filtered = tasks.filter(t => {
    if (filterTab === 'Due Today' && !isDueToday(t.dueDate, t.status)) return false
    if (filterTab === 'Overdue' && !isOverdue(t.dueDate, t.status)) return false
    if (filterTab === 'In Progress' && t.status !== 'In Progress') return false
    if (filterTab === 'Pending' && t.status !== 'Pending') return false
    if (filterTab === 'Completed' && t.status !== 'Completed') return false
    if (filterCategory !== 'All' && t.category !== filterCategory) return false
    if (filterAssignee !== 'All' && t.assignedTo !== filterAssignee) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !(t.company ?? '').toLowerCase().includes(q) && !(t.description ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    // Overdue first, then by due date, then completed last
    if (a.status === 'Completed' && b.status !== 'Completed') return 1
    if (a.status !== 'Completed' && b.status === 'Completed') return -1
    if (isOverdue(a.dueDate, a.status) && !isOverdue(b.dueDate, b.status)) return -1
    if (!isOverdue(a.dueDate, a.status) && isOverdue(b.dueDate, b.status)) return 1
    const priortyOrder: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 }
    if (priortyOrder[a.priority] !== priortyOrder[b.priority]) return priortyOrder[a.priority] - priortyOrder[b.priority]
    return a.dueDate.localeCompare(b.dueDate)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header
        title="Tasks"
        subtitle="Action items across deals, billing, projects, and support"
        action={{ label: 'New Task', onClick: () => setCreatingTask(true) }}
      />
      <div className="page-content">

        {/* Summary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Overdue',     value: overdueTasks.length,    icon: <AlertCircle size={16} />,  color: '#ef4444', tab: 'Overdue' as FilterTab },
            { label: 'Due Today',   value: dueTodayTasks.length,   icon: <Clock size={16} />,         color: '#f59e0b', tab: 'Due Today' as FilterTab },
            { label: 'In Progress', value: inProgressTasks.length, icon: <CheckSquare size={16} />,  color: '#3b82f6', tab: 'In Progress' as FilterTab },
            { label: 'Completed',   value: completedTasks.length,  icon: <CheckCircle2 size={16} />, color: '#015035', tab: 'Completed' as FilterTab },
          ].map(m => (
            <button
              key={m.label}
              onClick={() => setFilterTab(filterTab === m.tab ? 'All' : m.tab)}
              className={`kpi-card flex items-center gap-3 text-left cursor-pointer w-full ${filterTab === m.tab ? 'outline outline-2 outline-offset-1' : ''}`}
              style={{ '--kpi-accent': m.color, ...(filterTab === m.tab ? { outlineColor: m.color } : {}) } as React.CSSProperties}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}15` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tracking-tight">{m.value}</p>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{m.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, company, or description..."
            className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 flex-1 min-w-0">
            {(['All', 'Overdue', 'Due Today', 'Pending', 'In Progress', 'Completed'] as FilterTab[]).map(t => (
              <button
                key={t}
                onClick={() => setFilterTab(t)}
                className={`filter-pill flex-shrink-0 ${filterTab === t ? 'active' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Category + Assignee */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as AppTaskCategory | 'All')}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="All">All Assignees</option>
              {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {/* Task list */}
        <div className="flex flex-col gap-2">
          {sortedFiltered.map(task => {
            const due = dueDateLabel(task.dueDate, task.status)
            const pri = priorityConfig[task.priority]
            const catColor = categoryColors[task.category]
            const overdue = isOverdue(task.dueDate, task.status)
            const isCompleted = task.status === 'Completed'

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border px-4 py-3.5 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer ${
                  overdue ? 'border-red-200 bg-red-50/30' : isCompleted ? 'border-gray-100 opacity-70' : 'border-gray-200'
                }`}
                onClick={() => setSelectedTask(task)}
              >
                {/* Complete toggle */}
                <button
                  onClick={e => { e.stopPropagation(); updateStatus(task.id, isCompleted ? 'Pending' : 'Completed') }}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors hover:border-green-600"
                  style={{ borderColor: isCompleted ? '#015035' : pri.dot, background: isCompleted ? '#015035' : 'transparent' }}
                  title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isCompleted && <CheckCircle2 size={11} className="text-white" />}
                </button>

                {/* Priority dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pri.dot }} />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${catColor}`}>{task.category}</span>
                    {task.recurrence && (
                      <span className="text-gray-400 flex items-center gap-0.5" title={`Repeats ${task.recurrence.frequency} every ${task.recurrence.interval}`}>
                        <Repeat size={10} />
                      </span>
                    )}
                    {task.company && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Building2 size={10} /> {task.company}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <User size={10} /> {task.assignedTo}
                    </span>
                    <span className={`text-xs flex items-center gap-1 ${due.cls}`}>
                      <Calendar size={10} /> {due.text}
                    </span>
                  </div>
                </div>

                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </div>
            )
          })}

          {sortedFiltered.length === 0 && (
            <div className="text-center py-16">
              <CheckSquare size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No tasks found</p>
              <p className="text-xs text-gray-300 mt-1">Try a different filter or create a new task</p>
            </div>
          )}
        </div>

        {/* Count */}
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
          teamMembers={teamMembers}
        />
      )}
      {creatingTask && (
        <NewTaskPanel onSave={addTask} onClose={() => setCreatingTask(false)} teamMembers={teamMembers} />
      )}
    </>
  )
}
