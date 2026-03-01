'use client'

import { useState } from 'react'
import { X, DollarSign, Calendar } from 'lucide-react'
import { crmCompanies, contracts } from '@/lib/data'
import type { ServiceType } from '@/lib/types'

const SERVICE_TYPES: ServiceType[] = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom']

export interface NewInvoiceFormData {
  company: string
  serviceType: ServiceType
  amount: string
  dueDate: string
  contractId: string
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
  onSave: (data: NewInvoiceFormData) => void
  onClose: () => void
}

export default function NewInvoicePanel({ onSave, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [form, setForm] = useState<NewInvoiceFormData>({
    company: '',
    serviceType: 'Website',
    amount: '',
    dueDate: thirtyDaysOut,
    contractId: '',
  })

  const companyNames = crmCompanies.map(c => c.name)
  const companyContracts = contracts.filter(c => c.company === form.company)

  function set(field: keyof NewInvoiceFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.company.trim() && form.amount && form.dueDate

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(460px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">Create Invoice</h2>
            <p className="text-white/50 text-xs mt-0.5">Issue a new invoice</p>
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
              list="invoice-company-list"
              placeholder="Select or type company name..."
              value={form.company}
              onChange={e => set('company', e.target.value)}
            />
            <datalist id="invoice-company-list">
              {companyNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          {companyContracts.length > 0 && (
            <div>
              <FieldLabel>Linked Contract</FieldLabel>
              <Select value={form.contractId} onChange={e => set('contractId', e.target.value)}>
                <option value="">None / Standalone</option>
                {companyContracts.map(c => (
                  <option key={c.id} value={c.id}>{c.id.toUpperCase()} — {c.serviceType} ({c.status})</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <FieldLabel>Service Type</FieldLabel>
            <Select value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><DollarSign size={11} />Amount</span></FieldLabel>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
              />
            </div>
            <div>
              <FieldLabel><span className="flex items-center gap-1"><Calendar size={11} />Due Date</span></FieldLabel>
              <Input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl flex justify-between text-xs">
            <span className="text-gray-500">Issued date</span>
            <span className="font-semibold text-gray-800">{new Date(today).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
            Create Invoice
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
