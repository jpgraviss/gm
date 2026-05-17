'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import CompanySelect from '@/components/ui/CompanySelect'
import { useTeamMembers } from '@/lib/useTeamMembers'
import { useToast } from '@/components/ui/Toast'
import {
  Building2, User, Briefcase, FileText, Globe, Users, CheckCircle,
  ChevronRight, ChevronLeft, Loader2, Mail, Phone, Tag, Calendar,
  DollarSign, Eye, EyeOff, Shield,
} from 'lucide-react'

const STEPS = [
  { label: 'Company Info', icon: Building2 },
  { label: 'Primary Contact', icon: User },
  { label: 'Services', icon: Briefcase },
  { label: 'Agreement', icon: FileText },
  { label: 'Portal Access', icon: Globe },
  { label: 'Team Assignment', icon: Users },
  { label: 'Review & Create', icon: CheckCircle },
] as const

const SERVICES = [
  'SEO', 'PPC', 'Web Design', 'Social Media',
  'Email Marketing', 'Content Creation', 'Sales Training', 'Marketing Strategy',
] as const

type WizardData = {
  companyName: string
  companyId: string
  industry: string
  website: string
  address: string
  firstName: string
  lastName: string
  email: string
  phone: string
  title: string
  services: string[]
  contractId: string
  agreementStart: string
  agreementEnd: string
  monthlyValue: string
  createPortalLogin: boolean
  showAgreement: boolean
  showInvoices: boolean
  showReports: boolean
  accountManager: string
}

const INITIAL_DATA: WizardData = {
  companyName: '',
  companyId: '',
  industry: '',
  website: '',
  address: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  services: [],
  contractId: '',
  agreementStart: '',
  agreementEnd: '',
  monthlyValue: '',
  createPortalLogin: true,
  showAgreement: true,
  showInvoices: true,
  showReports: true,
  accountManager: '',
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 flex items-center gap-1">
          <div
            className={`h-1.5 rounded-full flex-1 transition-colors ${
              i < step ? 'bg-[#015035]' : i === step ? 'bg-[#015035]/60' : 'bg-gray-200'
            }`}
          />
        </div>
      ))}
    </div>
  )
}

