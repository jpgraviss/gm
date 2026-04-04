'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, DollarSign, User, Calendar, ChevronLeft, Search, FileText } from 'lucide-react'
import { fetchCrmCompanies, fetchProposals } from '@/lib/supabase'
import { useTeamMembers } from '@/lib/useTeamMembers'
import type { ServiceType, CRMCompany, Proposal } from '@/lib/types'

const SERVICE_TYPES: ServiceType[] = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom']
const BILLING_STRUCTURES = ['One-Time', 'Monthly Retainer', 'Quarterly', 'Annual']

export interface NewContractFormData {
  company: string
  serviceType: ServiceType
  assignedRep: string
  value: string
  billingStructure: string
  duration: string
  startDate: string
  proposalId?: string
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
  onSave: (data: NewContractFormData) => void
  onClose: () => void
}

export default function NewContractPanel({ onSave, onClose }: Props) {
  const REPS = useTeamMembers()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<NewContractFormData>({
    company: '',
    serviceType: 'Website',
    assignedRep: 'Graviss Marketing',
    value: '',
    billingStructure: 'Monthly Retainer',
    duration: '12',
    startDate: today,
  })

  const [crmCompanies, setCrmCompanies] = useState<CRMCompany[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalSearch, setProposalSearch] = useState('')
  const [showProposalPicker, setShowProposalPicker] = useState(false)
  const [linkedProposal, setLinkedProposal] = useState<Proposal | null>(null)

  useEffect(() => { fetchCrmCompanies().then(setCrmCompanies) }, [])
  useEffect(() => { fetchProposals().then(setProposals) }, [])

  const companyNames = crmCompanies.map(c => c.name)

  // Proposals eligible to be converted to contracts: exclude declined.
  const eligibleProposals = useMemo(
    () => proposals.filter(p => p.status !== 'Declined'),
    [proposals]
  )

  const filteredProposals = useMemo(() => {
    const q = proposalSearch.trim().toLowerCase()
    if (!q) return eligibleProposals.slice(0, 20)
    return eligibleProposals.filter(p =>
      p.company.toLowerCase().includes(q) ||
      p.serviceType.toLowerCase().includes(q) ||
      p.assignedRep.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [eligibleProposals, proposalSearch])

  function set(field: keyof NewContractFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function selectProposal(p: Proposal) {
    setLinkedProposal(p)
    setShowProposalPicker(false)
    setProposalSearch('')
    // Auto-fill from proposal. User can still edit any field.
    setForm(prev => ({
      ...prev,
      company:     p.company,
      serviceType: p.serviceType,
      assignedRep: p.assignedRep || prev.assignedRep,
      value:       String(p.value ?? ''),
      proposalId:  p.id,
    }))
  }

  function unlinkProposal() {
    setLinkedProposal(null)
    setForm(prev => ({ ...prev, proposalId: undefined }))
  }

  const canSave = form.company.trim() && form.value && form.startDate

  // Compute renewal date preview
  const renewalDate = (() => {
    try {
      const d = new Date(form.startDate)
      d.setMonth(d.getMonth() + Number(form.duration))
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return '—'
    }
  })()

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
            <h2 className="text-white font-bold text-base">New Contract</h2>
            <p className="text-white/50 text-xs mt-0.5">Create a draft contract</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Proposal lookup — generates contract from an existing proposal */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            {linkedProposal ? (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Linked to proposal</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{linkedProposal.company} · {linkedProposal.serviceType}</p>
                  <p className="text-[11px] text-gray-500">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(linkedProposal.value)}
                    {' · '}{linkedProposal.status}
                    {' · '}{linkedProposal.id}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={unlinkProposal}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 underline"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Generate from proposal</p>
                    <p className="text-[11px] text-gray-500">Search an existing proposal to pre-fill this contract</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProposalPicker(v => !v)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                  >
                    {showProposalPicker ? 'Hide' : 'Find proposal'}
                  </button>
                </div>
                {showProposalPicker && (
                  <div className="mt-2">
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={proposalSearch}
                        onChange={e => setProposalSearch(e.target.value)}
                        placeholder="Search by company, service, rep, or ID…"
                        className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder-gray-400"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                      {filteredProposals.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-6">
                          {proposalSearch ? 'No matching proposals' : 'No eligible proposals'}
                        </p>
                      ) : (
                        filteredProposals.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectProposal(p)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{p.company}</p>
                              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.value)}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">
                              {p.serviceType} · {p.status} · {p.assignedRep || 'Unassigned'}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <FieldLabel>Company</FieldLabel>
            <Input
              list="contract-company-list"
              placeholder="Select or type company name..."
              value={form.company}
              onChange={e => set('company', e.target.value)}
            />
            <datalist id="contract-company-list">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><DollarSign size={11} />Contract Value</span></FieldLabel>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={form.value}
                onChange={e => set('value', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Billing Structure</FieldLabel>
              <Select value={form.billingStructure} onChange={e => set('billingStructure', e.target.value)}>
                {BILLING_STRUCTURES.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><Calendar size={11} />Start Date</span></FieldLabel>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Duration (months)</FieldLabel>
              <Input
                type="number"
                placeholder="12"
                min="1"
                max="60"
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
              />
            </div>
          </div>

          {form.startDate && form.duration && (
            <div className="p-3 bg-gray-50 rounded-xl flex justify-between text-xs">
              <span className="text-gray-500">Renewal date</span>
              <span className="font-semibold text-gray-800">{renewalDate}</span>
            </div>
          )}
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
