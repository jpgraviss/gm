'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { useTeamMembers } from '@/lib/useTeamMembers'
import { fetchCrmCompanies, fetchCrmContacts, fetchDeals, fetchContracts, fetchInvoices, fetchProjects, fetchCrmActivities } from '@/lib/supabase'
import {
  formatCurrency, stageColors, serviceTypeColors, contractStatusColors,
  projectStatusColors, invoiceStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewCompanyPanel, { type NewCompanyFormData } from '@/components/crm/NewCompanyPanel'
import HubSpotImportPanel from '@/components/crm/HubSpotImportPanel'
import NewContactPanel, { type NewContactFormData } from '@/components/crm/NewContactPanel'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import AiInsightsPanel from '@/components/crm/AiInsightsPanel'
import type { CRMCompany, CRMContact, CompanyStatus, Deal, Contract, Invoice, Project, CRMActivity, AppTask } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { downloadCsv } from '@/lib/csv-export'
import {
  X, Phone, Mail, Building2, MapPin, Users, Globe, DollarSign,
  User, Filter, Search, Plus, FileText, ScrollText, ChevronRight, ChevronLeft,
  ExternalLink, TrendingUp, FolderKanban, Pencil, Tag, Trash2, Upload, BarChart3,
  Monitor, Loader2, Sparkles, Wand2, Share2, Brain, Download, GitMerge, ArrowUpDown,
  CheckSquare, Circle, CheckCircle2,
} from 'lucide-react'
import ClientIntegrationsPanel from '@/components/crm/ClientIntegrationsPanel'
import DuplicatesPanel from '@/components/crm/DuplicatesPanel'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useEnrichment } from '@/lib/useEnrichment'
import Pagination from '@/components/ui/Pagination'

// ─── Status colors ────────────────────────────────────────────────────────────

const companyStatusColors: Record<CompanyStatus, string> = {
  Prospect: 'bg-blue-50 text-blue-700',
  'Active Client': 'bg-emerald-50 text-emerald-700',
  'Past Client': 'bg-gray-100 text-gray-600',
  Partner: 'bg-purple-50 text-purple-700',
  Churned: 'bg-red-50 text-red-600',
}

const companyStatuses: CompanyStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned']

const INDUSTRIES = [
  'Automotive',
  'Business Supplies & Equipment',
  'Capital Markets',
  'Commercial Real Estate',
  'Construction',
  'Consulting',
  'Consumer Electronics',
  'Consumer Services',
  'Education',
  'Electronics Manufacturing',
  'Energy',
  'Engineering',
  'Entertainment',
  'Financial Services',
  'Graphic Design',
  'Healthcare',
  'Hospitality',
  'Human Resources',
  'Information Technology',
  'Insurance',
  'Internet',
  'Legal Services',
  'Machinery',
  'Marketing & Advertising',
  'Media & Broadcasting',
  'Media Production',
  'Nonprofit',
  'Online Media',
  'OOH',
  'Printing',
  'Professional Training',
  'Real Estate',
  'Recreation',
  'Research',
  'Retail',
  'Software & Technology',
  'Venture Capital',
  'Other',
]

// ─── Company Files Tab ───────────────────────────────────────────────────────

interface CompanyFile {
  id: string
  name: string
  url: string
  content_type: string
  size_bytes: number
  category: string
  notes: string | null
  file_ext: string
  created_at: string
}

const FILE_CATEGORIES = ['contract', 'proposal', 'invoice', 'report', 'other'] as const

