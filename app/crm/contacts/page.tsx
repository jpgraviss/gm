'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { crmContacts, crmCompanies, deals, contracts, projects, crmActivities } from '@/lib/data'
import {
  formatCurrency, stageColors, serviceTypeColors,
  contractStatusColors, projectStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import CRMSubNav from '@/components/crm/CRMSubNav'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import type { CRMContact, ContactNote, ContactTask } from '@/lib/types'
import {
  X, Phone, Mail, User, Search, Plus, ScrollText,
  ChevronRight, Linkedin, StickyNote, CheckSquare,
  TrendingUp, DollarSign, FileText, Clock, FolderKanban, Globe,
  CheckCircle2, Circle, Calendar, AlertCircle, RefreshCw, Presentation,
  PhoneCall, Video,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const taskTypeConfig: Record<ContactTask['taskType'], { icon: React.ReactNode; label: string; color: string }> = {
  follow_up:  { icon: <Clock size={13} />,         label: 'Follow Up',       color: '#f97316' },
  call:       { icon: <PhoneCall size={13} />,      label: 'Scheduled Call',  color: '#3b82f6' },
  email:      { icon: <Mail size={13} />,           label: 'Send Email',      color: '#f59e0b' },
  meeting:    { icon: <Video size={13} />,          label: 'Meeting',         color: '#8b5cf6' },
  reschedule: { icon: <RefreshCw size={13} />,      label: 'Reschedule',      color: '#6b7280' },
  proposal:   { icon: <FileText size={13} />,       label: 'Send Proposal',   color: '#6366f1' },
  demo:       { icon: <Presentation size={13} />,   label: 'Demo',            color: '#10b981' },
  other:      { icon: <CheckSquare size={13} />,    label: 'Task',            color: '#6b7280' },
}

const taskPriorityConfig: Record<ContactTask['priority'], { label: string; color: string; bg: string }> = {
  high:   { label: 'High',   color: '#dc2626', bg: '#fef2f2' },
  medium: { label: 'Medium', color: '#d97706', bg: '#fffbeb' },
  low:    { label: 'Low',    color: '#6b7280', bg: '#f9fafb' },
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────

function ContactPanel({ contact, onClose }: { contact: CRMContact; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'pipeline' | 'contracts' | 'notes' | 'tasks' | 'activity'>('overview')
  const [taskDone, setTaskDone] = useState<Set<string>>(
    new Set((contact.contactTasks ?? []).filter(t => t.completed).map(t => t.id))
  )
  const [localNotes, setLocalNotes] = useState<ContactNote[]>(contact.contactNotes ?? [])
  const [localTasks, setLocalTasks] = useState<ContactTask[]>(contact.contactTasks ?? [])
  const [addingNote, setAddingNote] = useState(false)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskType, setNewTaskType] = useState<ContactTask['taskType']>('follow_up')
  const [newTaskPriority, setNewTaskPriority] = useState<ContactTask['priority']>('medium')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [localActivities, setLocalActivities] = useState(
    () => crmActivities.filter(a => a.contactId === contact.id || a.companyId === contact.companyId)
  )

  function handleAddNote() {
    if (!newNoteBody.trim()) return
    const note: ContactNote = {
      id: `cn-${Date.now()}`,
      body: newNoteBody.trim(),
      date: new Date().toISOString().split('T')[0],
      author: 'You',
    }
    setLocalNotes(prev => [note, ...prev])
    setNewNoteBody('')
    setAddingNote(false)
  }

  function handleAddTask() {
    if (!newTaskTitle.trim() || !newTaskDue) return
    const task: ContactTask = {
      id: `ct-${Date.now()}`,
      title: newTaskTitle.trim(),
      taskType: newTaskType,
      dueDate: newTaskDue,
      completed: false,
      priority: newTaskPriority,
      assignedTo: 'You',
    }
    setLocalTasks(prev => [task, ...prev])
    setNewTaskTitle('')
    setNewTaskDue('')
    setNewTaskType('follow_up')
    setNewTaskPriority('medium')
    setAddingTask(false)
  }

  function handleSaveActivity(activity: LoggedActivity) {
    setLocalActivities(prev => [{
      id: activity.id,
      type: activity.type,
      title: activity.title,
      body: activity.body,
      outcome: activity.outcome || undefined,
      nextStep: activity.nextStep || undefined,
      user: activity.user,
      timestamp: activity.timestamp,
      duration: activity.duration,
      contactId: contact.id,
      contactName: contact.fullName,
      companyId: contact.companyId,
      companyName: contact.companyName,
    }, ...prev])
    setLoggingActivity(false)
    setTab('activity')
  }

  // Cross-linked data
  const company = crmCompanies.find(c => c.id === contact.companyId)
  const contactDeals = deals.filter(d => d.company === contact.companyName)
  const contactContracts = contracts.filter(c => c.company === contact.companyName)
  const companyProject = projects.find(p => p.company === contact.companyName)
  const activeDeal = contactDeals.find(d => !d.stage.startsWith('Closed'))
  const executedContract = contactContracts.find(c => c.status === 'Fully Executed')

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-[520px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4 flex-1 min-w-0 pr-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {contact.fullName}
                </h2>
                <p className="text-white/60 text-sm">{contact.title}</p>
                {contact.isPrimary && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block">
                    Primary Contact
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>

          {/* Company link + action buttons */}
          <Link
            href="/crm/companies"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-xl p-3 transition-colors mb-3"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {company?.name[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{contact.companyName}</p>
              {company && <p className="text-white/50 text-xs">{company.industry} · {company.hq}</p>}
            </div>
            <ChevronRight size={14} className="text-white/40 flex-shrink-0" />
          </Link>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Pipeline Stage', value: activeDeal?.stage ?? 'No Deal' },
              { label: 'Deal Value', value: activeDeal ? formatCurrency(activeDeal.value) : '—' },
              { label: 'Contract', value: executedContract ? 'Active' : contactContracts.length > 0 ? 'Pending' : 'None' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-xs font-bold truncate">{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Mail size={13} /> Email
          </a>
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Phone size={13} /> Call
          </a>
          {contact.linkedIn && (
            <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              <Linkedin size={13} /> LinkedIn
            </a>
          )}
          <button className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white hover:opacity-90" style={{ background: '#015035' }}>
            <Plus size={13} /> Log Activity
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'pipeline', 'contracts', 'notes', 'tasks', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}
            >
              {t === 'notes' && localNotes.length > 0 ? (
                <span className="flex items-center gap-1">{t}<span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center">{localNotes.length}</span></span>
              ) : t === 'tasks' && localTasks.filter(tk => !taskDone.has(tk.id)).length > 0 ? (
                <span className="flex items-center gap-1">{t}<span className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold flex items-center justify-center">{localTasks.filter(tk => !taskDone.has(tk.id)).length}</span></span>
              ) : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Info</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<Mail size={14} />} label="Email" value={
                    <a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline">{contact.email}</a>
                  } />
                  <InfoRow icon={<Phone size={14} />} label="Phone" value={contact.phone} />
                  {contact.mobile && <InfoRow icon={<Phone size={14} />} label="Mobile" value={contact.mobile} />}
                  {contact.website && (
                    <InfoRow icon={<Globe size={14} />} label="Website" value={
                      <a href={`https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{contact.website}</a>
                    } />
                  )}
                  <InfoRow icon={<User size={14} />} label="Owner" value={contact.owner} />
                  {contact.lastActivity && (
                    <InfoRow icon={<Clock size={14} />} label="Last Activity" value={contact.lastActivity} />
                  )}
                </div>
              </div>

              {contact.tags.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active project */}
              {companyProject && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Project</p>
                    <Link href="/projects" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FolderKanban size={14} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{companyProject.serviceType}</p>
                        <StatusBadge label={companyProject.status} colorClass={projectStatusColors[companyProject.status]} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#015035' }}>{companyProject.progress}%</p>
                      <p className="text-[11px] text-gray-400">complete</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Pipeline ── */}
          {tab === 'pipeline' && (
            <div className="flex flex-col gap-3">
              {contactDeals.map(d => (
                <div key={d.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      <StatusBadge label={d.serviceType} colorClass={serviceTypeColors[d.serviceType]} />
                    </div>
                    <p className="text-base font-bold flex-shrink-0" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(d.value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{d.probability}% probability</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Close date: {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
              {contactDeals.length === 0 && (
                <div className="text-center py-12">
                  <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No pipeline deals linked.</p>
                </div>
              )}
              <Link
                href="/crm/pipeline"
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2"
              >
                View full pipeline <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {/* ── Contracts ── */}
          {tab === 'contracts' && (
            <div className="flex flex-col gap-3">
              {contactContracts.map(c => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                      <p className="text-xs text-gray-500 mt-1.5">{c.billingStructure}</p>
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(c.value)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: 'Service', value: c.serviceType },
                      { label: 'Start', value: new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                      { label: 'Renewal', value: new Date(c.renewalDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                    ].map(f => (
                      <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                        <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {contactContracts.length === 0 && (
                <div className="text-center py-12">
                  <ScrollText size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No contracts found.</p>
                </div>
              )}
              <Link
                href="/contracts"
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2"
              >
                View all contracts <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {/* ── Notes ── */}
          {tab === 'notes' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">{localNotes.length} note{localNotes.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => setAddingNote(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                  style={{ background: addingNote ? '#6b7280' : '#015035' }}
                >
                  <Plus size={12} /> {addingNote ? 'Cancel' : 'Add Note'}
                </button>
              </div>

              {/* Inline add form */}
              {addingNote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-2">
                  <textarea
                    value={newNoteBody}
                    onChange={e => setNewNoteBody(e.target.value)}
                    placeholder="Write your note here... (Granola meeting notes, call recap, etc.)"
                    className="w-full text-sm border border-blue-200 rounded-lg p-2.5 bg-white outline-none resize-none leading-relaxed"
                    rows={4}
                    autoFocus
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteBody.trim()}
                    className="py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    Save Note
                  </button>
                </div>
              )}

              {localNotes.length === 0 && !addingNote ? (
                <div className="text-center py-12">
                  <StickyNote size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notes yet. Add your first note.</p>
                </div>
              ) : (
                localNotes.map(note => (
                  <div key={note.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                          {note.author.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{note.author}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar size={11} />
                        {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{note.body}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tasks ── */}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">
                  {localTasks.filter(t => !taskDone.has(t.id)).length} open · {taskDone.size} done
                </p>
                <button
                  onClick={() => setAddingTask(v => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                  style={{ background: addingTask ? '#6b7280' : '#015035' }}
                >
                  <Plus size={12} /> {addingTask ? 'Cancel' : 'Add Task'}
                </button>
              </div>

              {/* Inline add task form */}
              {addingTask && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex flex-col gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Task title (e.g. Follow up, Reschedule call...)"
                    className="text-sm border border-orange-200 rounded-lg px-2.5 py-2 bg-white outline-none w-full"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newTaskType}
                      onChange={e => setNewTaskType(e.target.value as ContactTask['taskType'])}
                      className="text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white outline-none text-gray-700"
                    >
                      {Object.entries(taskTypeConfig).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                    <select
                      value={newTaskPriority}
                      onChange={e => setNewTaskPriority(e.target.value as ContactTask['priority'])}
                      className="text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white outline-none text-gray-700"
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={e => setNewTaskDue(e.target.value)}
                    className="text-xs border border-orange-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-700 w-full"
                  />
                  <button
                    onClick={handleAddTask}
                    disabled={!newTaskTitle.trim() || !newTaskDue}
                    className="py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    Save Task
                  </button>
                </div>
              )}

              {localTasks.length === 0 && !addingTask ? (
                <div className="text-center py-12">
                  <CheckSquare size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No tasks yet for this contact.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {localTasks.map(task => {
                    const done = taskDone.has(task.id)
                    const cfg = taskTypeConfig[task.taskType]
                    const pri = taskPriorityConfig[task.priority]
                    const isOverdue = !done && new Date(task.dueDate) < new Date()
                    return (
                      <div key={task.id} className={`p-3.5 rounded-xl border transition-all ${done ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setTaskDone(prev => {
                              const next = new Set(prev)
                              if (next.has(task.id)) next.delete(task.id)
                              else { next.add(task.id); setLocalTasks(ts => ts.map(t => t.id === task.id ? { ...t, completed: true } : t)) }
                              return next
                            })}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {done
                              ? <CheckCircle2 size={18} className="text-emerald-500" />
                              : <Circle size={18} className="text-gray-300 hover:text-gray-400" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: `${cfg.color}15`, color: cfg.color }}>
                                {cfg.icon}{cfg.label}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                style={{ background: pri.bg, color: pri.color }}>
                                {pri.label}
                              </span>
                              <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                {isOverdue && <AlertCircle size={11} />}
                                <Calendar size={11} />
                                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {isOverdue && ' · Overdue'}
                              </span>
                              <span className="text-[11px] text-gray-400 ml-auto">{task.assignedTo.split(' ')[0]}</span>
                            </div>
                            {task.notes && !done && (
                              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{task.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <ActivityTimeline activities={localActivities} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          {loggingActivity ? (
            <LogActivityForm
              onSave={handleSaveActivity}
              onCancel={() => setLoggingActivity(false)}
              authorName="You"
            />
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setLoggingActivity(true); setTab('activity') }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
                style={{ background: '#015035' }}
              >
                Log Activity
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null)

  const filtered = crmContacts.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Contact' }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
            <Search size={13} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts, company, title..."
              className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <span className="ml-auto text-sm text-gray-400">{filtered.length} contacts</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Name</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Title</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Pipeline Stage</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Contract Value</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden xl:table-cell">Owner</th>
                <th className="text-left py-2.5 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => {
                const activeDeal = deals.find(d => d.company === contact.companyName && !d.stage.startsWith('Closed'))
                const contactContract = contracts.find(c => c.company === contact.companyName)
                return (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#015035' }}
                        >
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{contact.fullName}</p>
                          {contact.isPrimary && (
                            <span className="text-[10px] text-emerald-600 font-medium">Primary</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <Link
                        href="/crm/companies"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {contact.companyName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500">{contact.title}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {activeDeal ? (
                        <div>
                          <StatusBadge label={activeDeal.stage} colorClass={stageColors[activeDeal.stage]} />
                          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(activeDeal.value)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {contactContract ? (
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#015035' }}>
                            {formatCurrency(contactContract.value)}
                          </p>
                          <StatusBadge label={contactContract.status} colorClass={contractStatusColors[contactContract.status]} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No contract</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-500">{contact.owner.split(' ')[0]}</span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Mail size={13} />
                        </a>
                        <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Phone size={13} />
                        </a>
                        {contact.linkedIn && (
                          <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                            <Linkedin size={13} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <User size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No contacts match your search.</p>
            </div>
          )}
        </div>
      </div>

      {selectedContact && <ContactPanel contact={selectedContact} onClose={() => setSelectedContact(null)} />}
    </>
  )
}
