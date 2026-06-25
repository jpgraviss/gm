'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchCrmContacts, fetchCrmCompanies, fetchDeals, fetchContracts, fetchProjects, fetchCrmActivities } from '@/lib/supabase'
import {
  formatCurrency, stageColors, serviceTypeColors,
  contractStatusColors, projectStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { InfoRow } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewContactPanel, { type NewContactFormData } from '@/components/crm/NewContactPanel'
import HubSpotImportPanel from '@/components/crm/HubSpotImportPanel'
import AiInsightsPanel from '@/components/crm/AiInsightsPanel'
import type { CRMContact, ContactNote, ContactTask, CRMCompany, Deal, Contract, Project, CRMActivity } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { useTeamMembers } from '@/lib/useTeamMembers'
import {
  X, Phone, Mail, User, Search, Plus, ScrollText,
  ChevronRight, ChevronLeft, Linkedin, StickyNote, CheckSquare,
  TrendingUp, DollarSign, FileText, Clock, FolderKanban, Globe,
  CheckCircle2, Circle, Calendar, AlertCircle, RefreshCw, Presentation,
  PhoneCall, Video, Pencil, Trash2, Upload, Eye, MessageSquare, MousePointerClick,
  Flame, Thermometer, Snowflake, MessageCircle, Sparkles, Brain, Wand2, GitMerge, Download, Tag,
} from 'lucide-react'
import DuplicatesPanel from '@/components/crm/DuplicatesPanel'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'

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

const timelineTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  email_sent:       { icon: <Mail size={14} />,              label: 'Email Sent',        color: '#3b82f6' },
  email_opened:     { icon: <Eye size={14} />,               label: 'Email Opened',      color: '#10b981' },
  link_clicked:     { icon: <MousePointerClick size={14} />, label: 'Link Clicked',      color: '#8b5cf6' },
  proposal_sent:    { icon: <FileText size={14} />,          label: 'Proposal Sent',     color: '#8b5cf6' },
  proposal_viewed:  { icon: <Eye size={14} />,               label: 'Proposal Viewed',   color: '#6366f1' },
  contract_signed:  { icon: <ScrollText size={14} />,        label: 'Contract Signed',   color: '#059669' },
  contract_created: { icon: <ScrollText size={14} />,        label: 'Contract Created',  color: '#f97316' },
  invoice_paid:     { icon: <DollarSign size={14} />,        label: 'Invoice Paid',      color: '#10b981' },
  invoice_sent:     { icon: <DollarSign size={14} />,        label: 'Invoice Sent',      color: '#f59e0b' },
  ticket_created:   { icon: <MessageSquare size={14} />,     label: 'Ticket Created',    color: '#f97316' },
  deal_updated:     { icon: <TrendingUp size={14} />,        label: 'Deal Updated',      color: '#3b82f6' },
  note_added:       { icon: <StickyNote size={14} />,        label: 'Note Added',        color: '#6b7280' },
  task_completed:   { icon: <CheckSquare size={14} />,       label: 'Task Completed',    color: '#10b981' },
  call:             { icon: <PhoneCall size={14} />,         label: 'Call',              color: '#3b82f6' },
  meeting:          { icon: <Video size={14} />,             label: 'Meeting',           color: '#8b5cf6' },
  activity:         { icon: <Clock size={14} />,             label: 'Activity',          color: '#6b7280' },
}

interface TimelineEntry {
  id: string
  type: string
  title: string
  description?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function getMonthKey(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function EngagementScoreBar({ score, breakdown, points, thresholds }: {
  score: number
  breakdown: { emailsOpened: number; linksClicked: number; proposalsViewed: number; meetings: number }
  points: { emailOpened: number; linkClicked: number; proposalViewed: number; meetingHeld: number }
  thresholds: { cold: number; hot: number }
}) {
  const maxScore = 200
  const pct = Math.min(100, Math.round((score / maxScore) * 100))
  const level = score >= thresholds.hot ? 'hot' : score >= thresholds.cold ? 'warm' : 'cold'
  const cfg = {
    hot:  { label: 'Hot',  color: '#ef4444', bg: '#fef2f2', icon: <Flame size={14} /> },
    warm: { label: 'Warm', color: '#f59e0b', bg: '#fffbeb', icon: <Thermometer size={14} /> },
    cold: { label: 'Cold', color: '#6b7280', bg: '#f9fafb', icon: <Snowflake size={14} /> },
  }[level]

  return (
    <div className="px-5 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="text-sm font-bold text-gray-900">Engagement Score</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold" style={{ color: cfg.color }}>{score}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.color }} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Opens', val: breakdown.emailsOpened, pts: points.emailOpened },
          { label: 'Clicks', val: breakdown.linksClicked, pts: points.linkClicked },
          { label: 'Proposals', val: breakdown.proposalsViewed, pts: points.proposalViewed },
          { label: 'Meetings', val: breakdown.meetings, pts: points.meetingHeld },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-semibold text-gray-900">{s.val}</p>
            <p className="text-[10px] text-gray-400">{s.label} ({s.pts}pt)</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Edit Contact Panel ───────────────────────────────────────────────────────

function EditContactPanel({
  contact,
  onSave,
  onDelete,
  onClose,
}: {
  contact: CRMContact
  onSave: (updated: CRMContact) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const REPS = useTeamMembers()
  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName: contact.lastName,
    title: contact.title,
    email: contact.emails[0] ?? '',
    phone: contact.phones[0] ?? '',
    mobile: contact.phones[1] ?? '',
    linkedIn: contact.linkedIn ?? '',
    website: contact.website ?? '',
    owner: contact.owner,
    notes: contact.notes ?? '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    onSave({
      ...contact,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
      title: form.title.trim(),
      emails: [form.email.trim()].filter(Boolean) as string[],
      phones: [form.phone.trim(), form.mobile.trim()].filter(Boolean) as string[],
      linkedIn: form.linkedIn.trim() || undefined,
      website: form.website.trim() || undefined,
      owner: form.owner,
      notes: form.notes.trim() || undefined,
    })
  }

