'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CompanySize, CompanyStatus } from '@/lib/types'

export interface NewCompanyFormData {
  name: string
  industry: string
  website: string
  phone: string
  hq: string
  size: CompanySize
  annualRevenue: string
  status: CompanyStatus
  owner: string
  description: string
}

const REPS = ['Sarah Chen', 'Marcus Webb']
const STATUSES: CompanyStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned']
const SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-500', '500+']
const INDUSTRIES = [
  'Real Estate', 'Healthcare', 'Technology', 'Finance', 'Retail',
  'Education', 'Construction', 'Hospitality', 'Legal', 'Non-Profit', 'Other',
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
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
  onSave: (data: NewCompanyFormData) => void
  onClose: () => void
}

export default function NewCompanyPanel({ onSave, onClose }: Props) {
  const [form, setForm] = useState<NewCompanyFormData>({
    name: '',
    industry: '',
    website: '',
    phone: '',
    hq: '',
    size: '1-10',
    annualRevenue: '',
    status: 'Prospect',
    owner: REPS[0],
    description: '',
  })

  function set(field: keyof NewCompanyFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.name.trim() && form.industry && form.hq.trim()

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-[520px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">New Company</h2>
            <p className="text-white/50 text-xs mt-0.5">Add a new company to your CRM</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Company name */}
          <div>
            <FieldLabel>Company Name</FieldLabel>
            <Input
              placeholder="e.g. Coastal Realty Group"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </div>

          {/* Industry + Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Industry</FieldLabel>
              <Select value={form.industry} onChange={e => set('industry', e.target.value)}>
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Company Size</FieldLabel>
              <Select value={form.size} onChange={e => set('size', e.target.value as CompanySize)}>
                {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
              </Select>
            </div>
          </div>

          {/* HQ */}
          <div>
            <FieldLabel>HQ Location</FieldLabel>
            <Input
              placeholder="e.g. Austin, TX"
              value={form.hq}
              onChange={e => set('hq', e.target.value)}
            />
          </div>

          {/* Contact info */}
          <div>
            <FieldLabel>Contact Info</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input
                type="url"
                placeholder="Website URL"
                value={form.website}
                onChange={e => set('website', e.target.value)}
              />
              <Input
                type="tel"
                placeholder="Main phone number"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Annual Revenue */}
          <div>
            <FieldLabel>Annual Revenue ($)</FieldLabel>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={form.annualRevenue}
              onChange={e => set('annualRevenue', e.target.value)}
            />
          </div>

          {/* Status + Owner */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.status} onChange={e => set('status', e.target.value as CompanyStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Owner</FieldLabel>
              <Select value={form.owner} onChange={e => set('owner', e.target.value)}>
                {REPS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description / Notes</FieldLabel>
            <textarea
              placeholder="What does this company do? Any context..."
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
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
            Create Company
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
