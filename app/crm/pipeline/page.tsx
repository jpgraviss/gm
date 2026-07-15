'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchCrmActivities, fetchCrmCompanies, fetchCrmContacts, fetchContracts } from '@/lib/supabase'
import { formatCurrency, serviceTypeColors, contractStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewDealPanel, { type NewDealData } from '@/components/crm/NewDealPanel'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import type { Deal, CRMActivity, CRMCompany, CRMContact, Contract } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { downloadCsv } from '@/lib/csv-export'
import { useTeamMembers } from '@/lib/useTeamMembers'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import HubSpotImportPanel from '@/components/crm/HubSpotImportPanel'
import NewClientModal from '@/components/admin/NewClientModal'
import {
  X, Phone, Mail, Calendar, TrendingUp, DollarSign,
  FileText, ScrollText, User, ChevronRight, ChevronLeft, Plus,
  CheckCircle2, Circle, AlertCircle, Settings, Upload,
  GripVertical, Pencil, Trash2, Check, Download, Search, Link2,
  LayoutGrid, List, ArrowUpDown, UserCog,
} from 'lucide-react'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import SmartListBar from '@/components/crm/SmartListBar'

// ─── Pipeline Config Types ────────────────────────────────────────────────────

interface PipelineStage {
  id: string
  name: string
  color: string
  probability?: number
}

interface PipelineConfig {
  id: string
  name: string
  stages: PipelineStage[]
}

type LocalDeal = Omit<Deal, 'stage'> & { stage: string }

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_STAGE_COLORS: Record<string, string> = {
  Lead: '#9ca3af',
  Qualified: '#3b82f6',
  'Proposal Sent': '#f59e0b',
  'Contract Sent': '#f97316',
  'Closed Won': '#22c55e',
  'Closed Lost': '#ef4444',
}

const STAGE_COLOR_OPTIONS = [
  '#9ca3af', '#3b82f6', '#f59e0b', '#f97316',
  '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

const initialPipelines: PipelineConfig[] = []

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  index,
  stageColor,
  onClick,
  selected,
  onToggleSelect,
}: {
  deal: LocalDeal
  index: number
  stageColor: string
  onClick: () => void
  selected?: boolean
  onToggleSelect?: () => void
}) {
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`deal-card cursor-grab active:cursor-grabbing select-none ${snapshot.isDragging ? 'shadow-xl rotate-1 opacity-90' : ''} ${selected ? 'ring-2 ring-[#015035] bg-emerald-50/30' : ''}`}
          onClick={onClick}
        >
          <div className="flex items-start gap-2 mb-2 min-w-0">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={!!selected}
                onChange={e => { e.stopPropagation(); onToggleSelect() }}
                onClick={e => e.stopPropagation()}
                className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer mt-0.5 flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate" title={deal.company}>{deal.company}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate" title={deal.contact?.name}>{deal.contact?.name || 'No contact linked'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {(deal.serviceTypes && deal.serviceTypes.length > 0 ? deal.serviceTypes : [deal.serviceType]).map(st => (
              <StatusBadge key={st} label={st} colorClass={serviceTypeColors[st] ?? 'bg-gray-100 text-gray-600'} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
              {formatCurrency(deal.value)}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: stageColor }} />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">{deal.probability}%</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar size={11} />
              <span className="text-[11px]">
                {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600">
                {deal.assignedRep.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-[11px] text-gray-400">{deal.assignedRep.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}

// ─── Deal List View ───────────────────────────────────────────────────────────

function DealListView({
  deals,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  pipelineStages,
  selectedIds,
  onToggleSelect,
}: {
  deals: LocalDeal[]
  sortKey: 'company' | 'value' | 'closeDate' | 'dealScore'
  sortDir: 'asc' | 'desc'
  onSort: (key: 'company' | 'value' | 'closeDate' | 'dealScore') => void
  onSelect: (deal: LocalDeal) => void
  pipelineStages: PipelineStage[]
  selectedIds: Set<string>
  onToggleSelect: (dealId: string) => void
}) {
  const sorted = [...deals].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'company') cmp = a.company.localeCompare(b.company)
    else if (sortKey === 'value') cmp = a.value - b.value
    else if (sortKey === 'closeDate') cmp = (a.closeDate || '').localeCompare(b.closeDate || '')
    else if (sortKey === 'dealScore') cmp = (a.dealScore ?? -1) - (b.dealScore ?? -1)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const columns: { key: 'company' | 'value' | 'closeDate' | 'dealScore'; label: string }[] = [
    { key: 'company', label: 'Company' },
    { key: 'value', label: 'Value' },
    { key: 'closeDate', label: 'Close Date' },
    { key: 'dealScore', label: 'Score' },
  ]

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white rounded-xl border border-gray-100 shadow-sm">
      <table className="data-table w-full min-w-[760px]">
        <thead>
          <tr>
            <th className="w-8"></th>
            {columns.map(col => (
              <th key={col.key} className="cursor-pointer select-none" onClick={() => onSort(col.key)}>
                <span className="flex items-center gap-1">
                  {col.label}
                  <ArrowUpDown size={11} className={sortKey === col.key ? 'text-gray-600' : 'text-gray-300'} />
                </span>
              </th>
            ))}
            <th>Stage</th>
            <th>Contact</th>
            <th>Rep</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(deal => {
            const stageColor = pipelineStages.find(s => s.name === deal.stage)?.color
              ?? DEFAULT_STAGE_COLORS[deal.stage] ?? '#9ca3af'
            return (
              <tr key={deal.id} className="cursor-pointer" onClick={() => onSelect(deal)}>
                <td onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(deal.id)}
                    onChange={() => onToggleSelect(deal.id)}
                    className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                  />
                </td>
                <td>
                  <p className="text-sm font-semibold text-gray-900">{deal.company}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {(deal.serviceTypes && deal.serviceTypes.length > 0 ? deal.serviceTypes : [deal.serviceType]).map(st => (
                      <StatusBadge key={st} label={st} colorClass={serviceTypeColors[st] ?? 'bg-gray-100 text-gray-600'} />
                    ))}
                  </div>
                </td>
                <td className="text-sm font-semibold" style={{ color: '#015035' }}>{formatCurrency(deal.value)}</td>
                <td className="text-sm text-gray-600">
                  {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td>
                  {typeof deal.dealScore === 'number' ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      deal.dealScore >= 60 ? 'bg-emerald-50 text-emerald-700' : deal.dealScore >= 35 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>{deal.dealScore}</span>
                  ) : '—'}
                </td>
                <td>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: stageColor }}>{deal.stage}</span>
                </td>
                <td className="text-sm text-gray-600 truncate max-w-[160px]">{deal.contact?.name || '—'}</td>
                <td className="text-sm text-gray-600">{deal.assignedRep}</td>
              </tr>
            )
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-10 text-sm text-gray-400">No deals match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Deal Detail Panel ────────────────────────────────────────────────────────

function DealPanel({
  deal,
  pipelineStages,
  onClose,
  onAdvanceStage,
  onUpdateDeal,
  onDeleteDeal,
  onDeleteCompany,
  crmActivities,
  crmCompanies,
  crmContacts,
  contracts,
}: {
  deal: LocalDeal
  pipelineStages: PipelineStage[]
  onClose: () => void
  onAdvanceStage: (dealId: string, newStage: string) => void
  onUpdateDeal?: (id: string, updates: Partial<LocalDeal>) => void
  onDeleteDeal?: (id: string) => void
  onDeleteCompany?: (companyId: string) => void
  crmActivities: CRMActivity[]
  crmCompanies: CRMCompany[]
  crmContacts: CRMContact[]
  contracts: Contract[]
}) {
  const { toast } = useToast()
  const ALL_REPS = useTeamMembers()
  const [tab, setTab] = useState<'overview' | 'activity' | 'tasks'>('overview')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<'deal' | 'company' | null>(null)
  const [editing, setEditing] = useState(false)
  const [linkingContact, setLinkingContact] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const dealServiceTypes = deal.serviceTypes && deal.serviceTypes.length > 0 ? deal.serviceTypes : [deal.serviceType]
  const [editForm, setEditForm] = useState({
    value: String(deal.value),
    probability: String(deal.probability),
    closeDate: deal.closeDate,
    stage: deal.stage,
    serviceTypes: dealServiceTypes as string[],
  })
  const dealAny = deal as LocalDeal & { companyId?: string; contactId?: string }
  const company = dealAny.companyId
    ? crmCompanies.find(c => c.id === dealAny.companyId)
    : crmCompanies.find(c => c.name === deal.company)
  const [localActivities, setLocalActivities] = useState(
    () => (crmActivities ?? []).filter(a => a.companyId === company?.id).slice(0, 8)
  )

  const linkedContacts = company
    ? crmContacts.filter(c => c.companyId === company.id)
    : crmContacts.filter(c => c.companyName === deal.company)
  const linkedContract = contracts.find(c => c.company === deal.company)
  const contactTasks = linkedContacts.flatMap(c => c.contactTasks ?? [])

  const currentStageIdx = pipelineStages.findIndex(s => s.name === deal.stage)
  const nextStage = currentStageIdx >= 0 && currentStageIdx < pipelineStages.length - 1
    ? pipelineStages[currentStageIdx + 1]
    : null

  const stageColor = pipelineStages.find(s => s.name === deal.stage)?.color
    ?? DEFAULT_STAGE_COLORS[deal.stage]
    ?? '#9ca3af'

  function handleSaveDealEdit() {
    if (!onUpdateDeal) return
    const selectedTypes = editForm.serviceTypes.length > 0 ? editForm.serviceTypes : ['General']
    const updates: Partial<LocalDeal> = {
      value: parseFloat(editForm.value) || 0,
      probability: parseInt(editForm.probability) || 0,
      closeDate: editForm.closeDate,
      stage: editForm.stage,
      serviceType: selectedTypes[0] as LocalDeal['serviceType'],
      serviceTypes: selectedTypes as LocalDeal['serviceTypes'],
    }
    onUpdateDeal(deal.id, updates)
    setEditing(false)
  }

  function handleLinkContact(contact: CRMContact) {
    if (!onUpdateDeal) return
    onUpdateDeal(deal.id, {
      contactId: contact.id,
      contact: {
        id: contact.id,
        name: contact.fullName || `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
        email: contact.emails?.[0] ?? '',
        phone: contact.phones?.[0] ?? '',
        title: contact.title ?? '',
      },
    } as Partial<LocalDeal>)
    setLinkingContact(false)
    setContactSearch('')
    toast(`Linked to ${contact.fullName || contact.firstName}`, 'success')
  }

  const contactSearchResults = contactSearch.trim().length > 0
    ? crmContacts
        .filter(c => (c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`).toLowerCase().includes(contactSearch.trim().toLowerCase()))
        .slice(0, 8)
    : linkedContacts.slice(0, 8)

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
      companyId: company?.id,
      companyName: deal.company,
      dealId: deal.id,
    }
    setLocalActivities(prev => [entry, ...prev])
    setLoggingActivity(false)
    setTab('activity')
    // Previously never checked res.ok — a failed persist (validation
    // error, transient failure) looked identical to success and silently
    // never made it to the server, vanishing on next reload. Matches
    // handleUpdateActivity's revert-and-toast pattern right below.
    try {
      const res = await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (!res.ok) throw new Error()
    } catch {
      setLocalActivities(prev => prev.filter(a => a.id !== entry.id))
      toast('Failed to save activity', 'error')
    }
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

  return (
  <>
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(540px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: stageColor }}>
                  {deal.stage}
                </span>
                {(deal.serviceTypes && deal.serviceTypes.length > 0 ? deal.serviceTypes : [deal.serviceType]).map(st => (
                  <StatusBadge key={st} label={st} colorClass={serviceTypeColors[st] ?? 'bg-gray-100 text-gray-600'} />
                ))}
              </div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                {deal.company}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {deal.contact?.name ? `${deal.contact.title ? `${deal.contact.title} — ` : ''}${deal.contact.name}` : 'No contact linked'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {onUpdateDeal && (
                <button
                  onClick={() => { setEditing(e => !e); setEditForm({ value: String(deal.value), probability: String(deal.probability), closeDate: deal.closeDate, stage: deal.stage, serviceTypes: (deal.serviceTypes && deal.serviceTypes.length > 0 ? deal.serviceTypes : [deal.serviceType]) as string[] }) }}
                  className="p-2 rounded-lg hover:bg-gray-50"
                  title="Edit deal"
                >
                  <Pencil size={15} className="text-gray-400" />
                </button>
              )}
              {onDeleteDeal && (
                <button
                  onClick={() => setConfirmDelete('deal')}
                  className="p-2 rounded-lg hover:bg-red-50"
                  title="Delete deal"
                >
                  <Trash2 size={15} className="text-red-400" />
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Deal Value</p>
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                {formatCurrency(deal.value)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Probability</p>
              <p className="text-base font-bold text-gray-900">{deal.probability}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Close Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'activity', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Deal Score */}
              {typeof deal.dealScore === 'number' && (
                <div className="p-4 rounded-xl text-white" style={{ background: '#012b1e' }}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-full border-4" style={{ borderColor: deal.dealScore >= 60 ? '#22c55e' : deal.dealScore >= 35 ? '#f59e0b' : '#ef4444' }}>
                      <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{deal.dealScore}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 uppercase tracking-wide font-semibold mb-1.5">Deal Score · Key Factors</p>
                      <div className="flex flex-col gap-1">
                        {(deal.dealScoreFactors ?? []).map((f, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className={f.positive ? 'text-emerald-400' : 'text-red-400'}>{f.positive ? '▲' : '▼'}</span>
                            <span className="text-white/80">{f.label}: {f.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deal info */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal Info</p>
                  {editing && (
                    <div className="flex gap-1.5">
                      <button onClick={handleSaveDealEdit} className="text-xs font-semibold text-white px-2.5 py-1 rounded-lg" style={{ background: '#015035' }}>Save</button>
                      <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100">Cancel</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<DollarSign size={14} />} label="Value" value={
                    editing ? (
                      <input type="number" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    ) : (
                      <span className="font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(deal.value)}</span>
                    )
                  } />
                  <InfoRow icon={<TrendingUp size={14} />} label="Probability" value={
                    editing ? (
                      <input type="number" min={0} max={100} value={editForm.probability} onChange={e => setEditForm(f => ({ ...f, probability: e.target.value }))}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-20 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: '#015035' }} />
                        </div>
                        <span className="text-sm font-semibold">{deal.probability}%</span>
                      </div>
                    )
                  } />
                  <InfoRow icon={<Calendar size={14} />} label="Close Date" value={
                    editing ? (
                      <input type="date" value={editForm.closeDate} onChange={e => setEditForm(f => ({ ...f, closeDate: e.target.value }))}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    ) : new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  } />
                  <InfoRow icon={<User size={14} />} label="Assigned Rep" value={
                    onUpdateDeal ? (
                      <select
                        value={deal.assignedRep}
                        onChange={e => onUpdateDeal(deal.id, { assignedRep: e.target.value })}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        {ALL_REPS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : deal.assignedRep
                  } />
                  <InfoRow icon={<Calendar size={14} />} label="Last Activity" value={deal.lastActivity} />
                </div>
              </div>

              {/* Advance Stage */}
              {nextStage && (
                <button
                  onClick={() => { onAdvanceStage(deal.id, nextStage.name); onClose() }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: nextStage.color }}
                >
                  <span>Advance to {nextStage.name}</span>
                  <ChevronRight size={16} />
                </button>
              )}

              {/* Notes */}
              {deal.notes.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <ul className="flex flex-col gap-1.5">
                    {deal.notes.map((note: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-gray-400">·</span>{note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Contact</p>
                  {company && (
                    <Link href="/crm/contacts" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      All contacts <ChevronRight size={11} />
                    </Link>
                  )}
                </div>

                {!dealAny.contactId ? (
                  <div className="p-3 bg-white rounded-lg border border-dashed border-amber-300">
                    {!linkingContact ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {deal.contact?.name || 'No contact linked'}
                          </p>
                          <p className="text-xs text-amber-600">Not connected to a CRM contact record</p>
                        </div>
                        {onUpdateDeal && (
                          <button
                            onClick={() => setLinkingContact(true)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90"
                            style={{ background: '#015035' }}
                          >
                            <Link2 size={12} /> Connect
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            autoFocus
                            value={contactSearch}
                            onChange={e => setContactSearch(e.target.value)}
                            placeholder="Search contacts by name…"
                            className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                          {contactSearchResults.length === 0 ? (
                            <p className="text-xs text-gray-400 px-1 py-2">
                              {contactSearch.trim() ? 'No matching contacts' : 'No contacts at this company yet — try searching by name'}
                            </p>
                          ) : (
                            contactSearchResults.map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleLinkContact(c)}
                                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{c.fullName}</p>
                                  <p className="text-xs text-gray-400 truncate">{c.title || c.companyName}</p>
                                </div>
                                <Check size={13} className="text-gray-300 flex-shrink-0" />
                              </button>
                            ))
                          )}
                        </div>
                        <button
                          onClick={() => { setLinkingContact(false); setContactSearch('') }}
                          className="self-start text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                        {deal.contact?.name?.split(' ').map((n: string) => n[0]).join('') ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{deal.contact?.name || 'No contact linked'}</p>
                        <p className="text-xs text-gray-400">{deal.contact?.title}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a href={`mailto:${deal.contact?.email}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Mail size={13} />
                        </a>
                        <a href={`tel:${deal.contact?.phone}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Phone size={13} />
                        </a>
                      </div>
                    </div>
                    {linkedContacts.length > 1 && (
                      <p className="text-xs text-gray-400 mt-2">+{linkedContacts.length - 1} more contacts at this company</p>
                    )}
                  </>
                )}
              </div>

              {/* Company */}
              {company && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</p>
                    <div className="flex items-center gap-2">
                      {onDeleteCompany && (
                        <button
                          onClick={() => setConfirmDelete('company')}
                          className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                      <Link href="/crm/companies" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        View <ChevronRight size={11} />
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {company.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                      <p className="text-xs text-gray-400">{company.industry} · {company.hq}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contract */}
              {linkedContract && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Contract</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge label={linkedContract.status} colorClass={contractStatusColors[linkedContract.status]} />
                      </div>
                      <p className="text-xs text-gray-500">{linkedContract.billingStructure}</p>
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(linkedContract.value)}
                    </p>
                  </div>
                  <div className="flex gap-3 mt-3">
                    <Link href="/contracts" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                      <ScrollText size={12} /> View Contracts
                    </Link>
                    <Link href="/proposals" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                      <FileText size={12} /> View Proposals
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'activity' && (
            <ActivityTimeline activities={localActivities} onUpdate={handleUpdateActivity} />
          )}

          {tab === 'tasks' && (
            <div className="flex flex-col gap-2">
              {contactTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No contact tasks for this deal.</p>
                  <p className="text-xs text-gray-400 mt-1">Add tasks from the Contacts panel.</p>
                </div>
              ) : (
                contactTasks.map(task => {
                  const isOverdue = !task.completed && new Date(task.dueDate) < new Date()
                  return (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border ${task.completed ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-200'}`}>
                      {task.completed
                        ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <Circle size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            {isOverdue && <AlertCircle size={10} />}
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-[11px] text-gray-400">{task.assignedTo.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <Link href="/crm/contacts" className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2">
                Manage in Contacts <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0">
          {loggingActivity ? (
            <LogActivityForm onSave={handleSaveActivity} onCancel={() => setLoggingActivity(false)} />
          ) : (
            <div className="p-4 border-t border-gray-100 flex gap-2 flex-wrap">
              <button
                onClick={() => { setLoggingActivity(true); setTab('activity') }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 min-w-[120px]"
                style={{ background: '#015035' }}
              >
                <Plus size={14} /> Log Activity
              </button>
              <button
                onClick={() => setCreatingProposal(true)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 min-w-[120px]"
              >
                <FileText size={14} /> New Proposal
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    {creatingProposal && (
      <NewProposalPanel
        onSave={async (data: NewProposalFormData) => {
          setCreatingProposal(false)
          try {
            const res = await fetch('/api/proposals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dealId: deal.id,
                company: data.company,
                companyId: company?.id,
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

    {/* Confirm delete dialog */}
    {confirmDelete && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setConfirmDelete(null)} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 pointer-events-auto p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Trash2 size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                Delete {confirmDelete === 'deal' ? 'Deal' : 'Company'}?
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {confirmDelete === 'deal'
                  ? `Remove the deal for "${deal.company}" permanently.`
                  : `Remove "${deal.company}" permanently. Blocked if it still has contacts, deals, contracts, invoices, projects, or proposals attached.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirmDelete === 'deal' && onDeleteDeal) {
                  onDeleteDeal(deal.id)
                  onClose()
                } else if (confirmDelete === 'company' && onDeleteCompany) {
                  const comp = crmCompanies.find(c => c.name === deal.company)
                  if (comp) onDeleteCompany(comp.id)
                }
                setConfirmDelete(null)
              }}
              className="flex-1 py-2 rounded-xl text-white text-sm font-semibold bg-red-500 hover:bg-red-600"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

// ─── Manage Pipelines Panel ───────────────────────────────────────────────────

function ManagePipelinesPanel({
  pipelines,
  activePipelineId,
  dealCounts,
  stageDealCounts,
  onClose,
  onChange,
}: {
  pipelines: PipelineConfig[]
  activePipelineId: string
  dealCounts: Record<string, number>
  stageDealCounts: Record<string, number>
  onClose: () => void
  onChange: (updated: PipelineConfig[]) => void
}) {
  const [localPipelines, setLocalPipelines] = useState<PipelineConfig[]>(pipelines)
  const [selectedPipelineId, setSelectedPipelineId] = useState(activePipelineId)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newPipelineName, setNewPipelineName] = useState('')
  const [addingPipeline, setAddingPipeline] = useState(false)
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null)
  const [editingPipelineName, setEditingPipelineName] = useState('')

  const pipeline = localPipelines.find(p => p.id === selectedPipelineId) ?? localPipelines[0]

  function updateStage(stageId: string, updates: Partial<PipelineStage>) {
    setLocalPipelines(prev => prev.map(p =>
      p.id === selectedPipelineId
        ? { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, ...updates } : s) }
        : p
    ))
  }

  function removeStage(stageId: string) {
    const stage = pipeline.stages.find(s => s.id === stageId)
    const count = stage ? (stageDealCounts[`${pipeline.id}::${stage.name}`] ?? 0) : 0
    if (count > 0) {
      const ok = window.confirm(`"${stage!.name}" has ${count} deal${count === 1 ? '' : 's'} in it. Deleting the stage won't delete those deals, but they'll no longer be visible in any pipeline view until moved to a valid stage. Delete anyway?`)
      if (!ok) return
    }
    setLocalPipelines(prev => prev.map(p =>
      p.id === selectedPipelineId
        ? { ...p, stages: p.stages.filter(s => s.id !== stageId) }
        : p
    ))
  }

  function addStage() {
    if (!newStageName.trim()) return
    const newStage: PipelineStage = {
      id: `stage-${Date.now()}`,
      name: newStageName.trim(),
      color: STAGE_COLOR_OPTIONS[pipeline.stages.length % STAGE_COLOR_OPTIONS.length],
    }
    setLocalPipelines(prev => prev.map(p =>
      p.id === selectedPipelineId
        ? { ...p, stages: [...p.stages, newStage] }
        : p
    ))
    setNewStageName('')
  }

  function addPipeline() {
    if (!newPipelineName.trim()) return
    const newPipeline: PipelineConfig = {
      id: `pipeline-${Date.now()}`,
      name: newPipelineName.trim(),
      stages: [
        { id: `lead-${Date.now()}`,   name: 'Lead',       color: '#9ca3af' },
        { id: `closed-${Date.now()}`, name: 'Closed Won', color: '#22c55e' },
      ],
    }
    setLocalPipelines(prev => [...prev, newPipeline])
    setSelectedPipelineId(newPipeline.id)
    setNewPipelineName('')
    setAddingPipeline(false)
  }

  function renamePipeline(pipelineId: string, name: string) {
    if (!name.trim()) return
    setLocalPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, name: name.trim() } : p))
  }

  function removePipeline(pipelineId: string) {
    if (localPipelines.length <= 1) return
    const count = dealCounts[pipelineId] ?? 0
    if (count > 0) {
      const name = localPipelines.find(p => p.id === pipelineId)?.name ?? 'this pipeline'
      const ok = window.confirm(`"${name}" has ${count} deal${count === 1 ? '' : 's'} in it. Deleting the pipeline won't delete those deals, but they'll no longer be visible in any pipeline view until reassigned. Delete anyway?`)
      if (!ok) return
    }
    const next = localPipelines.filter(p => p.id !== pipelineId)
    setLocalPipelines(next)
    if (selectedPipelineId === pipelineId) setSelectedPipelineId(next[0].id)
  }

  function reorderStages(result: DropResult) {
    if (!result.destination) return
    const updated = Array.from(pipeline.stages)
    const [moved] = updated.splice(result.source.index, 1)
    updated.splice(result.destination.index, 0, moved)
    setLocalPipelines(prev => prev.map(p =>
      p.id === selectedPipelineId ? { ...p, stages: updated } : p
    ))
  }

  return (
    <div className="fixed inset-0 z-[60] flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-base font-bold text-white">Manage Pipelines</h2>
            <p className="text-white/50 text-xs mt-0.5">Configure stages, order, and pipelines</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">

          {/* Pipeline selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipelines</p>
            <div className="flex flex-col gap-1.5">
              {localPipelines.map(p => (
                editingPipelineId === p.id ? (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-600 bg-emerald-50">
                    <input
                      value={editingPipelineName}
                      onChange={e => setEditingPipelineName(e.target.value)}
                      className="flex-1 text-sm font-medium border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') { renamePipeline(p.id, editingPipelineName); setEditingPipelineId(null) }
                        if (e.key === 'Escape') setEditingPipelineId(null)
                      }}
                    />
                    <button onClick={() => { renamePipeline(p.id, editingPipelineName); setEditingPipelineId(null) }} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg flex-shrink-0">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingPipelineId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                      selectedPipelineId === p.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedPipelineId(p.id)}
                  >
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{p.stages.length} stages</span>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingPipelineId(p.id); setEditingPipelineName(p.name) }}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <Pencil size={12} />
                      </button>
                      {localPipelines.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); removePipeline(p.id) }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              ))}
              {addingPipeline ? (
                <div className="flex gap-2">
                  <input
                    value={newPipelineName}
                    onChange={e => setNewPipelineName(e.target.value)}
                    placeholder="Pipeline name..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') addPipeline()
                      if (e.key === 'Escape') setAddingPipeline(false)
                    }}
                  />
                  <button onClick={addPipeline} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Add</button>
                  <button onClick={() => setAddingPipeline(false)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingPipeline(true)}
                  className="flex items-center gap-2 text-sm text-emerald-700 px-3 py-2 rounded-xl hover:bg-emerald-50"
                >
                  <Plus size={14} /> Add Pipeline
                </button>
              )}
            </div>
          </div>

          {/* Stage list with drag-and-drop reorder */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Stages — {pipeline.name}
            </p>
            <DragDropContext onDragEnd={reorderStages}>
              <Droppable droppableId="stages-config">
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1.5">
                    {pipeline.stages.map((stage, idx) => (
                      <Draggable key={stage.id} draggableId={`cfg-${stage.id}`} index={idx}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border bg-white ${snap.isDragging ? 'shadow-lg border-gray-300' : 'border-gray-200'}`}
                          >
                            <div {...prov.dragHandleProps} className="text-gray-400 hover:text-gray-600 cursor-grab flex-shrink-0">
                              <GripVertical size={16} />
                            </div>
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                            {editingStageId === stage.id ? (
                              <input
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { updateStage(stage.id, { name: editingName }); setEditingStageId(null) }
                                  if (e.key === 'Escape') setEditingStageId(null)
                                }}
                              />
                            ) : (
                              <span className="flex-1 text-sm font-medium text-gray-800">{stage.name}</span>
                            )}
                            {/* Quick color swatches when editing */}
                            {editingStageId === stage.id && (
                              <div className="flex gap-1 flex-shrink-0">
                                {STAGE_COLOR_OPTIONS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => updateStage(stage.id, { color: c })}
                                    className="w-4 h-4 rounded-full border-2"
                                    style={{ background: c, borderColor: stage.color === c ? '#015035' : 'transparent' }}
                                  />
                                ))}
                              </div>
                            )}
                            {editingStageId === stage.id ? (
                              <button
                                onClick={() => { updateStage(stage.id, { name: editingName }); setEditingStageId(null) }}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg flex-shrink-0"
                              >
                                <Check size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => { setEditingStageId(stage.id); setEditingName(stage.name) }}
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {pipeline.stages.length > 1 && (
                              <button
                                onClick={() => removeStage(stage.id)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {/* Add stage input */}
            <div className="flex gap-2 mt-3">
              <input
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                placeholder="New stage name..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={e => { if (e.key === 'Enter') addStage() }}
              />
              <button
                onClick={addStage}
                disabled={!newStageName.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => { onChange(localPipelines); onClose() }}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
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

export default function PipelinePage() {
  const ALL_REPS = useTeamMembers()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [pipelines, setPipelines] = useState<PipelineConfig[]>(initialPipelines)
  const [activePipelineId, setActivePipelineId] = useState('client-acquisition')
  const [localDeals, setLocalDeals] = useState<LocalDeal[]>([])
  const [selectedDeal, setSelectedDeal] = useState<LocalDeal | null>(null)
  const [filterRep, setFilterRep] = useState('All')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [sortKey, setSortKey] = useState<'company' | 'value' | 'closeDate' | 'dealScore'>('closeDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [managingPipeline, setManagingPipeline] = useState(false)
  const [creatingDeal, setCreatingDeal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>([])
  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [showBulkReassign, setShowBulkReassign] = useState(false)
  const [bulkReassignValue, setBulkReassignValue] = useState('')

  useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    fetchAllPages<LocalDeal>('/api/deals')
      .then(data => setLocalDeals(data))
      .catch(() => toast('Failed to load deals', 'error'))
      .finally(() => setLoading(false))
    fetch('/api/pipelines')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setPipelines(data)
          setActivePipelineId(data[0].id)
        }
      })
      .catch(() => toast('Failed to load pipelines', 'error'))
    fetchCrmActivities().then(setCrmActivities)
    fetchCrmCompanies().then(setCrmCompanies)
    fetchCrmContacts().then(setCrmContacts)
    fetchContracts().then(setContracts)
  }, [])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId && localDeals.length > 0 && !selectedDeal) {
      const match = localDeals.find(d => d.id === openId)
      if (match) setSelectedDeal(match)
    }
  }, [searchParams, localDeals, selectedDeal])

  const activePipeline = pipelines.find(p => p.id === activePipelineId) ?? pipelines[0]
  const activeStages = activePipeline?.stages ?? []

  const reps = ['All', ...ALL_REPS]
  const dealCountByPipeline: Record<string, number> = {}
  const dealCountByStage: Record<string, number> = {}
  for (const p of pipelines) {
    dealCountByPipeline[p.id] = localDeals.filter(d => (d as LocalDeal & { pipelineId?: string }).pipelineId === p.id || (!('pipelineId' in d) && p.id === 'client-acquisition')).length
    for (const s of p.stages) {
      const key = `${p.id}::${s.name}`
      dealCountByStage[key] = localDeals.filter(d =>
        d.stage === s.name && ((d as LocalDeal & { pipelineId?: string }).pipelineId === p.id || (!('pipelineId' in d) && p.id === 'client-acquisition'))
      ).length
    }
  }
  const pipelineDeals = localDeals.filter(d => (d as LocalDeal & { pipelineId?: string }).pipelineId === activePipelineId || (!('pipelineId' in d) && activePipelineId === 'client-acquisition'))
  const filteredDeals = filterRep === 'All' ? pipelineDeals : pipelineDeals.filter(d => d.assignedRep === filterRep)

  const openDeals = filteredDeals.filter(d => !d.stage.startsWith('Closed'))
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0)
  const wonValue = filteredDeals.filter(d => d.stage === 'Closed Won').reduce((s, d) => s + d.value, 0)
  const weightedValue = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0)

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || source.droppableId === destination.droppableId) return
    const targetStage = activeStages.find(s => s.id === destination.droppableId)
    if (!targetStage) return
    const updates: { stage: string; probability?: number } = { stage: targetStage.name }
    if (targetStage.probability !== undefined) updates.probability = targetStage.probability
    const previousDeal = localDeals.find(d => d.id === draggableId)
    setLocalDeals(prev => prev.map(d => d.id === draggableId ? { ...d, ...updates } : d))
    setSelectedDeal(prev => prev?.id === draggableId ? { ...prev, ...updates } : prev)
    // Previously only caught network-level failures — fetch doesn't reject
    // on a non-2xx response, so a server-side rejection (e.g. a Team
    // Member's card genuinely being dragged is fine, but any validation
    // error) left the card showing the new stage while the server never
    // actually moved it, silently reverting on next reload with no
    // explanation. Revert immediately instead.
    fetch(`/api/deals/${draggableId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      .then(res => {
        if (!res.ok) throw new Error()
      })
      .catch(() => {
        if (previousDeal) {
          setLocalDeals(prev => prev.map(d => d.id === draggableId ? previousDeal : d))
          setSelectedDeal(prev => prev?.id === draggableId ? previousDeal : prev)
        }
        toast('Failed to update deal stage', 'error')
      })
  }

  async function handleNewDeal(data: NewDealData) {
    const serviceTypes = data.serviceTypes && data.serviceTypes.length > 0
      ? data.serviceTypes
      : [data.serviceType]
    const payload = {
      company: data.company,
      companyId: data.companyId,
      contact: { id: `contact-${Date.now()}`, name: data.contactName, email: data.contactEmail, phone: data.contactPhone, title: data.contactTitle },
      stage: data.stage,
      value: Number(data.value) || 0,
      serviceType: serviceTypes[0],
      serviceTypes,
      closeDate: data.closeDate,
      assignedRep: data.assignedRep,
      probability: Number(data.probability) || 20,
      notes: data.notes ? [data.notes] : [],
      pipelineId: data.pipelineId ?? activePipelineId,
    }
    try {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      // Previously called res.json() unconditionally and pushed the result
      // straight into localDeals even on failure — the server's error body
      // ({error: "..."}) has no id/company/stage, and `openDeals` filters
      // on `!d.stage.startsWith('Closed')` on every render, so this threw
      // "Cannot read properties of undefined" and crashed the whole page.
      // Also never toasted at all, success or failure, unlike every other
      // mutation in this file.
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body.error || 'Failed to create deal', 'error')
      } else {
        const saved = await res.json()
        setLocalDeals(prev => [saved as LocalDeal, ...prev])
        toast('Deal created', 'success')
      }
    } catch {
      setLocalDeals(prev => [{ ...payload, id: `deal-${Date.now()}`, lastActivity: new Date().toISOString().split('T')[0] } as LocalDeal, ...prev])
      toast('Network error — deal was not saved, please retry', 'error')
    }
    setCreatingDeal(false)
  }

  function handleAdvanceStage(dealId: string, newStage: string) {
    const targetStage = activeStages.find(s => s.name === newStage)
    const updates: { stage: string; probability?: number } = { stage: newStage }
    if (targetStage?.probability !== undefined) updates.probability = targetStage.probability
    const previousDeal = localDeals.find(d => d.id === dealId)
    setLocalDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...updates } : d))
    setSelectedDeal(prev => prev?.id === dealId ? { ...prev, ...updates } as LocalDeal : prev)
    fetch(`/api/deals/${dealId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
      .then(res => {
        if (!res.ok) throw new Error()
      })
      .catch(() => {
        if (previousDeal) {
          setLocalDeals(prev => prev.map(d => d.id === dealId ? previousDeal : d))
          setSelectedDeal(prev => prev?.id === dealId ? previousDeal : prev)
        }
        toast('Failed to advance deal stage', 'error')
      })
  }

  function handleUpdateDeal(id: string, updates: Partial<LocalDeal>) {
    const previousDeal = localDeals.find(d => d.id === id)
    setLocalDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    setSelectedDeal(prev => prev?.id === id ? { ...prev, ...updates } as LocalDeal : prev)
    fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
      .then(res => {
        if (!res.ok) throw new Error()
      })
      .catch(() => {
        if (previousDeal) {
          setLocalDeals(prev => prev.map(d => d.id === id ? previousDeal : d))
          setSelectedDeal(prev => prev?.id === id ? previousDeal : prev)
        }
        toast('Failed to update deal', 'error')
      })
  }

  async function handleDeleteDeal(id: string) {
    const removed = localDeals.find(d => d.id === id)
    setLocalDeals(prev => prev.filter(d => d.id !== id))
    setSelectedDeal(null)
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        // DELETE requires Dept Manager (a higher bar than the Team Member
        // role needed to view/drag/edit deals) — a plain Team Member could
        // previously click Delete, watch the card vanish, while the
        // server 403'd and the deal was never actually removed, silently
        // reappearing on the next reload with no explanation.
        const body = await res.json().catch(() => ({}))
        if (removed) setLocalDeals(prev => [removed, ...prev])
        toast(body.error || 'Failed to delete deal', 'error')
      }
    } catch {
      if (removed) setLocalDeals(prev => [removed, ...prev])
      toast('Failed to delete deal', 'error')
    }
  }

  async function handleDeleteCompany(companyId: string) {
    const removed = crmCompanies.find(c => c.id === companyId)
    setCrmCompanies(prev => prev.filter(c => c.id !== companyId))
    try {
      const res = await fetch(`/api/crm/companies/${companyId}`, { method: 'DELETE' })
      if (!res.ok) {
        // Most commonly a 409 — company still has related records (AUDIT
        // #96 blocks rather than cascade-deletes them). Revert the
        // optimistic removal so the UI doesn't show it as gone when it isn't.
        const body = await res.json().catch(() => ({}))
        if (removed) setCrmCompanies(prev => [...prev, removed])
        toast(body.error || 'Failed to delete company', 'error')
      }
    } catch {
      if (removed) setCrmCompanies(prev => [...prev, removed])
      toast('Failed to delete company', 'error')
    }
  }

  const someSelected = selectedIds.size > 0

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDeleteDeals() {
    const ids = Array.from(selectedIds)
    const removed = localDeals.filter(d => selectedIds.has(d.id))
    setLocalDeals(prev => prev.filter(d => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      const res = await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deals', ids }),
      })
      if (!res.ok) throw new Error()
      toast(`${ids.length} deals deleted`, 'success')
    } catch {
      // Previously never checked res.ok — a 403 (bulk-delete requires
      // Dept Manager) always toasted success regardless.
      if (removed.length > 0) setLocalDeals(prev => [...removed, ...prev])
      toast('Failed to delete deals', 'error')
    }
  }

  async function handleBulkReassign() {
    const assignedRep = bulkReassignValue.trim()
    if (!assignedRep) return
    const ids = Array.from(selectedIds)
    setLocalDeals(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, assignedRep } : d))
    setShowBulkReassign(false)
    setBulkReassignValue('')
    setSelectedIds(new Set())
    for (const id of ids) {
      fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedRep }),
      }).catch(() => {})
    }
    toast(`${ids.length} deals reassigned to ${assignedRep}`, 'success')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: 'New Deal', onClick: () => setCreatingDeal(true) }}
      />
      <NewClientModal open={showNewClientModal} onClose={() => setShowNewClientModal(false)} />
      <div className="p-4 md:p-6 flex-1 flex flex-col bg-[#faf9f6] min-h-0 overflow-hidden">
        {/* Pipeline summary + toolbar */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {pipelines.length > 0 && (
                <select
                  value={activePipelineId}
                  onChange={e => setActivePipelineId(e.target.value)}
                  className="text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#015035]/30 bg-white shadow-sm"
                >
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <div className="flex items-center gap-1 overflow-x-auto">
                {reps.map(rep => (
                  <button key={rep} onClick={() => setFilterRep(rep)} className={`tab-btn flex-shrink-0 ${filterRep === rep ? 'active' : ''}`}>
                    {rep}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-white flex-shrink-0">
                <button
                  onClick={() => setViewMode('kanban')}
                  title="Pipeline view"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  style={viewMode === 'kanban' ? { background: '#015035' } : undefined}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List view"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  style={viewMode === 'list' ? { background: '#015035' } : undefined}
                >
                  <List size={14} />
                </button>
              </div>
              <button
                onClick={() => setShowNewClientModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#015035] border border-[#015035]/20 hover:bg-[#015035]/5 transition-colors"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New Client</span>
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex-shrink-0"
              >
                <Upload size={13} /> <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => setManagingPipeline(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex-shrink-0"
              >
                <Settings size={13} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <SmartListBar
              entityType="deals"
              currentCriteria={{ filterRep }}
              onApply={criteria => setFilterRep(criteria.filterRep ?? 'All')}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-[#015035]/10 flex items-center justify-center">
                  <DollarSign size={13} className="text-[#015035]" />
                </div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Open Pipeline</p>
              </div>
              <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(totalPipeline)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{openDeals.length} active deals</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-[#CC7853]/10 flex items-center justify-center">
                  <TrendingUp size={13} className="text-[#CC7853]" />
                </div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Weighted</p>
              </div>
              <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{formatCurrency(Math.round(weightedValue))}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Probability-adjusted</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                </div>
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Won</p>
              </div>
              <p className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'var(--font-heading)' }}>{formatCurrency(wonValue)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{filteredDeals.filter(d => d.stage === 'Closed Won').length} deals closed</p>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {viewMode === 'list' ? (
          <DealListView
            deals={filteredDeals}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={key => {
              if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
              else { setSortKey(key); setSortDir('asc') }
            }}
            onSelect={setSelectedDeal}
            pipelineStages={activeStages}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : mounted ? <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2">
            {activeStages.map(stage => {
              const stageDeals = filteredDeals.filter(d => d.stage === stage.name)
              const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0)
              return (
                <div key={stage.id} className="kanban-col flex-shrink-0 flex flex-col min-h-0 bg-white/50 rounded-xl border border-gray-100 p-2" style={{ width: 360, maxHeight: 'calc(100vh - 280px)' }}>
                  <div className="flex items-center justify-between mb-2 px-1 pb-2 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                      <span className="text-xs font-semibold text-gray-700">{stage.name}</span>
                      <span
                        className="text-xs font-semibold text-white rounded-full px-1.5 py-0.5 min-w-5 text-center"
                        style={{ background: stage.color, fontSize: '10px' }}
                      >
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageTotal > 0 && (
                      <span className="text-[11px] text-gray-400">{formatCurrency(stageTotal)}</span>
                    )}
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-1 transition-colors flex-1 overflow-y-auto ${snapshot.isDraggingOver ? 'bg-emerald-50 ring-2 ring-emerald-200' : ''}`}
                      >
                        {stageDeals.map((deal, index) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            index={index}
                            stageColor={stage.color}
                            onClick={() => setSelectedDeal(deal)}
                            selected={selectedIds.has(deal.id)}
                            onToggleSelect={() => toggleSelect(deal.id)}
                          />
                        ))}
                        {provided.placeholder}
                        {stageDeals.length === 0 && !snapshot.isDraggingOver && (
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                            <p className="text-xs text-gray-400">Drop here</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext> : (
          <div className="flex gap-3 overflow-x-auto flex-1 min-h-0 pb-2">
            {activeStages.map(stage => (
              <div key={stage.id} className="kanban-col flex-shrink-0 flex flex-col min-h-0 bg-white/50 rounded-xl border border-gray-100 p-2" style={{ width: 360, maxHeight: 'calc(100vh - 280px)' }}>
                <div className="flex items-center gap-2 mb-3 px-1 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-semibold text-gray-700">{stage.name}</span>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center min-h-[80px]">
                  <p className="text-xs text-gray-400">Loading...</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDeal && (
        <DealPanel
          deal={localDeals.find(d => d.id === selectedDeal.id) ?? selectedDeal}
          pipelineStages={activeStages}
          onClose={() => setSelectedDeal(null)}
          onAdvanceStage={handleAdvanceStage}
          onUpdateDeal={handleUpdateDeal}
          onDeleteDeal={handleDeleteDeal}
          onDeleteCompany={handleDeleteCompany}
          crmActivities={crmActivities}
          crmCompanies={crmCompanies}
          crmContacts={crmContacts}
          contracts={contracts}
        />
      )}

      {creatingDeal && (
        <NewDealPanel
          onSave={handleNewDeal}
          onClose={() => setCreatingDeal(false)}
          stages={activeStages.map(s => ({ name: s.name, probability: s.probability ?? 0 }))}
          pipelineId={activePipelineId}
        />
      )}

      {showImport && (
        <HubSpotImportPanel
          defaultType="deals"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            fetchAllPages<LocalDeal>('/api/deals').then(data => setLocalDeals(data))
          }}
        />
      )}

      {managingPipeline && (
        <ManagePipelinesPanel
          pipelines={pipelines}
          activePipelineId={activePipeline.id}
          dealCounts={dealCountByPipeline}
          stageDealCounts={dealCountByStage}
          onClose={() => setManagingPipeline(false)}
          onChange={updated => {
            setPipelines(updated)
            if (!updated.some(p => p.id === activePipelineId)) {
              setActivePipelineId(updated[0].id)
            }
            fetch('/api/pipelines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updated),
            })
              .then(r => { if (!r.ok) throw new Error('Failed to save') })
              .catch(() => toast('Failed to save pipeline settings', 'error'))
          }}
        />
      )}
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {
              const rows = selectedIds.size === 0 ? localDeals : localDeals.filter(d => selectedIds.has(d.id))
              downloadCsv(rows.map(d => ({ ...d, contactName: d.contact?.name ?? '' })) as unknown as Record<string, unknown>[], [
                { key: 'company', label: 'Company' },
                { key: 'contactName', label: 'Contact' },
                { key: 'serviceTypes', label: 'Service Types', format: v => Array.isArray(v) ? v.join('; ') : String(v ?? '') },
                { key: 'value', label: 'Value', format: v => v ? `$${Number(v).toLocaleString()}` : '' },
                { key: 'stage', label: 'Stage' },
                { key: 'probability', label: 'Probability', format: v => v != null ? `${v}%` : '' },
                { key: 'closeDate', label: 'Close Date' },
                { key: 'assignedRep', label: 'Assigned Rep' },
              ], 'deals-export.csv')
            } },
            { label: 'Reassign', icon: <UserCog size={13} />, onClick: () => setShowBulkReassign(true) },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} deals?`}
          description="This action cannot be undone. Selected deals will be permanently removed."
          onConfirm={handleBulkDeleteDeals}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
      {showBulkReassign && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBulkReassign(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Reassign {selectedIds.size} deals</p>
              <p className="text-xs text-gray-500 mt-0.5">Set the assigned rep for all selected deals</p>
            </div>
            <select
              value={bulkReassignValue}
              onChange={e => setBulkReassignValue(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            >
              <option value="">Select rep...</option>
              {ALL_REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={handleBulkReassign} disabled={!bulkReassignValue.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>Reassign</button>
              <button onClick={() => setShowBulkReassign(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
