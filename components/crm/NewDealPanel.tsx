'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign, User, Calendar, TrendingUp } from 'lucide-react'
import { fetchCrmCompanies } from '@/lib/supabase'
import type { ServiceType, DealStage, CRMCompany } from '@/lib/types'

export interface NewDealData {
  company: string
  contactName: string
  contactTitle: string
  contactEmail: string
  contactPhone: string
  serviceType: ServiceType
  stage: DealStage
  value: string
  closeDate: string
  assignedRep: string
  probability: string
  notes: string
}

const SERVICE_TYPES: ServiceType[] = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom']
const STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']
const REPS = ['Jonathan Graviss', 'JG Graviss']

const STAGE_PROBS: Record<DealStage, string> = {
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
}

export default function NewDealPanel({ onSave, onClose }: Props) {
  const [form, setForm] = useState<NewDealData>({
    company: '',
    contactName: '',
    contactTitle: '',
    contactEmail: '',
    contactPhone: '',
    serviceType: 'Website',
    stage: 'Lead',
    value: '',
    closeDate: '',
    assignedRep: REPS[0],
    probability: STAGE_PROBS['Lead'],
    notes: '',
  })

  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  useEffect(() => { fetchCrmCompanies().then(setCrmCompanies) }, [])
  const companyNames = crmCompanies.map(c => c.name)

  function set(field: keyof NewDealData, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'stage' ? { probability: STAGE_PROBS[value as DealStage] } : {}),
    }))
  }

  const canSave = form.company.trim() && form.contactName.trim() && form.value && form.closeDate

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
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
            <Input
              list="company-list"
              placeholder="Select or type company name..."
              value={form.company}
              onChange={e => set('company', e.target.value)}
            />
            <datalist id="company-list">
              {companyNames.map(n => <option key={n} value={n} />)}
            </datalist>
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

          {/* Service + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Service Type</FieldLabel>
              <Select value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Stage</FieldLabel>
              <Select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          {/* Value + Probability */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><DollarSign size={11} />Deal Value</span></FieldLabel>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={form.value}
                onChange={e => set('value', e.target.value)}
              />
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
