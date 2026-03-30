'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign, User, FileText, ChevronLeft } from 'lucide-react'
import { fetchCrmCompanies } from '@/lib/supabase'
import { useTeamMembers } from '@/lib/useTeamMembers'
import type { ServiceType, CRMCompany } from '@/lib/types'

const SERVICE_TYPES: ServiceType[] = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom']
export interface NewProposalFormData {
  company: string
  serviceType: ServiceType
  assignedRep: string
  value: string
  notes: string
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
  onSave: (data: NewProposalFormData) => void
  onClose: () => void
}

export default function NewProposalPanel({ onSave, onClose }: Props) {
  const REPS = useTeamMembers()
  const [form, setForm] = useState<NewProposalFormData>({
    company: '',
    serviceType: 'Website',
    assignedRep: 'Graviss Marketing',
    value: '',
    notes: '',
  })

  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  useEffect(() => { fetchCrmCompanies().then(setCrmCompanies) }, [])
  const companyNames = crmCompanies.map(c => c.name)

  function set(field: keyof NewProposalFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.company.trim() && form.value

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div>
            <h2 className="text-white font-bold text-base">New Proposal</h2>
            <p className="text-white/50 text-xs mt-0.5">Create a draft proposal</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          <div>
            <FieldLabel>Company</FieldLabel>
            <Input
              list="proposal-company-list"
              placeholder="Select or type company name..."
              value={form.company}
              onChange={e => set('company', e.target.value)}
            />
            <datalist id="proposal-company-list">
              {companyNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Service Type</FieldLabel>
              <Select value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel><span className="flex items-center gap-1"><User size={11} />Assigned Rep</span></FieldLabel>
              <Select value={form.assignedRep} onChange={e => set('assignedRep', e.target.value)}>
                <option value="Graviss Marketing">Graviss Marketing</option>
                {REPS.filter(r => r !== 'Graviss Marketing').map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel><span className="flex items-center gap-1"><DollarSign size={11} />Total Value</span></FieldLabel>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={form.value}
              onChange={e => set('value', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel><span className="flex items-center gap-1"><FileText size={11} />Notes</span></FieldLabel>
            <textarea
              placeholder="Proposal context, scope overview..."
              rows={4}
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
            Create Draft
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