  const canSave = form.firstName.trim() && form.lastName.trim()

  return (
    <div className="fixed inset-0 z-[60] flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">Edit Contact</h2>
            <p className="text-white/50 text-xs mt-0.5">{contact.fullName} · {contact.companyName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="First name"
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                placeholder="Last name"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title / Role</label>
            <input
              placeholder="e.g. Marketing Director"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Contact Info</label>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Direct phone"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="tel"
                  placeholder="Mobile"
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Online Presence</label>
            <div className="flex flex-col gap-2">
              <input
                type="url"
                placeholder="Website URL"
                value={form.website}
                onChange={e => set('website', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="url"
                placeholder="LinkedIn URL"
                value={form.linkedIn}
                onChange={e => set('linkedIn', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner</label>
            <select
              value={form.owner}
              onChange={e => set('owner', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea
              placeholder="Background context, how you met, key interests..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Delete section */}
          <div className="pt-2 border-t border-gray-200">
            {confirmDelete ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-700 mb-1">Delete this contact?</p>
                <p className="text-xs text-red-500 mb-3">This action cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDelete(contact.id)}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium py-1"
              >
                <Trash2 size={14} /> Delete Contact
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Save Changes
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────

function ContactPanel({ contact, onClose, onEdit, crmCompanies, deals, contracts, projects, crmActivities }: { contact: CRMContact; onClose: () => void; onEdit?: () => void; crmCompanies: CRMCompany[]; deals: Deal[]; contracts: Contract[]; projects: Project[]; crmActivities: CRMActivity[] }) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'activity' | 'associations' | 'about'>('activity')
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
    () => (crmActivities ?? []).filter(a => a.contactId === contact.id || a.companyId === contact.companyId)
  )
  const [localTags, setLocalTags] = useState<string[]>(contact.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(true)
  const [moreMenu, setMoreMenu] = useState(false)
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [engagementScore, setEngagementScore] = useState(0)
  const [engagementBreakdown, setEngagementBreakdown] = useState({ emailsOpened: 0, linksClicked: 0, proposalsViewed: 0, meetings: 0 })
  const [engagementPoints, setEngagementPoints] = useState({ emailOpened: 5, linkClicked: 10, proposalViewed: 15, meetingHeld: 20 })
  const [engagementThresholds, setEngagementThresholds] = useState({ cold: 20, hot: 60 })
  const [aiScore, setAiScore] = useState<{ score: number; explanation: string } | null>(null)
  const [aiScoreLoading, setAiScoreLoading] = useState(true)
  const [showAiExplanation, setShowAiExplanation] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiDraftContent, setAiDraftContent] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.engagement?.thresholds) setEngagementThresholds(prev => ({ ...prev, ...d.engagement.thresholds }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/crm/contacts/${contact.id}/ai-score`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.score !== undefined) setAiScore(data)
      })
      .catch(() => {})
      .finally(() => setAiScoreLoading(false))
  }, [contact.id])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/crm/contacts/${contact.id}/timeline`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data) {
          setTimelineEntries(data.timeline ?? [])
          setEngagementScore(data.engagementScore ?? 0)
          setEngagementBreakdown(data.engagementBreakdown ?? { emailsOpened: 0, linksClicked: 0, proposalsViewed: 0, meetings: 0 })
          if (data.engagementPoints) setEngagementPoints(data.engagementPoints)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTimelineLoading(false) })
    return () => { cancelled = true }
  }, [contact.id])

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

  async function handleSaveActivity(activity: LoggedActivity) {
    const entry = {
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
    }
    setLocalActivities(prev => [entry, ...prev])
    setLoggingActivity(false)
    setTab('activity')
    const now = new Date().toISOString()
    try {
      await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      fetch(`/api/crm/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastActivity: now }),
      }).catch(() => toast('Failed to update contact activity date', 'error'))
    } catch { console.warn('Failed to persist activity to server') }
  }

  function persistTags(tags: string[]) {
    fetch(`/api/crm/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }).catch(() => toast('Failed to save contact tags', 'error'))
  }

  function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || localTags.includes(tag)) return
    const updated = [...localTags, tag]
    setLocalTags(updated)
    setNewTag('')
    setAddingTag(false)
    persistTags(updated)
  }

  function handleRemoveTag(tag: string) {
    const updated = localTags.filter(t => t !== tag)
    setLocalTags(updated)
    persistTags(updated)
  }

  const company = crmCompanies.find(c => c.id === contact.companyId)
  const contactDeals = deals.filter(d => d.company === contact.companyName)
  const contactContracts = contracts.filter(c => c.company === contact.companyName)
  const companyProject = projects.find(p => p.company === contact.companyName)
  const activeDeal = contactDeals.find(d => !d.stage.startsWith('Closed'))
  const executedContract = contactContracts.find(c => c.status === 'Fully Executed')
  const totalActivities = localActivities.length + localNotes.length + localTasks.length

  const LIFECYCLE_OPTIONS = ['Lead', 'Opportunity', 'Client', 'Other'] as const
  const LEAD_STATUS_OPTIONS = ['New', 'Open', 'In Progress', 'Open Deal', 'Unqualified', 'Attempted to Contact', 'Connected', 'Bad Timing'] as const

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200 w-full sm:w-[min(560px,100vw)]">

        {/* ── Header ── */}
        <div className="flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <button onClick={onClose} className="flex items-center gap-1 text-white/60 hover:text-white text-xs font-medium">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center min-w-0 px-4">
              <p className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">Contact | {contact.companyName}</p>
            </div>
            <div className="flex items-center gap-1">
              {onEdit && (
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10" title="Edit contact">
                  <Pencil size={14} className="text-white/50" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
                <X size={14} className="text-white/50" />
              </button>
            </div>
          </div>

          {/* Avatar + name */}
          <div className="flex flex-col items-center px-5 pb-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white mb-2 ring-2 ring-white/20" style={{ background: '#015035' }}>
              {contact.firstName[0]}{contact.lastName[0]}
            </div>
            <h2 className="text-white text-base font-bold">{contact.emails[0] ?? contact.fullName}</h2>
            <p className="text-white/50 text-xs">{contact.title}{contact.isPrimary ? ' · Primary' : ''}</p>
          </div>

          {/* Circular action buttons */}
          <div className="flex justify-center gap-6 pb-4">
            {[
              { icon: <Phone size={16} />, label: 'Call', href: `tel:${contact.phones[0] ?? ''}`, type: 'link' as const },
              { icon: <Mail size={16} />, label: 'Email', href: `mailto:${contact.emails[0] ?? ''}`, type: 'link' as const },
              { icon: <MessageCircle size={16} />, label: 'SMS', href: `/messaging?contact=${contact.id}`, type: 'link' as const },
              { icon: <Linkedin size={16} />, label: 'LinkedIn', href: contact.linkedIn ?? '', type: 'link' as const },
              { icon: <Plus size={16} />, label: 'More', type: 'button' as const },
            ].map(action => (
              <div key={action.label} className="flex flex-col items-center gap-1.5">
                {action.type === 'link' && action.href ? (
                  <a
                    href={action.href}
                    target={action.label === 'LinkedIn' ? '_blank' : undefined}
                    rel={action.label === 'LinkedIn' ? 'noopener noreferrer' : undefined}
                    className="w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {action.icon}
                  </a>
                ) : (
                  <button
                    onClick={() => setMoreMenu(v => !v)}
                    className="w-11 h-11 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors relative"
                  >
                    {action.icon}
                  </button>
                )}
                <span className="text-white/50 text-[10px] font-medium">{action.label}</span>
              </div>
            ))}
          </div>

          {/* More dropdown */}
          {moreMenu && (
            <div className="mx-5 mb-3 bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
              <button onClick={() => { setLoggingActivity(true); setTab('activity'); setMoreMenu(false) }} className="flex items-center gap-2 text-white/80 hover:bg-white/10 rounded-lg px-3 py-2 text-xs font-medium">
                <Plus size={13} /> Log Activity
              </button>
              <button onClick={() => { setAddingNote(true); setTab('activity'); setMoreMenu(false) }} className="flex items-center gap-2 text-white/80 hover:bg-white/10 rounded-lg px-3 py-2 text-xs font-medium">
                <StickyNote size={13} /> Add Note
              </button>
              <button onClick={() => { setAddingTask(true); setTab('activity'); setMoreMenu(false) }} className="flex items-center gap-2 text-white/80 hover:bg-white/10 rounded-lg px-3 py-2 text-xs font-medium">
                <CheckSquare size={13} /> Create Task
              </button>
              {contact.website && (
                <a href={`https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/80 hover:bg-white/10 rounded-lg px-3 py-2 text-xs font-medium">
                  <Globe size={13} /> Visit Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {([
            { id: 'activity' as const, label: 'Activity' },
            { id: 'associations' as const, label: 'Associations' },
            { id: 'about' as const, label: 'About' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-emerald-600 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══════ ACTIVITY TAB ══════ */}
          {tab === 'activity' && (
            <div className="flex flex-col">
              {/* Filter + count */}
              <div className="px-5 pt-4 pb-2">
                <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition-colors">
                  Filter Activity ({totalActivities}/{totalActivities})
                  <ChevronRight size={11} className="rotate-90" />
                </button>
              </div>

              {/* AI Summarize button */}
              <div className="px-5 pb-3">
                <AiInsightsPanel
                  type="contact"
                  name={contact.fullName}
                  context={[
                    `Title: ${contact.title}`,
                    `Company: ${contact.companyName}`,
                    `Owner: ${contact.owner}`,
                    activeDeal ? `Stage: ${activeDeal.stage}` : '',
                    activeDeal ? `Deal Value: $${activeDeal.value.toLocaleString()}` : 'No active deal',
                    executedContract ? 'Contract: Active' : contactContracts.length > 0 ? 'Contract: Pending' : 'Contract: None',
                    localTags.length > 0 ? `Tags: ${localTags.join(', ')}` : '',
                    contact.notes ? `Notes: ${contact.notes}` : '',
                  ].filter(Boolean).join('\n')}
                />
              </div>

              {/* Quick action buttons */}
              <div className="flex justify-center gap-6 py-3 border-b border-gray-100">
                <button
                  onClick={() => setAddingNote(true)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
                    <StickyNote size={16} />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">Add Note</span>
                </button>
                <button
                  onClick={() => setAddingTask(true)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
                    <CheckSquare size={16} />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">Create Task</span>
                </button>
                <button
                  onClick={() => setLoggingActivity(true)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
                    <Plus size={16} />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">Log Activity</span>
                </button>
                <button
                  onClick={async () => {
                    setAiGenerating(true)
                    setAiDraftContent(null)
                    try {
                      const res = await fetch('/api/ai/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'follow_up',
                          context: {
                            recipient: contact.fullName,
                            company: contact.companyName,
                            lastInteraction: contact.lastActivity ? `Last active ${new Date(contact.lastActivity).toLocaleDateString()}` : 'initial outreach',
                            goal: activeDeal ? `Progress ${activeDeal.stage} deal` : 'Re-engage contact',
                          },
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setAiDraftContent(data.content)
                      }
                    } catch { /* ignore */ }
                    setAiGenerating(false)
                  }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 hover:bg-purple-100 flex items-center justify-center text-purple-600 transition-colors">
                    {aiGenerating ? <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" /> : <Wand2 size={16} />}
                  </div>
                  <span className="text-[10px] text-purple-600 font-medium">AI Draft</span>
                </button>
              </div>

              {aiDraftContent && (
                <div className="px-5 pt-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={12} className="text-purple-600" />
                        <span className="text-xs font-semibold text-purple-800">AI-Generated Follow-Up</span>
                      </div>
                      <button onClick={() => setAiDraftContent(null)} className="text-purple-400 hover:text-purple-600">
                        <X size={12} />
                      </button>
                    </div>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{aiDraftContent}</pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiDraftContent)
                        toast('Copied to clipboard', 'success')
                      }}
                      className="mt-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                </div>
              )}

              {/* Inline forms */}
              <div className="px-5 pt-3 flex flex-col gap-3">
                {loggingActivity && (
                  <LogActivityForm
                    onSave={handleSaveActivity}
                    onCancel={() => setLoggingActivity(false)}
                    authorName="You"
                  />
                )}

                {addingNote && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-2">
                    <textarea
                      value={newNoteBody}
                      onChange={e => setNewNoteBody(e.target.value)}
                      placeholder="Write your note here..."
                      className="w-full text-sm border border-blue-200 rounded-lg p-2.5 bg-white outline-none resize-none leading-relaxed"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddNote} disabled={!newNoteBody.trim()} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>
                        Save Note
                      </button>
                      <button onClick={() => { setAddingNote(false); setNewNoteBody('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {addingTask && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex flex-col gap-2">
                    <input
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Task title..."
                      className="text-sm border border-orange-200 rounded-lg px-2.5 py-2 bg-white outline-none w-full"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newTaskType} onChange={e => setNewTaskType(e.target.value as ContactTask['taskType'])} className="text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white outline-none text-gray-700">
                        {Object.entries(taskTypeConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                      </select>
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as ContactTask['priority'])} className="text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white outline-none text-gray-700">
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="text-xs border border-orange-200 rounded-lg px-2.5 py-1.5 bg-white outline-none text-gray-700 w-full" />
                    <div className="flex gap-2">
                      <button onClick={handleAddTask} disabled={!newTaskTitle.trim() || !newTaskDue} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>
                        Save Task
                      </button>
                      <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); setNewTaskDue('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Open tasks */}
                {localTasks.filter(t => !taskDone.has(t.id)).length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Open Tasks</p>
                    {localTasks.filter(t => !taskDone.has(t.id)).map(task => {
                      const cfg = taskTypeConfig[task.taskType]
                      const isOverdue = new Date(task.dueDate) < new Date()
                      return (
                        <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                          <button
                            onClick={() => setTaskDone(prev => {
                              const next = new Set(prev)
                              next.add(task.id)
                              setLocalTasks(ts => ts.map(t => t.id === task.id ? { ...t, completed: true } : t))
                              return next
                            })}
                          >
                            <Circle size={16} className="text-gray-300 hover:text-emerald-500 transition-colors" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                              <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                                {isOverdue && 'Overdue · '}
                                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Notes */}
                {localNotes.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Notes</p>
                    {localNotes.map(note => (
                      <div key={note.id} className="p-3 bg-white rounded-xl border border-gray-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-700">{note.author}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line line-clamp-3">{note.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unified Timeline */}
                <div className="pb-6">
                  {timelineLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                    </div>
                  ) : (() => {
                    const allEntries = [
                      ...timelineEntries,
                      ...localActivities
                        .filter(a => !timelineEntries.some(t => t.id === a.id))
                        .map(a => ({
                          id: a.id,
                          type: a.type === 'call' ? 'call' : a.type === 'meeting' ? 'meeting' : a.type === 'note' ? 'note_added' : a.type === 'deal' ? 'deal_updated' : a.type === 'email' ? 'email_sent' : 'activity',
                          title: a.title,
                          description: a.body,
                          timestamp: a.timestamp,
                          metadata: { user: a.user, outcome: a.outcome, duration: a.duration },
                        } as TimelineEntry)),
                    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

                    if (allEntries.length === 0) {
                      return <p className="text-sm text-gray-400 text-center py-8">No activities logged.</p>
                    }

                    const grouped = new Map<string, TimelineEntry[]>()
                    for (const entry of allEntries) {
                      if (!entry.timestamp) continue
                      const key = getMonthKey(entry.timestamp)
                      if (!grouped.has(key)) grouped.set(key, [])
                      grouped.get(key)!.push(entry)
                    }

                    return Array.from(grouped.entries()).map(([month, entries]) => (
                      <div key={month}>
                        <div className="sticky top-0 bg-gray-50/95 backdrop-blur-sm px-1 py-2 z-10">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{month}</p>
                        </div>
                        <div className="flex flex-col">
                          {entries.map((entry, idx) => {
                            const cfg = timelineTypeConfig[entry.type] ?? timelineTypeConfig.activity
                            return (
                              <div key={entry.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                                    style={{ background: `${cfg.color}15`, color: cfg.color }}
                                  >
                                    {cfg.icon}
                                  </div>
                                  {idx < entries.length - 1 && (
                                    <div className="w-px flex-1 bg-gray-100 my-1" />
                                  )}
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                                      <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                                    </div>
                                    <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">
                                      {formatRelativeTime(entry.timestamp)}
                                    </span>
                                  </div>
                                  {entry.description && (
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{entry.description}</p>
                                  )}
                                  {entry.metadata && typeof entry.metadata === 'object' && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {(entry.metadata as Record<string, string>).outcome && (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                          {String((entry.metadata as Record<string, string>).outcome)}
                                        </span>
                                      )}
                                      {(entry.metadata as Record<string, string>).user && (
                                        <span className="text-[10px] text-gray-400">by {String((entry.metadata as Record<string, string>).user)}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}</div>
              </div>
            </div>
          )}

          {/* ══════ ASSOCIATIONS TAB ══════ */}
          {tab === 'associations' && (
            <div className="flex flex-col">
              {/* Companies section */}
              <div className="border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">Companies</p>
                <Link
                  href="/crm/companies"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {company?.name[0] ?? contact.companyName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{contact.companyName}</p>
                        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Primary</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{company?.website ?? ''}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                </Link>
              </div>

              {/* Deals section */}
              <div className="border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">Deals</p>
                {contactDeals.map(d => (
                  <Link
                    key={d.id}
                    href="/crm/pipeline"
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{d.serviceType}</p>
                        <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      </div>
                      <p className="text-xs text-gray-400">{formatCurrency(d.value)} · {d.probability}% probability</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
                <Link
                  href="/crm/pipeline"
                  className="flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={14} className="text-gray-400" /> Add Deals
                </Link>
              </div>

              {/* Contracts section */}
              <div className="border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">Contracts</p>
                {contactContracts.map(c => (
                  <Link
                    key={c.id}
                    href="/contracts"
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.serviceType}</p>
                        <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                      </div>
                      <p className="text-xs text-gray-400">{formatCurrency(c.value)} · {c.billingStructure}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
                <Link
                  href="/contracts"
                  className="flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={14} className="text-gray-400" /> Add Contracts
                </Link>
              </div>

              {/* Projects section */}
              <div className="border-b border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">Projects</p>
                {companyProject ? (
                  <Link
                    href="/projects"
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderKanban size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{companyProject.serviceType}</p>
                        <div className="flex items-center gap-2">
                          <StatusBadge label={companyProject.status} colorClass={projectStatusColors[companyProject.status]} />
                          <span className="text-xs text-gray-400">{companyProject.progress}% complete</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </Link>
                ) : null}
                <Link
                  href="/projects"
                  className="flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={14} className="text-gray-400" /> Add Projects
                </Link>
              </div>

              {/* Tickets section */}
              <div>
                <Link
                  href="/tickets"
                  className="flex items-center gap-2 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={14} className="text-gray-400" /> Add Tickets
                </Link>
              </div>
            </div>
          )}

          {/* ══════ ABOUT TAB ══════ */}
          {tab === 'about' && (
            <div className="flex flex-col">
              <EngagementScoreBar score={engagementScore} breakdown={engagementBreakdown} points={engagementPoints} thresholds={engagementThresholds} />

              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-purple-600" />
                    <span className="text-sm font-bold text-gray-900">AI Lead Score</span>
                  </div>
                  {aiScoreLoading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                  ) : aiScore ? (
                    <button
                      onClick={() => setShowAiExplanation(v => !v)}
                      className="flex items-center gap-1.5"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: aiScore.score >= 70 ? '#22c55e' : aiScore.score >= 30 ? '#f59e0b' : '#ef4444' }}
                      >
                        {aiScore.score}
                      </div>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          color: aiScore.score >= 70 ? '#15803d' : aiScore.score >= 30 ? '#b45309' : '#dc2626',
                          background: aiScore.score >= 70 ? '#f0fdf4' : aiScore.score >= 30 ? '#fffbeb' : '#fef2f2',
                        }}
                      >
                        {aiScore.score >= 70 ? 'High' : aiScore.score >= 30 ? 'Medium' : 'Low'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Unavailable</span>
                  )}
                </div>
                {showAiExplanation && aiScore && (
                  <p className="text-xs text-gray-600 leading-relaxed mt-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    {aiScore.explanation}
                  </p>
                )}
              </div>

              <button
                onClick={() => setAboutOpen(v => !v)}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-bold text-gray-900">About this contact</p>
                <ChevronRight size={14} className={`text-gray-400 transition-transform ${aboutOpen ? 'rotate-90' : ''}`} />
              </button>

              {aboutOpen && (
                <div className="border-t border-gray-100">
                  {/* Email */}
                  <FieldRow label="Email" value={
                    contact.emails[0] ? (
                      <a href={`mailto:${contact.emails[0]}`} className="text-sm text-gray-900 hover:text-emerald-700">{contact.emails[0]}</a>
                    ) : <span className="text-sm text-gray-300">—</span>
                  } />

                  {/* Phone */}
                  <FieldRow label="Phone Number" value={
                    contact.phones[0] ? (
                      <a href={`tel:${contact.phones[0]}`} className="text-sm text-gray-900">{contact.phones[0]}</a>
                    ) : <span className="text-sm text-gray-300">—</span>
                  } />

                  {/* Contact Owner */}
                  <FieldRow label="Contact owner" value={
                    <span className="text-sm font-medium text-gray-900">{contact.owner}</span>
                  } />

                  {/* Last Contacted */}
                  <FieldRow label="Last Contacted" value={
                    contact.lastActivity ? (
                      <span className="text-sm text-gray-900">
                        {new Date(contact.lastActivity).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        {' at '}
                        {new Date(contact.lastActivity).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    ) : <span className="text-sm text-gray-300">Never</span>
                  } />

                  {/* Lifecycle Stage */}
                  <FieldRow label="Lifecycle Stage" value={
                    <span className="text-sm font-medium text-gray-900 capitalize">{contact.lifecycleStage ?? 'Lead'}</span>
                  } />

                  {/* Lead Status */}
                  <FieldRow label="Lead Status" value={
                    <span className="text-sm text-gray-900 capitalize">{contact.leadStatus?.replace(/_/g, ' ') ?? '—'}</span>
                  } />

                  {/* Company Name */}
                  <FieldRow label="Company Name" value={
                    <Link href="/crm/companies" className="text-sm text-gray-900 hover:text-emerald-700">{contact.companyName}</Link>
                  } />

                  {/* Industry */}
                  <FieldRow label="Industry" value={
                    <span className="text-sm text-gray-900">{company?.industry || '—'}</span>
                  } />

                  {/* Title */}
                  <FieldRow label="Job Title" value={
                    <span className="text-sm text-gray-900">{contact.title || '—'}</span>
                  } />

                  {/* Website */}
                  <FieldRow label="Website" value={
                    contact.website ? (
                      <a href={`https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:underline">{contact.website}</a>
                    ) : <span className="text-sm text-gray-300">—</span>
                  } />

                  {/* LinkedIn */}
                  <FieldRow label="LinkedIn" value={
                    contact.linkedIn ? (
                      <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 hover:underline truncate block">{contact.linkedIn.replace('https://www.linkedin.com/in/', '')}</a>
                    ) : <span className="text-sm text-gray-300">—</span>
                  } />

                  {/* Created Date */}
                  <FieldRow label="Created" value={
                    <span className="text-sm text-gray-900">{contact.createdDate ? new Date(contact.createdDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  } />
                </div>
              )}

              {/* Tags */}
              <div className="px-5 py-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900">Tags</p>
                  <button onClick={() => setAddingTag(v => !v)} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium">
                    + Add
                  </button>
                </div>
                {addingTag && (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="New tag..."
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTag()
                        if (e.key === 'Escape') setAddingTag(false)
                      }}
                    />
                    <button onClick={handleAddTag} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold">Add</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {localTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium group">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {localTags.length === 0 && !addingTag && (
                    <span className="text-xs text-gray-400">No tags</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <span className="text-[11px] text-gray-400 font-medium">{label}</span>
      {value}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null)
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null)
  const [localContacts, setLocalContacts] = useState<CRMContact[]>([])
  const [creatingContact, setCreatingContact] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showBulkTag, setShowBulkTag] = useState(false)
  const [bulkTagValue, setBulkTagValue] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gravhub-contacts-pageSize')
      return saved ? Number(saved) : 25
    }
    return 25
  })

  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>([])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    localStorage.setItem('gravhub-contacts-pageSize', String(size))
  }, [])

  useEffect(() => {
    fetch('/api/crm/contacts')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalContacts(data) })
      .catch(() => toast('Failed to load contacts', 'error'))
      .finally(() => setLoading(false))
    fetchCrmCompanies().then(setCrmCompanies)
    fetchDeals().then(setDeals)
    fetchContracts().then(setContracts)
    fetchProjects().then(setProjects)
    fetchCrmActivities().then(setCrmActivities)
  }, [])

  async function handleEditSave(updated: CRMContact) {
    setLocalContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditingContact(null)
    if (selectedContact?.id === updated.id) setSelectedContact(updated)
    await fetch(`/api/crm/contacts/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => toast('Failed to save contact changes', 'error'))
  }

  async function handleDelete(id: string) {
    setLocalContacts(prev => prev.filter(c => c.id !== id))
    setEditingContact(null)
    if (selectedContact?.id === id) setSelectedContact(null)
    await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' }).catch(() => toast('Failed to delete contact', 'error'))
  }

  async function handleNewContact(data: NewContactFormData) {
    const company = crmCompanies.find(c => c.name === data.companyName)
    const payload = {
      companyId: company?.id ?? `co-${Date.now()}`,
      companyName: data.companyName,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`,
      title: data.title,
      emails: [data.email].filter(Boolean),
      phones: [data.phone, data.mobile].filter(Boolean),
      linkedIn: data.linkedIn || undefined,
      website: data.website || undefined,
      isPrimary: false,
      owner: data.owner,
      tags: [],
      notes: data.notes || undefined,
      contactNotes: [],
      contactTasks: [],
      createdDate: new Date().toISOString().split('T')[0],
    }
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        toast('Failed to create contact', 'error')
        setCreatingContact(false)
        return
      }
      const saved = await res.json()
      setLocalContacts(prev => [saved, ...prev])
      toast('Contact created', 'success')
    } catch {
      toast('Failed to create contact', 'error')
    }
    setCreatingContact(false)
  }

  const filtered = localContacts.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.emails.join(' ').toLowerCase().includes(search.toLowerCase())
  )

  const allFilteredIds = filtered.map(c => c.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allFilteredIds))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    setLocalContacts(prev => prev.filter(c => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contacts', ids }),
      })
      toast(`${ids.length} contacts deleted`, 'success')
    } catch {
      toast('Failed to delete contacts', 'error')
    }
  }

  async function handleBulkTag() {
    const tag = bulkTagValue.trim()
    if (!tag) return
    const ids = Array.from(selectedIds)
    setLocalContacts(prev => prev.map(c =>
      selectedIds.has(c.id) && !c.tags.includes(tag)
        ? { ...c, tags: [...c.tags, tag] }
        : c
    ))
    setShowBulkTag(false)
    setBulkTagValue('')
    setSelectedIds(new Set())
    for (const id of ids) {
      const contact = localContacts.find(c => c.id === id)
      if (contact && !contact.tags.includes(tag)) {
        fetch(`/api/crm/contacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: [...contact.tags, tag] }),
        }).catch(() => {})
      }
    }
    toast(`Tag "${tag}" applied to ${ids.length} contacts`, 'success')
  }

  useEffect(() => { setCurrentPage(1) }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedContacts = filtered.slice(startIndex, startIndex + pageSize)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Contact', onClick: () => setCreatingContact(true) }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col bg-[#f8faf9]">

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
          <button
            onClick={() => setShowDuplicates(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <GitMerge size={13} /> Show Duplicates
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Upload size={13} /> Import CSV
          </button>
          <span className="ml-auto text-sm text-gray-400">{filtered.length} contacts</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {paginatedContacts.map(contact => {
              const stage = contact.lifecycleStage ?? 'Lead'
              return (
                <div key={contact.id} onClick={() => setSelectedContact(contact)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <span className="font-semibold text-sm text-gray-900">{contact.fullName}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: '#e6f0ec', color: '#015035' }}>
                      {stage}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Company: <span className="text-gray-700">{contact.companyName}</span></div>
                    {contact.emails[0] && (
                      <div>Email: <span className="text-gray-700">{contact.emails[0]}</span></div>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <User size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No contacts match your search.</p>
              </div>
            )}
          </div>
          {/* Desktop table view */}
          <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="w-10 py-2.5 px-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                  />
                </th>
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
              {paginatedContacts.map(contact => {
                const activeDeal = deals.find(d => d.company === contact.companyName && !d.stage.startsWith('Closed'))
                const contactContract = contracts.find(c => c.company === contact.companyName)
                return (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(contact.id) ? 'bg-emerald-50/50' : ''}`}
                  >
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelect(contact.id)}
                        className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                      />
                    </td>
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
                        <a href={`mailto:${contact.emails[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Mail size={13} />
                        </a>
                        <a href={`tel:${contact.phones[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Phone size={13} />
                        </a>
                        <Link href={`/messaging?contact=${contact.id}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors" title="Send SMS">
                          <MessageCircle size={13} />
                        </Link>
                        {contact.linkedIn && (
                          <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                            <Linkedin size={13} />
                          </a>
                        )}
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit contact"
                        >
                          <Pencil size={13} />
                        </button>
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
          {filtered.length > 0 && (
            <div className="border-t border-gray-100">
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      {selectedContact && (
        <ContactPanel
          contact={localContacts.find(c => c.id === selectedContact.id) ?? selectedContact}
          crmCompanies={crmCompanies}
          deals={deals}
          contracts={contracts}
          projects={projects}
          crmActivities={crmActivities}
          onClose={() => setSelectedContact(null)}
          onEdit={() => setEditingContact(localContacts.find(c => c.id === selectedContact.id) ?? selectedContact)}
        />
      )}
      {creatingContact && <NewContactPanel onSave={handleNewContact} onClose={() => setCreatingContact(false)} />}
      {editingContact && (
        <EditContactPanel
          contact={editingContact}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onClose={() => setEditingContact(null)}
        />
      )}
      {showImport && (
        <HubSpotImportPanel
          defaultType="contacts"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            fetch('/api/crm/contacts').then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setLocalContacts(data) })
          }}
          onShowDuplicates={() => setShowDuplicates(true)}
        />
      )}
      {showDuplicates && (
        <DuplicatesPanel
          type="contacts"
          onClose={() => setShowDuplicates(false)}
          onMergeComplete={() => {
            fetch('/api/crm/contacts').then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setLocalContacts(data) })
          }}
        />
      )}
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {} },
            { label: 'Tag', icon: <Tag size={13} />, onClick: () => setShowBulkTag(true) },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} contacts?`}
          description="This action cannot be undone. Selected contacts will be permanently removed."
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
      {showBulkTag && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBulkTag(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Tag {selectedIds.size} contacts</p>
              <p className="text-xs text-gray-500 mt-0.5">Apply a tag to all selected contacts</p>
            </div>
            <input
              value={bulkTagValue}
              onChange={e => setBulkTagValue(e.target.value)}
              placeholder="Tag name..."
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleBulkTag() }}
            />
            <div className="flex gap-2">
              <button onClick={handleBulkTag} disabled={!bulkTagValue.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>Apply Tag</button>
              <button onClick={() => setShowBulkTag(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