function StepIndicator({ steps, current }: { steps: typeof STEPS; current: number }) {
  return (
    <div className="hidden lg:flex flex-col gap-1 w-56 flex-shrink-0">
      {steps.map((s, i) => {
        const Icon = s.icon
        const done = i < current
        const active = i === current
        return (
          <div
            key={s.label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? 'bg-[#015035]/10 text-[#015035] font-semibold' :
              done ? 'text-[#015035]' : 'text-gray-400'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
              done ? 'bg-[#015035] text-white' :
              active ? 'border-2 border-[#015035] text-[#015035]' : 'border border-gray-300 text-gray-400'
            }`}>
              {done ? <CheckCircle size={12} /> : i + 1}
            </div>
            <span className="truncate">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text', required, icon: Icon }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean
  icon?: React.ComponentType<{ size: number; className?: string }>
}) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon size={14} />
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-[#015035]/30 focus:border-[#015035] ${Icon ? 'pl-9' : ''}`}
      />
    </div>
  )
}

export default function NewClientPage() {
  const router = useRouter()
  const teamMembers = useTeamMembers()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function toggleService(s: string) {
    setData(prev => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter(x => x !== s)
        : [...prev.services, s],
    }))
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return !!data.companyName
      case 1: return !!data.firstName && !!data.lastName && !!data.email
      case 2: return data.services.length > 0
      case 3: return true
      case 4: return true
      case 5: return true
      case 6: return true
      default: return false
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const companyRes = await fetch('/api/crm/companies', {
        method: data.companyId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.companyId || undefined,
          name: data.companyName,
          industry: data.industry || undefined,
          website: data.website || undefined,
          hq: data.address || undefined,
        }),
      })
      if (!companyRes.ok) throw new Error('Failed to save company')
      const company = await companyRes.json()
      const companyId = company.id ?? data.companyId

      await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyName: data.companyName,
          firstName: data.firstName,
          lastName: data.lastName,
          emails: [data.email],
          phones: data.phone ? [data.phone] : [],
          title: data.title || '',
          isPrimary: true,
          owner: data.accountManager || '',
        }),
      })

      const portalRes = await fetch('/api/portal-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: data.companyName,
          email: data.email,
          contact: `${data.firstName} ${data.lastName}`,
          service: data.services.join(', '),
          services: data.services,
          companyId,
          portalConfig: {
            showAgreement: data.showAgreement,
            showInvoices: data.showInvoices,
            showReports: data.showReports,
          },
        }),
      })
      if (!portalRes.ok) throw new Error('Failed to create portal client')

      await fetch('/api/delivery/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName,
          companyId,
          serviceType: data.services[0] || 'Website',
        }),
      })

      if (data.createPortalLogin) {
        await fetch('/api/portal-clients/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            company: data.companyName,
            role: 'Viewer',
          }),
        }).catch(() => {})
      }

      toast('Client created successfully', 'success')
      router.push(`/crm/pipeline`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create client', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <FieldLabel required>Company Name</FieldLabel>
              <CompanySelect
                value={data.companyName}
                onChange={(name, id) => { update('companyName', name); if (id) update('companyId', id) }}
              />
            </div>
            <div>
              <FieldLabel>Industry</FieldLabel>
              <select
                value={data.industry}
                onChange={e => update('industry', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-[#015035]/30"
              >
                <option value="">Select industry...</option>
                {['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Real Estate', 'Legal', 'Non-Profit', 'Other'].map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Website</FieldLabel>
              <Input value={data.website} onChange={v => update('website', v)} placeholder="https://example.com" icon={Globe} />
            </div>
            <div>
              <FieldLabel>Address</FieldLabel>
              <Input value={data.address} onChange={v => update('address', v)} placeholder="123 Main St, City, State" />
            </div>
          </div>
        )
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>First Name</FieldLabel>
                <Input value={data.firstName} onChange={v => update('firstName', v)} placeholder="John" />
              </div>
              <div>
                <FieldLabel required>Last Name</FieldLabel>
                <Input value={data.lastName} onChange={v => update('lastName', v)} placeholder="Doe" />
              </div>
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <Input value={data.email} onChange={v => update('email', v)} placeholder="john@example.com" type="email" icon={Mail} />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input value={data.phone} onChange={v => update('phone', v)} placeholder="(555) 123-4567" icon={Phone} />
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input value={data.title} onChange={v => update('title', v)} placeholder="CEO, Marketing Director, etc." icon={Tag} />
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Select services to assign to this client.</p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map(s => {
                const active = data.services.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                      active
                        ? 'border-[#015035] bg-[#015035]/5 text-[#015035] font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-white flex-shrink-0 ${
                      active ? 'bg-[#015035]' : 'border border-gray-300'
                    }`}>
                      {active && <CheckCircle size={10} />}
                    </div>
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <div>
              <FieldLabel>Contract ID (optional)</FieldLabel>
              <Input value={data.contractId} onChange={v => update('contractId', v)} placeholder="Link existing contract or skip" icon={FileText} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Agreement Start</FieldLabel>
                <Input value={data.agreementStart} onChange={v => update('agreementStart', v)} type="date" icon={Calendar} />
              </div>
              <div>
                <FieldLabel>Agreement End</FieldLabel>
                <Input value={data.agreementEnd} onChange={v => update('agreementEnd', v)} type="date" icon={Calendar} />
              </div>
            </div>
            <div>
              <FieldLabel>Monthly Value</FieldLabel>
              <Input value={data.monthlyValue} onChange={v => update('monthlyValue', v)} placeholder="5000" type="number" icon={DollarSign} />
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-[#015035]" />
                <span className="text-sm font-medium text-gray-700">Create portal login for primary contact</span>
              </div>
              <button
                type="button"
                onClick={() => update('createPortalLogin', !data.createPortalLogin)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center ${
                  data.createPortalLogin ? 'bg-[#015035] justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">Visibility options for the client portal:</p>
            {([
              { key: 'showAgreement' as const, label: 'Show Agreement', icon: FileText },
              { key: 'showInvoices' as const, label: 'Show Invoices', icon: DollarSign },
              { key: 'showReports' as const, label: 'Show Reports', icon: Eye },
            ]).map(opt => (
              <div key={opt.key} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <opt.icon size={14} className="text-gray-500" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => update(opt.key, !data[opt.key])}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center ${
                    data[opt.key] ? 'bg-[#015035] justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5" />
                </button>
              </div>
            ))}
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <FieldLabel>Account Manager</FieldLabel>
              <select
                value={data.accountManager}
                onChange={e => update('accountManager', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-[#015035]/30"
              >
                <option value="">Select team member...</option>
                {teamMembers.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <ReviewRow label="Company" value={data.companyName} />
              <ReviewRow label="Industry" value={data.industry || 'Not specified'} />
              <ReviewRow label="Website" value={data.website || 'Not specified'} />
              <ReviewRow label="Address" value={data.address || 'Not specified'} />
            </div>
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <ReviewRow label="Contact" value={`${data.firstName} ${data.lastName}`} />
              <ReviewRow label="Email" value={data.email} />
              <ReviewRow label="Phone" value={data.phone || 'Not specified'} />
              <ReviewRow label="Title" value={data.title || 'Not specified'} />
            </div>
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <ReviewRow label="Services" value={data.services.join(', ')} />
              <ReviewRow label="Monthly Value" value={data.monthlyValue ? `$${Number(data.monthlyValue).toLocaleString()}` : 'Not specified'} />
              <ReviewRow label="Agreement" value={data.agreementStart ? `${data.agreementStart} to ${data.agreementEnd || 'ongoing'}` : 'Not specified'} />
            </div>
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <ReviewRow label="Portal Login" value={data.createPortalLogin ? 'Yes' : 'No'} />
              <ReviewRow label="Show Agreement" value={data.showAgreement ? 'Yes' : 'No'} />
              <ReviewRow label="Show Invoices" value={data.showInvoices ? 'Yes' : 'No'} />
              <ReviewRow label="Show Reports" value={data.showReports ? 'Yes' : 'No'} />
              <ReviewRow label="Account Manager" value={data.accountManager || 'Not assigned'} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <Header title="Add New Client" subtitle="Step-by-step client onboarding wizard" />
      <div className="p-4 md:p-6 flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Step {step + 1} of {STEPS.length}</p>
            <p className="text-xs text-gray-400">{STEPS[step].label}</p>
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>

        <div className="flex gap-6 flex-1">
          <StepIndicator steps={STEPS} current={step} />

          <div className="flex-1 min-w-0">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-1">{STEPS[step].label}</h2>
              <p className="text-sm text-gray-400 mb-5">
                {step === 0 && 'Enter the company details or select an existing company.'}
                {step === 1 && 'Add the primary point of contact.'}
                {step === 2 && 'Choose which services this client will receive.'}
                {step === 3 && 'Link a contract and set agreement terms.'}
                {step === 4 && 'Configure client portal access.'}
                {step === 5 && 'Assign a team member to manage this account.'}
                {step === 6 && 'Review everything and create the client.'}
              </p>
              {renderStep()}
            </div>

            <div className="flex items-center justify-between mt-5">
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
                Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#015035' }}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#015035' }}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {submitting ? 'Creating...' : 'Create Client'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}
