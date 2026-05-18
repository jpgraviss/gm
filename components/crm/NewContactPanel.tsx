'use client'

import { useState } from 'react'
import { X, ChevronLeft, Loader2 } from 'lucide-react'
import { useTeamMembers } from '@/lib/useTeamMembers'
import CompanySelect from '@/components/ui/CompanySelect'
import { useEnrichment } from '@/lib/useEnrichment'

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>
}

function Input({ className: extra, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 ${extra ?? ''}`}
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
  const REPS = useTeamMembers()
  const { enriching, enrichedFields, enrich, markEnriched, clearEnriched } = useEnrichment()

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
    owner: REPS[0] ?? '',
    notes: '',
  })

  function set(field: keyof NewContactFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleEmailBlur() {
    const email = form.email.trim()
    if (!email || !email.includes('@')) return
    const domain = email.split('@')[1]
    if (!domain || ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'].includes(domain)) return
    if (enriching) return
    const data = await enrich(domain)
    if (!data) return
    const filled: string[] = []
    setForm(prev => {
      const next = { ...prev }
      if (data.name && !prev.companyName) { next.companyName = data.name; filled.push('companyName') }
      if (data.phone && !prev.phone) { next.phone = data.phone; filled.push('phone') }
      if (data.socialLinks?.linkedin && !prev.linkedIn) { next.linkedIn = data.socialLinks.linkedin; filled.push('linkedIn') }
      if (!prev.website) { next.website = `https://${domain}`; filled.push('website') }
      return next
    })
    if (filled.length > 0) markEnriched(filled)
  }

  async function handleWebsiteBlur() {
    if (!form.website.trim() || enriching) return
    const data = await enrich(form.website)
    if (!data) return
    const filled: string[] = []
    setForm(prev => {
      const next = { ...prev }
      if (data.name && !prev.companyName) { next.companyName = data.name; filled.push('companyName') }
      if (data.phone && !prev.phone) { next.phone = data.phone; filled.push('phone') }
      if (data.socialLinks?.linkedin && !prev.linkedIn) { next.linkedIn = data.socialLinks.linkedin; filled.push('linkedIn') }
      return next
    })
    if (filled.length > 0) markEnriched(filled)
  }

  function ec(field: string) {
    return enrichedFields.has(field) ? 'ring-2 ring-blue-300 bg-blue-50/30' : ''
  }

  const canSave = form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.companyName.trim()

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
            <FieldLabel>
              Company
              {enrichedFields.has('companyName') && (
                <button type="button" onClick={() => { clearEnriched('companyName'); set('companyName', '') }}
                  className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200 normal-case tracking-normal font-normal">
                  auto-filled &times;
                </button>
              )}
            </FieldLabel>
            <CompanySelect
              value={form.companyName}
              onChange={(name) => { set('companyName', name); clearEnriched('companyName') }}
              placeholder="Select a company..."
              className={ec('companyName')}
            />
          </div>

          {/* Contact info */}
          <div>
            <FieldLabel>Contact Info</FieldLabel>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  onBlur={handleEmailBlur}
                />
                {enriching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-blue-600">
                    <Loader2 size={12} className="animate-spin" /> Fetching info...
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="tel"
                    placeholder="Direct phone"
                    value={form.phone}
                    onChange={e => { set('phone', e.target.value); clearEnriched('phone') }}
                    className={ec('phone')}
                  />
                  {enrichedFields.has('phone') && (
                    <button type="button" onClick={() => { clearEnriched('phone'); set('phone', '') }}
                      className="mt-0.5 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                      auto-filled &times;
                    </button>
                  )}
                </div>
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
              <div className="relative">
                <Input
                  type="url"
                  placeholder="Website URL"
                  value={form.website}
                  onChange={e => { set('website', e.target.value); clearEnriched('website') }}
                  onBlur={handleWebsiteBlur}
                  className={ec('website')}
                />
                {enrichedFields.has('website') && (
                  <button type="button" onClick={() => { clearEnriched('website'); set('website', '') }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </div>
              <div>
                <Input
                  type="url"
                  placeholder="LinkedIn URL"
                  value={form.linkedIn}
                  onChange={e => { set('linkedIn', e.target.value); clearEnriched('linkedIn') }}
                  className={ec('linkedIn')}
                />
                {enrichedFields.has('linkedIn') && (
                  <button type="button" onClick={() => { clearEnriched('linkedIn'); set('linkedIn', '') }}
                    className="mt-0.5 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </div>
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
