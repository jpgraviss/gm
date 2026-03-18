'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchCrmActivities, fetchCrmCompanies, fetchCrmContacts, fetchContracts } from '@/lib/supabase'
import { formatCurrency, serviceTypeColors, contractStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import CRMSubNav from '@/components/crm/CRMSubNav'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewDealPanel, { type NewDealData } from '@/components/crm/NewDealPanel'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import type { Deal, CRMActivity, CRMCompany, CRMContact, Contract } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { useTeamMembers } from '@/lib/useTeamMembers'
import {
  X, Phone, Mail, Calendar, TrendingUp, DollarSign,
  FileText, ScrollText, User, ChevronRight, ChevronLeft, Plus,
  CheckCircle2, Circle, AlertCircle, Settings,
  GripVertical, Pencil, Trash2, Check,
} from 'lucide-react'

// ─── Pipeline Config Types ────────────────────────────────────────────────────

interface PipelineStage {
  id: string
  name: string
  color: string
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

const initialPipelines: PipelineConfig[] = [
  {
    id: 'sales',
    name: 'Sales Pipeline',
    stages: [
      { id: 'lead',          name: 'Lead',          color: '#9ca3af' },
      { id: 'qualified',     name: 'Qualified',     color: '#3b82f6' },
      { id: 'proposal_sent', name: 'Proposal Sent', color: '#f59e0b' },
      { id: 'contract_sent', name: 'Contract Sent', color: '#f97316' },
      { id: 'closed_won',    name: 'Closed Won',    color: '#22c55e' },
      { id: 'closed_lost',   name: 'Closed Lost',   color: '#ef4444' },
    ],
  },
]

// ─── Deal Card ────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  index,
  stageColor,
  onClick,
}: {
  deal: LocalDeal
  index: number
  stageColor: string
  onClick: () => void
}) {
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`deal-card cursor-grab active:cursor-grabbing select-none ${snapshot.isDragging ? 'shadow-xl rotate-1 opacity-90' : ''}`}
          onClick={onClick}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{deal.company}</p>
              <p className="text-xs text-gray-400 mt-0.5">{deal.contact.name}</p>
            </div>
            <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType] ?? 'bg-gray-100 text-gray-600'} />
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
  const [editForm, setEditForm] = useState({
    value: String(deal.value),
    probability: String(deal.probability),
    closeDate: deal.closeDate,
    stage: deal.stage,
    serviceType: deal.serviceType,
  })
  const [localActivities, setLocalActivities] = useState(
    () => (crmActivities ?? []).filter(a => a.companyId === (crmCompanies ?? []).find(c => c.name === deal.company)?.id).slice(0, 8)
  )

  const company = crmCompanies.find(c => c.name === deal.company)
  const linkedContacts = crmContacts.filter(c => c.companyName === deal.company)
  const linkedContract = contracts.find(c => c.company === deal.company)
  const contactTasks = crmContacts
    .filter(c => c.companyName === deal.company)
    .flatMap(c => c.contactTasks ?? [])

  const currentStageIdx = pipelineStages.findIndex(s => s.name === deal.stage)
  const nextStage = currentStageIdx >= 0 && currentStageIdx < pipelineStages.length - 1
    ? pipelineStages[currentStageIdx + 1]
    : null

  const stageColor = pipelineStages.find(s => s.name === deal.stage)?.color
    ?? DEFAULT_STAGE_COLORS[deal.stage]
    ?? '#9ca3af'

  function handleSaveDealEdit() {
    if (!onUpdateDeal) return
    const updates: Partial<LocalDeal> = {
      value: parseFloat(editForm.value) || 0,
      probability: parseInt(editForm.probability) || 0,
      closeDate: editForm.closeDate,
      stage: editForm.stage,
      serviceType: editForm.serviceType as LocalDeal['serviceType'],
    }
    onUpdateDeal(deal.id, updates)
    fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => toast('Failed to save deal changes', 'error'))
    setEditing(false)
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
      companyId: company?.id,
      companyName: deal.company,
    }, ...prev])
    setLoggingActivity(false)
    setTab('activity')
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
                <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType] ?? 'bg-gray-100 text-gray-600'} />
              </div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                {deal.company}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">{deal.contact.title} — {deal.contact.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {onUpdateDeal && (
                <button
                  onClick={() => { setEditing(e => !e); setEditForm({ value: String(deal.value), probability: String(deal.probability), closeDate: deal.closeDate, stage: deal.stage, serviceType: deal.serviceType }) }}
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
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                    {deal.contact.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{deal.contact.name}</p>
                    <p className="text-xs text-gray-400">{deal.contact.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`mailto:${deal.contact.email}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Mail size={13} />
                    </a>
                    <a href={`tel:${deal.contact.phone}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
                {linkedContacts.length > 1 && (
                  <p className="text-xs text-gray-400 mt-2">+{linkedContacts.length - 1} more contacts at this company</p>
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
            <ActivityTimeline activities={localActivities} />
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
        onSave={(_data: NewProposalFormData) => setCreatingProposal(false)}
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
                  : `Remove "${deal.company}" and all its data permanently.`}
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
  onClose,
  onChange,
}: {
  pipelines: PipelineConfig[]
  activePipelineId: string
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

  const pipeline = localPipelines.find(p => p.id === selectedPipelineId) ?? localPipelines[0]

  function updateStage(stageId: string, updates: Partial<PipelineStage>) {
    setLocalPipelines(prev => prev.map(p =>
      p.id === selectedPipelineId
        ? { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, ...updates } : s) }
        : p
    ))
  }

  function removeStage(stageId: string) {
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
                <button
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    selectedPipelineId === p.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400">{p.stages.length} stages</span>
                </button>
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
  const [mounted, setMounted] = useState(false)
  const [pipelines, setPipelines] = useState<PipelineConfig[]>(initialPipelines)
  const [activePipelineId, setActivePipelineId] = useState('sales')
  const [localDeals, setLocalDeals] = useState<LocalDeal[]>([])
  const [selectedDeal, setSelectedDeal] = useState<LocalDeal | null>(null)
  const [filterRep, setFilterRep] = useState('All')
  const [managingPipeline, setManagingPipeline] = useState(false)
  const [creatingDeal, setCreatingDeal] = useState(false)
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>([])
  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])

  useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    fetch('/api/deals')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLocalDeals(data as LocalDeal[]) })
      .catch(() => toast('Failed to load deals', 'error'))
      .finally(() => setLoading(false))
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.pipelines && Array.isArray(d.pipelines) && d.pipelines.length) {
          setPipelines(d.pipelines)
        }
      })
      .catch(() => toast('Failed to load pipeline settings', 'error'))
    fetchCrmActivities().then(setCrmActivities)
    fetchCrmCompanies().then(setCrmCompanies)
    fetchCrmContacts().then(setCrmContacts)
    fetchContracts().then(setContracts)
  }, [])

  const activePipeline = pipelines.find(p => p.id === activePipelineId) ?? pipelines[0]
  const activeStages = activePipeline.stages

  const reps = ['All', ...ALL_REPS]
  const filteredDeals = filterRep === 'All' ? localDeals : localDeals.filter(d => d.assignedRep === filterRep)

  const openDeals = filteredDeals.filter(d => !d.stage.startsWith('Closed'))
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0)
  const wonValue = filteredDeals.filter(d => d.stage === 'Closed Won').reduce((s, d) => s + d.value, 0)
  const weightedValue = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0)

  function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || source.droppableId === destination.droppableId) return
    const newStageName = activeStages.find(s => s.id === destination.droppableId)?.name
    if (!newStageName) return
    setLocalDeals(prev => prev.map(d => d.id === draggableId ? { ...d, stage: newStageName } : d))
    setSelectedDeal(prev => prev?.id === draggableId ? { ...prev, stage: newStageName } : prev)
    fetch(`/api/deals/${draggableId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStageName }) }).catch(() => toast('Failed to update deal stage', 'error'))
  }

  async function handleNewDeal(data: NewDealData) {
    const payload = {
      company: data.company,
      contact: { id: `contact-${Date.now()}`, name: data.contactName, email: data.contactEmail, phone: data.contactPhone, title: data.contactTitle },
      stage: data.stage,
      value: Number(data.value) || 0,
      serviceType: data.serviceType,
      closeDate: data.closeDate,
      assignedRep: data.assignedRep,
      probability: Number(data.probability) || 20,
      notes: data.notes ? [data.notes] : [],
    }
    try {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const saved = await res.json()
      setLocalDeals(prev => [saved as LocalDeal, ...prev])
    } catch {
      setLocalDeals(prev => [{ ...payload, id: `deal-${Date.now()}`, lastActivity: new Date().toISOString().split('T')[0] } as LocalDeal, ...prev])
    }
    setCreatingDeal(false)
  }

  function handleAdvanceStage(dealId: string, newStage: string) {
    setLocalDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
    fetch(`/api/deals/${dealId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStage }) }).catch(() => toast('Failed to advance deal stage', 'error'))
  }

  function handleUpdateDeal(id: string, updates: Partial<LocalDeal>) {
    setLocalDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    setSelectedDeal(prev => prev?.id === id ? { ...prev, ...updates } as LocalDeal : prev)
  }

  async function handleDeleteDeal(id: string) {
    setLocalDeals(prev => prev.filter(d => d.id !== id))
    setSelectedDeal(null)
    fetch(`/api/deals/${id}`, { method: 'DELETE' }).catch(() => toast('Failed to delete deal', 'error'))
  }

  async function handleDeleteCompany(companyId: string) {
    setCrmCompanies(prev => prev.filter(c => c.id !== companyId))
    fetch(`/api/crm/companies/${companyId}`, { method: 'DELETE' }).catch(() => toast('Failed to delete company', 'error'))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: 'New Deal', onClick: () => setCreatingDeal(true) }}
      />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Pipeline summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Open Pipeline', value: formatCurrency(totalPipeline), sub: `${openDeals.length} deals` },
            { label: 'Weighted Value', value: formatCurrency(Math.round(weightedValue)), sub: 'Probability-adjusted' },
            { label: 'Closed Won', value: formatCurrency(wonValue), sub: `${filteredDeals.filter(d => d.stage === 'Closed Won').length} deals` },
          ].map(m => (
            <div key={m.label} className="metric-card flex items-center gap-3">
              <div>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{m.label}</p>
                <p className="text-[11px] text-gray-400">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0">
            {pipelines.length > 1 && (
              <select
                value={activePipelineId}
                onChange={e => setActivePipelineId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-shrink-0"
              >
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {reps.map(rep => (
              <button key={rep} onClick={() => setFilterRep(rep)} className={`tab-btn flex-shrink-0 ${filterRep === rep ? 'active' : ''}`}>
                {rep}
              </button>
            ))}
          </div>
          <button
            onClick={() => setManagingPipeline(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 flex-shrink-0"
          >
            <Settings size={13} /> Manage Stages
          </button>
          <div className="text-sm text-gray-500 flex-shrink-0">
            <span className="font-semibold text-gray-900">{filteredDeals.length}</span> deals ·{' '}
            <span className="font-semibold" style={{ color: '#015035' }}>
              {formatCurrency(filteredDeals.reduce((s, d) => s + d.value, 0))}
            </span>
          </div>
        </div>

        {/* Kanban Board */}
        {mounted ? <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
            {activeStages.map(stage => {
              const stageDeals = filteredDeals.filter(d => d.stage === stage.name)
              const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0)
              return (
                <div key={stage.id} className="kanban-col flex-shrink-0" style={{ width: 220 }}>
                  <div className="flex items-center justify-between mb-3 px-1">
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
                        className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-emerald-50 ring-2 ring-emerald-200' : ''}`}
                      >
                        {stageDeals.map((deal, index) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            index={index}
                            stageColor={stage.color}
                            onClick={() => setSelectedDeal(deal)}
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
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
            {activeStages.map(stage => (
              <div key={stage.id} className="kanban-col flex-shrink-0" style={{ width: 220 }}>
                <div className="flex items-center gap-2 mb-3 px-1">
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
        <NewDealPanel onSave={handleNewDeal} onClose={() => setCreatingDeal(false)} />
      )}

      {managingPipeline && (
        <ManagePipelinesPanel
          pipelines={pipelines}
          activePipelineId={activePipeline.id}
          onClose={() => setManagingPipeline(false)}
          onChange={updated => { setPipelines(updated) }}
        />
      )}
    </>
  )
}
