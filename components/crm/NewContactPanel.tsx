'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { crmCompanies } from '@/lib/data'

export interface NewContactFormData {
  firstName: string
  lastName: string
  title: string
  email: string
  phone: string
  mobile: string
  companyName: string
  linkedIn: string
  website: string
  owner: string
  notes: string
}

const REPS = ['Sarah Chen', 'Marcus Webb']

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
  onSave: (data: NewContactFormData) => void
  onClose: () => void
}

export default function NewContactPanel({ onSave, onClose }: Props) {
  const [form, setForm] = useState<NewContactFormData>({
    firstName: '',
    lastName: '',
    title: '',
    email: '',
    phone: '',
    mobile: '',
    companyName: '',
    linkedIn: '',
    website: '',
    owner: REPS[0],
    notes: '',
  })

  function set(field: keyof NewContactFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.companyName.trim()

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-[520px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">New Contact</h2>
            <p className="text-white/50 text-xs mt-0.5">Add a new contact to your CRM</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Name */}
          <div>
            <FieldLabel>Name</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="First name"
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Last name"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <FieldLabel>Title / Role</FieldLabel>
            <Input
              placeholder="e.g. Marketing Director"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          {/* Company */}
          <div>
            <FieldLabel>Company</FieldLabel>
            <Input
              list="contact-company-list"
              placeholder="Select or type company..."
              value={form.companyName}
              onChange={e => set('companyName', e.target.value)}
            />
            <datalist id="contact-company-list">
              {crmCompanies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>

          {/* Contact info */}
          <div>
            <FieldLabel>Contact Info</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="tel"
                  placeholder="Direct phone"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Mobile"
                  value={form.mobile}
                  onChange={e => set('mobile', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Online presence */}
          <div>
            <FieldLabel>Online Presence</FieldLabel>
            <div className="flex flex-col gap-2">
              <Input
                type="url"
                placeholder="Website URL"
                value={form.website}
                onChange={e => set('website', e.target.value)}
              />
              <Input
                type="url"
                placeholder="LinkedIn URL"
                value={form.linkedIn}
                onChange={e => set('linkedIn', e.target.value)}
              />
            </div>
          </div>

          {/* Owner */}
          <div>
            <FieldLabel>Owner</FieldLabel>
            <Select value={form.owner} onChange={e => set('owner', e.target.value)}>
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            <textarea
              placeholder="Background context, how you met, key interests..."
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
            Create Contact
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