function CompanyFilesTab({ companyId }: { companyId: string }) {
  const { toast } = useToast()
  const [files, setFiles] = useState<CompanyFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    fetch(`/api/crm/companies/${companyId}/files`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setFiles(data) })
      .catch(() => toast('Failed to load files', 'error'))
      .finally(() => setLoading(false))
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList?.length) return
    setUploading(true)
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'other')
      try {
        const res = await fetch(`/api/crm/companies/${companyId}/files`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const saved = await res.json()
          setFiles(prev => [saved, ...prev])
        } else {
          toast(`Failed to upload ${file.name}`, 'error')
        }
      } catch {
        toast(`Failed to upload ${file.name}`, 'error')
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(fileId: string) {
    const removed = files.find(f => f.id === fileId)
    const removedIndex = files.findIndex(f => f.id === fileId)
    setFiles(prev => prev.filter(f => f.id !== fileId))
    try {
      const res = await fetch(`/api/crm/companies/${companyId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (removed) setFiles(prev => [...prev.slice(0, removedIndex), removed, ...prev.slice(removedIndex)])
        toast(err.error || 'Failed to delete file', 'error')
        return
      }
      toast('File deleted', 'success')
    } catch {
      if (removed) setFiles(prev => [...prev.slice(0, removedIndex), removed, ...prev.slice(removedIndex)])
      toast('Failed to delete file', 'error')
    }
  }

  async function handleCategoryChange(fileId: string, category: string) {
    const prevCategory = files.find(f => f.id === fileId)?.category
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, category } : f))
    try {
      const res = await fetch(`/api/crm/companies/${companyId}/files`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, category }),
      })
      if (!res.ok) {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, category: prevCategory ?? f.category } : f))
        toast('Failed to update file category', 'error')
      }
    } catch {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, category: prevCategory ?? f.category } : f))
      toast('Failed to update file category', 'error')
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const extIcons: Record<string, string> = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', ppt: 'PPT', pptx: 'PPT', png: 'IMG', jpg: 'IMG', jpeg: 'IMG' }

  const filteredFiles = filterCategory === 'all' ? files : files.filter(f => f.category === filterCategory)

  if (loading) return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" /></div>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {['all', ...FILE_CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium capitalize transition-colors ${
                filterCategory === cat
                  ? 'bg-[#015035] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
          uploading ? 'bg-gray-100 text-gray-400' : 'bg-[#015035] text-white hover:bg-[#012A1C]'
        }`}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Upload'}</span>
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <FileText size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-medium">No files yet</p>
          <p className="text-xs text-gray-400 mt-1">Upload contracts, proposals, and other documents</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredFiles.map(file => (
            <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                {extIcons[file.file_ext] ?? file.file_ext.toUpperCase().slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <select
                    value={file.category}
                    onChange={e => handleCategoryChange(file.id, e.target.value)}
                    className="text-[10px] font-medium bg-transparent border-none p-0 text-[#015035] focus:outline-none cursor-pointer capitalize"
                  >
                    {FILE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-[10px] text-gray-400">{formatSize(file.size_bytes)}</span>
                  <span className="text-[10px] text-gray-400">{new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-[#015035]"
                  title="Download"
                >
                  <Download size={13} />
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Company Detail Panel ─────────────────────────────────────────────────────

function CompanyPanel({ company, onClose, onEdit, onDelete, onOpenIntegrations, crmContacts, deals, contracts, invoices, projects, crmActivities }: { company: CRMCompany; onClose: () => void; onEdit?: () => void; onDelete?: () => void; onOpenIntegrations?: () => void; crmContacts: CRMContact[]; deals: Deal[]; contracts: Contract[]; invoices: Invoice[]; projects: Project[]; crmActivities: CRMActivity[] }) {
  const { toast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'contacts' | 'deals' | 'contracts' | 'files' | 'activity' | 'tasks'>('overview')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [extraContacts, setExtraContacts] = useState<CRMContact[]>([])
  const [localTags, setLocalTags] = useState<string[]>(company.tags)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [localActivities, setLocalActivities] = useState(
    () => (crmActivities ?? []).filter(a => a.companyId === company.id)
  )
  const [socialAnalysis, setSocialAnalysis] = useState<{ platforms: { name: string; url: string; status: string; notes: string }[]; summary: string; engagementOpportunities: string[] } | null>(null)
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialOpen, setSocialOpen] = useState(false)
  const [companyRecs, setCompanyRecs] = useState<{ type: string; priority: string; title: string; description: string; suggestedAction: string }[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsOpen, setRecsOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProposalContent, setAiProposalContent] = useState<string | null>(null)
  const [wpSite, setWpSite] = useState<{ id: string; site_url: string; last_reported_at: string | null } | null>(null)
  const [localNotes, setLocalNotes] = useState(company.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const lastSavedNotesRef = useRef(company.notes ?? '')
  const [companyTasks, setCompanyTasks] = useState<AppTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksLoaded, setTasksLoaded] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [aiDraftContent, setAiDraftContent] = useState<string | null>(null)
  const [aiDraftRecipientId, setAiDraftRecipientId] = useState<string | null>(null)
  const teamMembers = useTeamMembers()

  useEffect(() => {
    if (tab !== 'tasks' || tasksLoaded) return
    setTasksLoading(true)
    fetch(`/api/tasks?companyId=${encodeURIComponent(company.id)}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setCompanyTasks(Array.isArray(data) ? data : (data.items ?? [])))
      .catch(() => toast('Failed to load tasks', 'error'))
      .finally(() => { setTasksLoading(false); setTasksLoaded(true) })
  }, [tab, tasksLoaded, company.id, toast])

  async function handleAddCompanyTask() {
    if (!newTaskTitle.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          company: company.name,
          companyId: company.id,
          assignedTo: newTaskAssignee || undefined,
          dueDate: newTaskDueDate,
          category: 'General',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      setCompanyTasks(prev => [created, ...prev])
      setShowAddTask(false)
      setNewTaskTitle('')
    } catch {
      toast('Failed to add task', 'error')
    }
  }

  async function handleToggleCompanyTask(task: AppTask) {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed'
    setCompanyTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, completedDate: nextStatus === 'Completed' ? new Date().toISOString().split('T')[0] : null }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast('Failed to update task — reverted', 'error')
      setCompanyTasks(prev => prev.map(t => t.id === task.id ? task : t))
    }
  }

  async function handleGenerateAiDraft() {
    if (!draftRecipient) {
      toast('Add a contact to this company first', 'error')
      return
    }
    setAiGenerating(true)
    setAiDraftContent(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'follow_up',
          context: {
            recipient: draftRecipient.fullName,
            company: company.name,
            lastInteraction: draftRecipient.lastActivity ? `Last active ${new Date(draftRecipient.lastActivity).toLocaleDateString()}` : 'initial outreach',
            goal: openDeals.length > 0 ? `Progress ${openDeals[0].stage} deal` : 'Re-engage client',
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiDraftContent(data.content)
      }
    } catch { /* ignore */ }
    setAiGenerating(false)
  }

  useEffect(() => {
    fetch(`/api/wordpress/seo/health?companyId=${encodeURIComponent(company.id)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setWpSite(data[0]) })
      .catch(() => {/* non-blocking */})
  }, [company.id])

  function persistTags(tags: string[]) {
    fetch(`/api/crm/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }).catch(() => toast('Failed to save company tags', 'error'))
  }

  async function saveNotes() {
    if (localNotes === lastSavedNotesRef.current) return
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/crm/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: localNotes }),
      })
      if (!res.ok) throw new Error('Failed')
      lastSavedNotesRef.current = localNotes
    } catch {
      toast('Failed to save notes', 'error')
    } finally {
      setSavingNotes(false)
    }
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

  async function handleAddContact(data: NewContactFormData) {
    const payload = {
      companyId: company.id,
      companyName: company.name,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`,
      title: data.title,
      emails: data.email ? [data.email] : [],
      phones: data.phone ? [data.phone] : [],
      linkedIn: data.linkedIn || null,
      website: data.website || null,
      isPrimary: false,
      owner: data.owner,
      tags: [],
      contactNotes: [],
      contactTasks: [],
    }
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saved: CRMContact = res.ok ? await res.json() : { ...payload, id: `contact-${Date.now()}`, createdDate: new Date().toISOString().split('T')[0] }
      setExtraContacts(prev => [...prev, saved])
    } catch {
      setExtraContacts(prev => [...prev, { ...payload, id: `contact-${Date.now()}`, createdDate: new Date().toISOString().split('T')[0] } as CRMContact])
    }
    setAddingContact(false)
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
      companyId: company.id,
      companyName: company.name,
    }
    setLocalActivities(prev => [entry, ...prev])
    setLoggingActivity(false)
    setTab('activity')
    try {
      await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
    } catch { console.warn('Failed to persist activity to server') }
  }

  async function handleUpdateActivity(id: string, updates: { title: string; body: string }) {
    const prev = localActivities
    setLocalActivities(prevList => prevList.map(a => a.id === id ? { ...a, title: updates.title, body: updates.body } : a))
    try {
      const res = await fetch(`/api/crm/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
    } catch {
      setLocalActivities(prev)
      toast('Failed to save changes', 'error')
    }
  }

  // Cross-linked data
  const companyContacts = crmContacts.filter(c => c.companyId === company.id)
  const draftRecipient = companyContacts.find(c => c.id === aiDraftRecipientId)
    ?? companyContacts.find(c => c.isPrimary)
    ?? companyContacts[0]
  const companyDeals = deals.filter(d => d.company === company.name)
  const companyContracts = contracts.filter(c => c.company === company.name)
  const companyInvoices = invoices.filter(i => i.company === company.name)
  const companyProject = projects.find(p => p.company === company.name)

  const totalInvoiced = companyInvoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = companyInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const openDeals = companyDeals.filter(d => !d.stage.startsWith('Closed'))

  return (
    <>
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(560px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                {company.name[0]}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-bold truncate" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {company.name}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                    {company.status}
                  </span>
                  <span className="text-white/40 text-xs">{company.industry}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={`/portal/preview?company=${encodeURIComponent(company.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
                title="Preview client portal"
              >
                <Monitor size={15} className="text-white/60" />
              </a>
              {onOpenIntegrations && (
                <button onClick={onOpenIntegrations} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Client integrations">
                  <BarChart3 size={15} className="text-white/60" />
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Edit company">
                  <Pencil size={15} className="text-white/60" />
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 flex-shrink-0" title="Delete company">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
                <X size={18} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Deal Value', value: formatCurrency(company.totalDealValue) },
              { label: 'Contacts', value: companyContacts.length.toString() },
              { label: 'Open Deals', value: openDeals.length.toString() },
              { label: 'Paid', value: formatCurrency(totalPaid) },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'contacts', 'deals', 'contracts', 'files', 'activity', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Details</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<Building2 size={14} />} label="Industry" value={company.industry} />
                  <InfoRow icon={<MapPin size={14} />} label="HQ" value={company.hq} />
                  <InfoRow icon={<Users size={14} />} label="Size" value={company.size ? `${company.size} employees` : ''} />
                  {company.annualRevenue && (
                    <InfoRow icon={<DollarSign size={14} />} label="Annual Revenue" value={formatCurrency(company.annualRevenue)} />
                  )}
                  {company.phone && <InfoRow icon={<Phone size={14} />} label="Phone" value={company.phone} />}
                  {company.website && (
                    <InfoRow icon={<Globe size={14} />} label="Website" value={
                      <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1">
                        {company.website} <ExternalLink size={11} />
                      </a>
                    } />
                  )}
                  <InfoRow icon={<User size={14} />} label="Owner" value={company.owner} />
                </div>
              </div>

              {company.description && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
                </div>
              )}

              {/* Primary contact quick view */}
              {companyContacts.filter(c => c.isPrimary).map(c => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Contact</p>
                    <button onClick={() => setTab('contacts')} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      All contacts <ChevronRight size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      <p className="text-xs text-gray-400">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a href={`mailto:${c.emails[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Mail size={13} />
                      </a>
                      <a href={`tel:${c.phones[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Phone size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              {/* AI Insights */}
              <AiInsightsPanel
                type="company"
                name={company.name}
                context={[
                  `Industry: ${company.industry}`,
                  `Status: ${company.status}`,
                  `HQ: ${company.hq}`,
                  `Size: ${company.size} employees`,
                  company.annualRevenue ? `Annual Revenue: $${company.annualRevenue.toLocaleString()}` : '',
                  `Owner: ${company.owner}`,
                  `Open Deals: ${openDeals.length}`,
                  `Total Deal Value: $${company.totalDealValue.toLocaleString()}`,
                  company.description ? `Description: ${company.description}` : '',
                ].filter(Boolean).join('\n')}
              />

              {/* AI Recommendations */}
              <div className="border border-purple-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!recsOpen && companyRecs.length === 0) {
                      setRecsOpen(true)
                      setRecsLoading(true)
                      fetch(`/api/ai/recommendations?companyId=${company.id}`)
                        .then(r => r.ok ? r.json() : [])
                        .then(data => { if (Array.isArray(data)) setCompanyRecs(data) })
                        .catch(() => {})
                        .finally(() => setRecsLoading(false))
                    } else {
                      setRecsOpen(v => !v)
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-purple-600" />
                    <span className="text-sm font-semibold text-purple-800">AI Recommendations</span>
                  </div>
                  <ChevronRight size={14} className={`text-purple-600 transition-transform ${recsOpen ? 'rotate-90' : ''}`} />
                </button>
                {recsOpen && (
                  <div className="px-4 py-3 bg-white">
                    {recsLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                        <span className="text-xs text-gray-400">Analyzing...</span>
                      </div>
                    ) : companyRecs.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No recommendations at this time.</p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {companyRecs.map((rec, i) => (
                          <div key={i} className="p-3 border border-gray-100 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                rec.priority === 'high' ? 'bg-red-50 text-red-600' :
                                rec.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                'bg-gray-50 text-gray-500'
                              }`}>{rec.priority}</span>
                              <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{rec.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
                            <p className="text-xs text-purple-700 mt-1.5 font-medium">{rec.suggestedAction}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Social Insights */}
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!socialOpen && !socialAnalysis) {
                      setSocialOpen(true)
                      setSocialLoading(true)
                      fetch(`/api/crm/companies/${company.id}/social-analysis`)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => { if (data) setSocialAnalysis(data) })
                        .catch(() => {})
                        .finally(() => setSocialLoading(false))
                    } else {
                      setSocialOpen(v => !v)
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Share2 size={14} className="text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Social Insights</span>
                  </div>
                  <ChevronRight size={14} className={`text-blue-600 transition-transform ${socialOpen ? 'rotate-90' : ''}`} />
                </button>
                {socialOpen && (
                  <div className="px-4 py-3 bg-white">
                    {socialLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                        <span className="text-xs text-gray-400">Analyzing social presence...</span>
                      </div>
                    ) : socialAnalysis ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                          {socialAnalysis.platforms.map(p => (
                            <div key={p.name} className="flex items-center gap-1.5" title={p.status === 'active' ? 'URL on file — not verified live' : 'No URL on file'}>
                              <div className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">{p.name}</a>
                              ) : (
                                <span className="text-xs text-gray-400">{p.name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{socialAnalysis.summary}</p>
                        {socialAnalysis.engagementOpportunities.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Engagement Opportunities</p>
                            <ul className="flex flex-col gap-1">
                              {socialAnalysis.engagementOpportunities.map((opp, i) => (
                                <li key={i} className="flex gap-2 text-xs text-gray-600">
                                  <span className="text-blue-500 flex-shrink-0">-</span>
                                  {opp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-2">Unable to analyze social presence.</p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Proposal Summary button */}
              {openDeals.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <button
                    onClick={async () => {
                      setAiGenerating(true)
                      setAiProposalContent(null)
                      try {
                        const res = await fetch('/api/ai/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'proposal_summary',
                            context: {
                              company: company.name,
                              services: openDeals.map(d => d.serviceType).join(', '),
                              value: `$${openDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}`,
                              additionalContext: `Industry: ${company.industry}, Size: ${company.size}`,
                            },
                          }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          setAiProposalContent(data.content)
                        }
                      } catch { /* ignore */ }
                      setAiGenerating(false)
                    }}
                    disabled={aiGenerating}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    AI Proposal Summary
                  </button>
                  {aiProposalContent && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{aiProposalContent}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiProposalContent)
                          toast('Copied to clipboard', 'success')
                        }}
                        className="mt-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
                      >
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Connected WordPress site */}
              {wpSite && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">WordPress SEO</p>
                    <Link href="/rank-tracker/wordpress" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                    <Globe size={14} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{wpSite.site_url}</p>
                      <p className="text-[11px] text-gray-400">
                        {wpSite.last_reported_at
                          ? `Last report: ${new Date(wpSite.last_reported_at).toLocaleDateString()}`
                          : 'Connected — no data reported yet'}
                      </p>
                    </div>
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
                    <div className="flex items-center gap-2 flex-1">
                      <FolderKanban size={14} className="text-gray-400 flex-shrink-0" />
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

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                  <button
                    onClick={() => setAddingTag(v => !v)}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900"
                  >
                    <Plus size={12} /> Add Tag
                  </button>
                </div>
                {addingTag && (
                  <div className="flex gap-2 mb-2">
                    <input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="New tag..."
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTag()
                        if (e.key === 'Escape') setAddingTag(false)
                      }}
                    />
                    <button onClick={handleAddTag} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium">Add</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {localTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full group">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {localTags.length === 0 && !addingTag && (
                    <span className="text-xs text-gray-400">No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Contacts ── */}
          {tab === 'contacts' && (
            <div className="flex flex-col gap-3">
              {[...companyContacts, ...extraContacts].map(c => (
                <div key={c.id} onClick={() => router.push(`/crm/contacts?open=${c.id}`)} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      {c.isPrimary && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.emails[0] ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`mailto:${c.emails[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                      <Mail size={13} />
                    </a>
                    <a href={`tel:${c.phones[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
              ))}
              {companyContacts.length === 0 && extraContacts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No contacts linked to this company.</p>
              )}
              <button
                onClick={() => setAddingContact(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Add Contact
              </button>
            </div>
          )}

          {/* ── Deals ── */}
          {tab === 'deals' && (
            <div className="flex flex-col gap-3">
              {companyDeals.map(d => (
                <div key={d.id} onClick={() => router.push(`/crm/pipeline?open=${d.id}`)} className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      <StatusBadge label={d.serviceType} colorClass={serviceTypeColors[d.serviceType]} />
                    </div>
                    <p className="text-base font-bold flex-shrink-0" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(d.value)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{d.contact.name} · {d.contact.title}</span>
                    <span>Close {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{d.probability}% probability</span>
                  </div>
                </div>
              ))}
              {companyDeals.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No deals linked to this company.</p>
              )}
              <button
                onClick={() => setCreatingProposal(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> New Proposal
              </button>
            </div>
          )}

          {/* ── Contracts ── */}
          {tab === 'contracts' && (
            <div className="flex flex-col gap-3">
              {companyContracts.map(c => (
                <div key={c.id} onClick={() => router.push(`/contracts?open=${c.id}`)} className="p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
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
                      { label: 'Start', value: new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                      { label: 'Renewal', value: new Date(c.renewalDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                    ].map(f => (
                      <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                        <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Invoices for this contract */}
                  {companyInvoices.filter(i => i.company === c.company).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Invoices</p>
                      <div className="flex flex-col gap-1.5">
                        {companyInvoices.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                              <span className="text-gray-500">Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{formatCurrency(inv.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">Total Invoiced: {formatCurrency(totalInvoiced)}</span>
                        <span className="font-semibold text-emerald-700">Paid: {formatCurrency(totalPaid)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {companyContracts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No contracts found for this company.</p>
              )}
            </div>
          )}

          {/* ── Files ── */}
          {tab === 'files' && (
            <CompanyFilesTab companyId={company.id} />
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</p>
                  {savingNotes && <span className="text-[10px] text-gray-400">Saving...</span>}
                </div>
                <textarea
                  value={localNotes}
                  onChange={e => setLocalNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Persistent notes about this client — visible to your whole team."
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y bg-white"
                />
              </div>
              <ActivityTimeline activities={localActivities} onUpdate={handleUpdateActivity} />
            </div>
          )}

          {/* ── Tasks ── */}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks for {company.name}</p>
                <button
                  onClick={() => setShowAddTask(v => !v)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus size={12} /> New Task
                </button>
              </div>

              {showAddTask && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-2">
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="Task title"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newTaskAssignee}
                      onChange={e => setNewTaskAssignee(e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddCompanyTask} disabled={!newTaskTitle.trim()} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>
                      Add Task
                    </button>
                    <button onClick={() => { setShowAddTask(false); setNewTaskTitle('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-gray-300" />
                </div>
              ) : companyTasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No tasks for this company yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {companyTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg">
                      <button onClick={() => handleToggleCompanyTask(t)} className="flex-shrink-0">
                        {t.status === 'Completed'
                          ? <CheckCircle2 size={16} className="text-emerald-600" />
                          : <Circle size={16} className="text-gray-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${t.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.title}</p>
                        <p className="text-[11px] text-gray-400">{t.assignedTo || 'Unassigned'}{t.dueDate ? ` · Due ${new Date(t.dueDate).toLocaleDateString()}` : ''}</p>
                      </div>
                      <StatusBadge label={t.priority} colorClass={t.priority === 'High' ? 'bg-red-50 text-red-600' : t.priority === 'Low' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {aiDraftContent && (
          <div className="px-5 pt-3 flex-shrink-0">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles size={12} className="text-purple-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-purple-800 truncate">AI Draft — to {draftRecipient?.fullName}</span>
                </div>
                <button onClick={() => setAiDraftContent(null)} className="text-purple-400 hover:text-purple-600 flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
              {companyContacts.length > 1 && (
                <select
                  value={draftRecipient?.id ?? ''}
                  onChange={e => setAiDraftRecipientId(e.target.value)}
                  className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 mb-2 bg-white focus:outline-none"
                >
                  {companyContacts.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              )}
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

        {/* Log Activity form or footer */}
        {loggingActivity ? (
          <LogActivityForm
            onSave={handleSaveActivity}
            onCancel={() => setLoggingActivity(false)}
          />
        ) : (
          <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <button
              onClick={() => setLoggingActivity(true)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#015035' }}
            >
              <Plus size={14} /> Log Activity
            </button>
            <button
              onClick={handleGenerateAiDraft}
              disabled={aiGenerating}
              title="AI Draft"
              className="px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50"
            >
              {aiGenerating ? <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" /> : <Wand2 size={16} />}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
    {addingContact && (
      <NewContactPanel
        onSave={handleAddContact}
        onClose={() => setAddingContact(false)}
      />
    )}
    {creatingProposal && (
      <NewProposalPanel
        onSave={async (data: NewProposalFormData) => {
          setCreatingProposal(false)
          try {
            const res = await fetch('/api/proposals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dealId: '',
                company: data.company,
                companyId: company.id,
                serviceType: data.serviceType,
                assignedRep: data.assignedRep,
                value: Number(data.value) || 0,
                items: [{
                  id: `item-${Date.now()}`,
                  description: data.notes || data.serviceType,
                  type: 'one-time',
                  quantity: 1,
                  unitPrice: Number(data.value) || 0,
                  total: Number(data.value) || 0,
                }],
              }),
            })
            if (res.ok) {
              toast('Proposal created', 'success')
            } else {
              const err = await res.json().catch(() => ({}))
              toast(err.error || 'Failed to create proposal', 'error')
            }
          } catch {
            toast('Network error — could not create proposal', 'error')
          }
        }}
        onClose={() => setCreatingProposal(false)}
      />
    )}
    </>
  )
}

// ─── Edit Company Panel ───────────────────────────────────────────────────────

function EditCompanyPanel({
  company,
  onSave,
  onClose,
}: {
  company: CRMCompany
  onSave: (updated: CRMCompany) => void
  onClose: () => void
}) {
  const REPS = useTeamMembers()
  const [form, setForm] = useState({
    name: company.name,
    industry: company.industry,
    hq: company.hq,
    size: company.size,
    phone: company.phone ?? '',
    website: company.website ?? '',
    annualRevenue: company.annualRevenue ? String(company.annualRevenue) : '',
    owner: company.owner,
    description: company.description ?? '',
    status: company.status as CompanyStatus,
  })

  const { enriching, enrichedFields, enrich, markEnriched, clearEnriched } = useEnrichment()

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleWebsiteBlur() {
    if (!form.website.trim() || enriching) return
    const data = await enrich(form.website)
    if (!data) return
    const filled: string[] = []
    setForm(prev => {
      const next = { ...prev }
      if (data.name && !prev.name) { next.name = data.name; filled.push('name') }
      if (data.industry && !prev.industry) { next.industry = data.industry; filled.push('industry') }
      if (data.description && !prev.description) { next.description = data.description; filled.push('description') }
      if (data.phone && !prev.phone) { next.phone = data.phone; filled.push('phone') }
      if (data.address && !prev.hq) { next.hq = data.address; filled.push('hq') }
      return next
    })
    if (filled.length > 0) markEnriched(filled)
  }

  function ec(field: string) {
    return enrichedFields.has(field) ? 'ring-2 ring-blue-300 bg-blue-50/30' : ''
  }

  function handleSave() {
    onSave({
      ...company,
      name: form.name.trim(),
      industry: form.industry.trim(),
      hq: form.hq.trim(),
      size: form.size,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      annualRevenue: form.annualRevenue ? Number(form.annualRevenue) : undefined,
      owner: form.owner,
      description: form.description.trim() || undefined,
      status: form.status,
    })
  }

  const canSave = form.name.trim() && form.industry.trim()

  return (
    <div className="fixed inset-0 z-[60] flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">Edit Company</h2>
            <p className="text-white/50 text-xs mt-0.5">{company.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Company Name
              {enrichedFields.has('name') && (
                <button type="button" onClick={() => { clearEnriched('name'); set('name', '') }}
                  className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                  auto-filled &times;
                </button>
              )}
            </label>
            <input value={form.name} onChange={e => { set('name', e.target.value); clearEnriched('name') }}
              className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('name')}`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Industry
                {enrichedFields.has('industry') && (
                  <button type="button" onClick={() => { clearEnriched('industry'); set('industry', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <select value={form.industry} onChange={e => { set('industry', e.target.value); clearEnriched('industry') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white ${ec('industry')}`}>
                <option value="">Select industry...</option>
                {(!INDUSTRIES.includes(form.industry) && form.industry) && <option value={form.industry}>{form.industry}</option>}
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                {companyStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                HQ / Location
                {enrichedFields.has('hq') && (
                  <button type="button" onClick={() => { clearEnriched('hq'); set('hq', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <input value={form.hq} onChange={e => { set('hq', e.target.value); clearEnriched('hq') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('hq')}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Employees</label>
              <select value={form.size} onChange={e => set('size', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="">Select range</option>
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="201-500">201-500</option>
                <option value="501-1000">501-1,000</option>
                <option value="1001-5000">1,001-5,000</option>
                <option value="5001-10000">5,001-10,000</option>
                <option value="10001+">10,001+</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Phone
                {enrichedFields.has('phone') && (
                  <button type="button" onClick={() => { clearEnriched('phone'); set('phone', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <input type="tel" value={form.phone} onChange={e => { set('phone', e.target.value); clearEnriched('phone') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('phone')}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Annual Revenue</label>
              <input type="number" value={form.annualRevenue} onChange={e => set('annualRevenue', e.target.value)} min="0"
                placeholder="0"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Website</label>
            <div className="relative">
              <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="gravissmarketing.com"
                onBlur={handleWebsiteBlur}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {enriching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-blue-600">
                  <Loader2 size={12} className="animate-spin" /> Fetching info...
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner / Account Rep</label>
            <select value={form.owner} onChange={e => set('owner', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {!REPS.includes(form.owner) && form.owner && <option value={form.owner}>{form.owner}</option>}
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
              {enrichedFields.has('description') && (
                <button type="button" onClick={() => { clearEnriched('description'); set('description', '') }}
                  className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                  auto-filled &times;
                </button>
              )}
            </label>
            <textarea value={form.description} onChange={e => { set('description', e.target.value); clearEnriched('description') }} rows={4}
              placeholder="About this company..."
              className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${ec('description')}`} />
          </div>
        </div>

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null)
  const [integrationsCompany, setIntegrationsCompany] = useState<CRMCompany | null>(null)
  const [editingCompany, setEditingCompany] = useState<CRMCompany | null>(null)
  const [localCompanies, setLocalCompanies] = useState<CRMCompany[]>([])
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gravhub-companies-pageSize')
      return saved ? Number(saved) : 25
    }
    return 25
  })

  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>([])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    localStorage.setItem('gravhub-companies-pageSize', String(size))
  }, [])

  useEffect(() => {
    fetchCrmCompanies()
      .then(data => setLocalCompanies(data))
      .catch(() => toast('Failed to load companies', 'error'))
      .finally(() => setLoading(false))
    fetchCrmContacts().then(setCrmContacts)
    fetchDeals().then(setDeals)
    fetchContracts().then(setContracts)
    fetchInvoices().then(setInvoices)
    fetchProjects().then(setProjects)
    fetchCrmActivities().then(setCrmActivities)
  }, [])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && localCompanies.length > 0 && !selectedCompany) {
      const match = localCompanies.find(c => c.id === openId)
      if (match) setSelectedCompany(match)
    }
  }, [searchParams, localCompanies, selectedCompany])

  async function handleEditCompany(updated: CRMCompany) {
    setLocalCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditingCompany(null)
    if (selectedCompany?.id === updated.id) setSelectedCompany(updated)
    try {
      const res = await fetch(`/api/crm/companies/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save' }))
        toast(err.error || 'Failed to save company changes', 'error')
        fetchCrmCompanies().then(data => setLocalCompanies(data))
        return
      }
      const saved = await res.json()
      setLocalCompanies(prev => prev.map(c => c.id === saved.id ? saved : c))
      if (selectedCompany?.id === saved.id) setSelectedCompany(saved)
    } catch {
      toast('Failed to save company changes', 'error')
      fetchCrmCompanies().then(data => setLocalCompanies(data))
    }
  }

  async function handleNewCompany(data: NewCompanyFormData) {
    const payload: Omit<CRMCompany, 'id'> = {
      name: data.name,
      industry: data.industry,
      website: data.website || undefined,
      phone: data.phone || undefined,
      hq: data.hq,
      size: data.size,
      annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
      status: data.status,
      owner: data.owner,
      description: data.description || undefined,
      tags: [],
      contactIds: [],
      dealIds: [],
      createdDate: new Date().toISOString().split('T')[0],
      totalDealValue: data.proposal ? data.proposal.grandTotal : 0,
    }
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saved = await res.json()
      setLocalCompanies(prev => [saved, ...prev])
    } catch {
      setLocalCompanies(prev => [{ ...payload, id: `co-${Date.now()}` } as CRMCompany, ...prev])
    }
    setCreatingCompany(false)
  }

  async function handleDeleteCompany(id: string) {
    if (!confirm('Delete this company? This action cannot be undone.')) return
    const removed = localCompanies.find(c => c.id === id)
    setLocalCompanies(prev => prev.filter(c => c.id !== id))
    if (selectedCompany?.id === id) setSelectedCompany(null)
    try {
      const res = await fetch(`/api/crm/companies/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Most commonly a 409 — company still has related records (AUDIT
        // #96 blocks rather than cascade-deletes them). Revert the
        // optimistic removal so the UI doesn't show it as gone when it isn't.
        const body = await res.json().catch(() => ({}))
        if (removed) setLocalCompanies(prev => [removed, ...prev])
        toast(body.error || 'Failed to delete company', 'error')
      }
    } catch {
      if (removed) setLocalCompanies(prev => [removed, ...prev])
      toast('Failed to delete company', 'error')
    }
  }

  const filtered = localCompanies.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.hq.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    return matchSearch && matchStatus
  })

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
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      const res = await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'companies', ids }),
      })
      if (!res.ok) {
        toast('Failed to delete companies', 'error')
        return
      }
      const body = await res.json() as { deleted: number; skipped: { id: string; name: string; reason: string }[] }
      // AUDIT #96: blocks per-company rather than cascade-destroying real
      // business records — only actually-deleted companies (never the
      // skipped ones) get removed from the visible list, since they
      // weren't removed server-side either.
      const skippedIds = new Set(body.skipped.map(s => s.id))
      setLocalCompanies(prev => prev.filter(c => !selectedIds.has(c.id) || skippedIds.has(c.id)))
      if (body.skipped.length > 0) {
        const detail = body.skipped.map(s => `${s.name} (${s.reason})`).join('; ')
        toast(`${body.deleted} deleted, ${body.skipped.length} skipped — ${detail}`, body.deleted > 0 ? 'success' : 'error')
      } else {
        toast(`${body.deleted} companies deleted`, 'success')
      }
    } catch {
      toast('Failed to delete companies', 'error')
    }
  }

  useEffect(() => { queueMicrotask(() => setCurrentPage(1)) }, [search, statusFilter])

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'name': return dir * a.name.localeCompare(b.name)
      case 'industry': return dir * a.industry.localeCompare(b.industry)
      case 'status': return dir * a.status.localeCompare(b.status)
      case 'contacts': {
        const ac = crmContacts.filter(c => c.companyId === a.id).length
        const bc = crmContacts.filter(c => c.companyId === b.id).length
        return dir * (ac - bc)
      }
      case 'pipeline': {
        const av = deals.filter(d => d.company === a.name && !d.stage.startsWith('Closed')).reduce((s, d) => s + d.value, 0)
        const bv = deals.filter(d => d.company === b.name && !d.stage.startsWith('Closed')).reduce((s, d) => s + d.value, 0)
        return dir * (av - bv)
      }
      case 'contract': {
        const av = contracts.find(c => c.company === a.name)?.value ?? 0
        const bv = contracts.find(c => c.company === b.name)?.value ?? 0
        return dir * (av - bv)
      }
      case 'owner': return dir * a.owner.localeCompare(b.owner)
      default: return 0
    }
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedCompanies = sorted.slice(startIndex, startIndex + pageSize)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Company', onClick: () => setCreatingCompany(true) }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col bg-[#f8faf9]">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
            <Search size={13} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies, industry, location..."
              className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['All', ...companyStatuses] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex-shrink-0 ${
                  statusFilter === s ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
                style={statusFilter === s ? { background: '#015035' } : {}}
              >
                {s}
              </button>
            ))}
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
          <span className="ml-auto text-sm text-gray-400">{filtered.length} companies</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {paginatedCompanies.map(company => (
              <div key={company.id} onClick={() => setSelectedCompany(company)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {company.name[0]}
                    </div>
                    <span className="font-semibold text-sm text-gray-900">{company.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                    {company.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Industry: <span className="text-gray-700">{company.industry}</span></div>
                  <div>Owner: <span className="text-gray-700">{company.owner}</span></div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No companies match your search.</p>
              </div>
            )}
          </div>
          {/* Desktop table view */}
          <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[600px]">
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
                {[
                  { key: 'name', label: 'Company', hide: '' },
                  { key: 'industry', label: 'Industry', hide: 'hidden sm:table-cell' },
                  { key: 'status', label: 'Status', hide: '' },
                  { key: 'contacts', label: 'Contacts', hide: 'hidden md:table-cell' },
                  { key: 'pipeline', label: 'Pipeline', hide: 'hidden lg:table-cell' },
                  { key: 'contract', label: 'Contract', hide: 'hidden lg:table-cell' },
                  { key: 'owner', label: 'Owner', hide: 'hidden xl:table-cell' },
                ].map(col => (
                  <th key={col.key} className={`text-left py-2.5 px-4 font-semibold ${col.hide}`}>
                    <button onClick={() => handleSort(col.key)} className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                      {col.label}
                      {sortKey === col.key ? (
                        <span className="text-[#015035]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      ) : (
                        <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="text-left py-2.5 px-4 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.map(company => {
                const companyContacts = crmContacts.filter(c => c.companyId === company.id)
                const companyDeals = deals.filter(d => d.company === company.name && !d.stage.startsWith('Closed'))
                const companyContract = contracts.find(c => c.company === company.name)
                return (
                  <tr
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(company.id) ? 'bg-emerald-50/50' : ''}`}
                  >
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={() => toggleSelect(company.id)}
                        className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                          {company.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                          <p className="text-xs text-gray-400 hidden sm:block">{company.hq}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-sm text-gray-600">{company.industry}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        {companyContacts.slice(0, 3).map(c => (
                          <div
                            key={c.id}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 -ml-1 first:ml-0 border border-white"
                            title={c.fullName}
                          >
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                        ))}
                        {companyContacts.length > 3 && (
                          <span className="text-xs text-gray-400 ml-1">+{companyContacts.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {companyDeals.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#015035' }}>
                            {formatCurrency(companyDeals.reduce((s, d) => s + d.value, 0))}
                          </p>
                          <p className="text-[11px] text-gray-400">{companyDeals.length} open deal{companyDeals.length > 1 ? 's' : ''}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {companyContract ? (
                        <div>
                          <StatusBadge label={companyContract.status} colorClass={contractStatusColors[companyContract.status]} />
                          <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(companyContract.value)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-600">{company.owner.split(' ')[0]}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCompany(company.id) }}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete company"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No companies match your search.</p>
            </div>
          )}
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-gray-100">
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={sorted.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      {selectedCompany && (
        <CompanyPanel
          key={selectedCompany.id}
          company={localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany}
          crmContacts={crmContacts}
          deals={deals}
          contracts={contracts}
          invoices={invoices}
          projects={projects}
          crmActivities={crmActivities}
          onClose={() => setSelectedCompany(null)}
          onEdit={() => setEditingCompany(localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany)}
          onDelete={() => handleDeleteCompany(selectedCompany.id)}
          onOpenIntegrations={() => setIntegrationsCompany(selectedCompany)}
        />
      )}
      {integrationsCompany && (
        <ClientIntegrationsPanel
          companyName={integrationsCompany.name}
          companyId={integrationsCompany.id}
          onClose={() => setIntegrationsCompany(null)}
        />
      )}
      {editingCompany && (
        <EditCompanyPanel
          company={editingCompany}
          onSave={handleEditCompany}
          onClose={() => setEditingCompany(null)}
        />
      )}
      {creatingCompany && <NewCompanyPanel onSave={handleNewCompany} onClose={() => setCreatingCompany(false)} />}
      {showImport && (
        <HubSpotImportPanel
          defaultType="companies"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            fetchCrmCompanies().then(setLocalCompanies)
          }}
          onShowDuplicates={() => setShowDuplicates(true)}
        />
      )}
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {
              const rows = selectedIds.size === 0 ? localCompanies : localCompanies.filter(c => selectedIds.has(c.id))
              downloadCsv(rows as unknown as Record<string, unknown>[], [
                { key: 'name', label: 'Name' },
                { key: 'industry', label: 'Industry' },
                { key: 'status', label: 'Status' },
                { key: 'hq', label: 'HQ' },
                { key: 'website', label: 'Website' },
                { key: 'owner', label: 'Owner' },
              ], 'companies-export.csv')
            } },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} companies?`}
          description="Companies with existing contacts, deals, contracts, invoices, projects, or proposals will be skipped — reassign or remove those first."
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
      {showDuplicates && (
        <DuplicatesPanel
          type="companies"
          onClose={() => setShowDuplicates(false)}
          onMergeComplete={() => {
            fetchCrmCompanies().then(setLocalCompanies)
          }}
        />
      )}
    </>
  )
}
