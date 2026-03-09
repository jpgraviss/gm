'use client'

import { useState } from 'react'
import { X, User, Tag } from 'lucide-react'
import { crmCompanies } from '@/lib/data'
import type { ServiceType } from '@/lib/types'

const SERVICE_TYPES: ServiceType[] = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom']
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
const ASSIGNEES = ['Sarah Chen', 'Marcus Webb', 'Priya Patel', 'Jordan Ellis']

export interface NewTicketFormData {
  subject: string
  company: string
  contactName: string
  contactEmail: string
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  serviceType: ServiceType
  assignedTo: string
  body: string
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
  onSave: (data: NewTicketFormData) => void
  onClose: () => void
}

export default function NewTicketPanel({ onSave, onClose }: Props) {
  const [form, setForm] = useState<NewTicketFormData>({
    subject: '',
    company: '',
    contactName: '',
    contactEmail: '',
    priority: 'Medium',
    serviceType: 'Website',
    assignedTo: '',
    body: '',
  })

  const companyNames = crmCompanies.map(c => c.name)

  function set(field: keyof NewTicketFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.subject.trim() && form.company.trim() && form.contactName.trim() && form.body.trim()

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">New Ticket</h2>
            <p className="text-white/50 text-xs mt-0.5">Open a support ticket</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          <div>
            <FieldLabel>Subject</FieldLabel>
            <Input
              placeholder="Brief description of the issue..."
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Company</FieldLabel>
            <Input
              list="ticket-company-list"
              placeholder="Select or type company name..."
              value={form.company}
              onChange={e => set('company', e.target.value)}
            />
            <datalist id="ticket-company-list">
              {companyNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Contact Name</FieldLabel>
              <Input placeholder="Full name" value={form.contactName} onChange={e => set('contactName', e.target.value)} />
            </div>
            <div>
              <FieldLabel>Contact Email</FieldLabel>
              <Input type="email" placeholder="email@example.com" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel><span className="flex items-center gap-1"><Tag size={11} />Priority</span></FieldLabel>
              <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Service Type</FieldLabel>
              <Select value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel><span className="flex items-center gap-1"><User size={11} />Assigned To</span></FieldLabel>
            <Select value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
              <option value="">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>

          <div>
            <FieldLabel>Initial Message</FieldLabel>
            <textarea
              placeholder="Describe the issue in detail..."
              rows={5}
              value={form.body}
              onChange={e => set('body', e.target.value)}
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
            Open Ticket
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
