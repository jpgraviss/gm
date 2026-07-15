'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CompanySelect from '@/components/ui/CompanySelect'
import { useToast } from '@/components/ui/Toast'
import {
  X, Building2, User, Briefcase, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, Mail,
} from 'lucide-react'

const SERVICES = [
  'SEO', 'PPC', 'Web Design', 'Social Media',
  'Email Marketing', 'Content Creation', 'Sales Training', 'Marketing Strategy',
] as const

const MODAL_STEPS = ['Company', 'Contact', 'Services'] as const

interface Props {
  open: boolean
  onClose: () => void
}

export default function NewClientModal({ open, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [services, setServices] = useState<string[]>([])

  function reset() {
    setStep(0)
    setCompanyName('')
    setCompanyId('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setServices([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function toggleService(s: string) {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function canProceed(): boolean {
    if (step === 0) return !!companyName
    if (step === 1) return !!firstName && !!lastName && !!email
    if (step === 2) return services.length > 0
    return false
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      let resolvedCompanyId = companyId
      if (!resolvedCompanyId) {
        const companyRes = await fetch('/api/crm/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: companyName }),
        })
        if (!companyRes.ok) throw new Error('Failed to create company')
        const company = await companyRes.json()
        resolvedCompanyId = company.id
      }

      await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: resolvedCompanyId,
          companyName,
          firstName,
          lastName,
          emails: [email],
          phones: [],
          title: '',
          isPrimary: true,
          owner: '',
        }),
      })

      // /api/portal-clients/invite creates the portal_clients row AND the
      // working login (magic-link token + invite email) in one call; it
      // 409s if the row already exists. Calling plain /api/portal-clients
      // POST first (which also creates the row) and then invite would
      // always hit that 409 — the invite email would never send and the
      // client would have no way to log in despite the "success" toast.
      const inviteRes = await fetch('/api/portal-clients/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email,
          company: companyName,
          companyId: resolvedCompanyId,
          role: 'Viewer',
          services,
        }),
      })
      if (!inviteRes.ok) throw new Error('Failed to create portal client')

      await fetch('/api/delivery/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyId: resolvedCompanyId,
          serviceType: services[0] || SERVICES[0],
        }),
      })

      toast('Client created successfully', 'success')
      handleClose()
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create client', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Add New Client</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step + 1} of {MODAL_STEPS.length}: {MODAL_STEPS[step]}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          {MODAL_STEPS.map((_, i) => (
            <div key={i} className={`h-1 rounded-full flex-1 ${i <= step ? 'bg-[#015035]' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="px-5 py-5">
          {step === 0 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Company Name<span className="text-red-400 ml-0.5">*</span>
              </label>
              <CompanySelect
                value={companyName}
                onChange={(name, id) => { setCompanyName(name); if (id) setCompanyId(id) }}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    First Name<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#015035]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Last Name<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#015035]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email<span className="text-red-400 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-[#015035]/30"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">Select services for this client.</p>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map(s => {
                  const active = services.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm text-left transition-all ${
                        active
                          ? 'border-[#015035] bg-[#015035]/5 text-[#015035] font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white flex-shrink-0 ${
                        active ? 'bg-[#015035]' : 'border border-gray-300'
                      }`}>
                        {active && <CheckCircle size={9} />}
                      </div>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={() => step > 0 ? setStep(s => s - 1) : handleClose()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={14} />
            {step > 0 ? 'Back' : 'Cancel'}
          </button>

          {step < MODAL_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#015035' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {submitting ? 'Creating...' : 'Create Client'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
