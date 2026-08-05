'use client'

import { useState } from 'react'
import { X, User, Calendar, TrendingUp, ChevronLeft } from 'lucide-react'
import { useTeamMembers } from '@/lib/useTeamMembers'
import CompanySelect from '@/components/ui/CompanySelect'
import DealLineItemsEditor from './DealLineItemsEditor'
import type { DealLineItem } from '@/lib/types'
import { SERVICE_NAMES } from '@/lib/services'

export interface NewDealData {
  company: string
  companyId?: string
  contactName: string
  contactTitle: string
  contactEmail: string
  contactPhone: string
  // Source of truth for the deal's value and service types — see
  // lib/deal-line-items.ts. The server derives `value`/`serviceTypes` from
  // these on save, so a deal pitched as multiple products at different
  // rates (one-time + recurring) is never squeezed into one number.
  lineItems: DealLineItem[]
  stage: string
  closeDate: string
  assignedRep: string
  probability: string
  notes: string
  pipelineId?: string
}

const DEFAULT_STAGES = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']
const DEFAULT_STAGE_PROBS: Record<string, string> = {
  Lead: '20',
  Qualified: '40',
  'Proposal Sent': '60',
  'Contract Sent': '80',
  'Closed Won': '100',
  'Closed Lost': '0',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-400"
    />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
    >
      {children}
    </select>
  )
}

interface Props {
  onSave: (deal: NewDealData) => void
  onClose: () => void
  stages?: { name: string; probability: number }[]
  pipelineId?: string
  // Pre-fills company when opened from a company's own page (e.g. the
  // Companies page's Deals tab) so the user doesn't have to re-select a
  // company they're already looking at.
  initialCompany?: string
  initialCompanyId?: string
}

export default function NewDealPanel({ onSave, onClose, stages, pipelineId, initialCompany, initialCompanyId }: Props) {
  const REPS = useTeamMembers()
  const stageNames = stages?.map(s => s.name) ?? DEFAULT_STAGES
  const stageProbs: Record<string, string> = stages
    ? Object.fromEntries(stages.map(s => [s.name, String(s.probability)]))
    : DEFAULT_STAGE_PROBS
  const [form, setForm] = useState<NewDealData>(() => ({
    company: initialCompany ?? '',
    companyId: initialCompanyId,
    contactName: '',
    contactTitle: '',
    contactEmail: '',
    contactPhone: '',
    lineItems: [{ id: `li-${Date.now()}`, serviceType: SERVICE_NAMES[0], billingType: 'one-time', amount: 0 }],
    stage: stageNames[0] ?? 'Lead',
    closeDate: '',
    assignedRep: REPS[0] ?? '',
    probability: stageProbs[stageNames[0] ?? 'Lead'] ?? '20',
    notes: '',
    pipelineId,
  }))

  function set(field: keyof NewDealData, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'stage' ? { probability: stageProbs[value] ?? prev.probability } : {}),
    }))
  }

  const hasLineItemValue = form.lineItems.some(item => item.amount > 0)
  const canSave = form.company.trim() && form.contactName.trim() && hasLineItemValue && form.closeDate

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div>
            <h2 className="text-white font-bold text-base">New Deal</h2>
            <p className="text-white/50 text-xs mt-0.5">Add a new deal to the pipeline</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Company */}
          <div>
            <FieldLabel>Company</FieldLabel>
            <CompanySelect
              value={form.company}
              onChange={(name, companyId) => setForm(prev => ({ ...prev, company: name, companyId }))}
              placeholder="Select a company..."
            />
          </div>

          {/* Contact info */}
          <div>
            <FieldLabel>Contact</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input placeholder="Full name" value={form.contactName} onChange={e => set('contactName', e.target.value)} />
              <Input placeholder="Title / Role" value={form.contactTitle} onChange={e => set('contactTitle', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="email" placeholder="Email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
                <Input type="tel" placeholder="Phone" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line items — product/service + rate + one-time/recurring,
              instead of one opaque Deal Value number. Service types and the
              total deal value are both derived from these on save. */}
          <div>
            <FieldLabel>Products / Services</FieldLabel>
            <DealLineItemsEditor
              items={form.lineItems}
              onChange={lineItems => setForm(prev => ({ ...prev, lineItems }))}
            />
          </div>

          {/* Stage + Probability */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Stage</FieldLabel>
              <Select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {stageNames.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel><span className="flex items-center gap-1"><TrendingUp size={11} />Probability %</span></FieldLabel>
              <Input
                type="number"
                placeholder="50"
                min="0"
                max="100"
                value={form.probability}
                onChange={e => set('probability', e.target.value)}
              />
            </div>
          </div>

          {/* Close Date + Assigned Rep */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><Calendar size={11} />Expected Close</span></FieldLabel>
              <Input type="date" value={form.closeDate} onChange={e => set('closeDate', e.target.value)} />
            </div>
            <div>
              <FieldLabel><span className="flex items-center gap-1"><User size={11} />Assigned Rep</span></FieldLabel>
              <Select value={form.assignedRep} onChange={e => set('assignedRep', e.target.value)}>
                {REPS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea
              placeholder="Deal context, key details..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => canSave && onSave(form)}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Create Deal
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
