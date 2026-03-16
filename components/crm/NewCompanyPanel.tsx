'use client'

import { useState } from 'react'
import { X, Check, Plus, Minus, ChevronDown, ChevronUp, ChevronLeft, Calculator } from 'lucide-react'
import type { CompanySize, CompanyStatus } from '@/lib/types'
import { useTeamMembers } from '@/lib/useTeamMembers'

// ─── Pricing Constants ─────────────────────────────────────────────────────────

const WEBSITE_MGMT_MONTHLY = 350
const SEO_PRICES = { basic: 550, standard: 700, premium: 900 } as const

type SeoPackage = 'none' | 'basic' | 'standard' | 'premium'

interface Addon {
  id: string
  label: string
  price: number
  hasQty: boolean
  qtyLabel?: string
  defaultQty: number
}

const SETUP_ADDONS: Addon[] = [
  { id: 'custom-design',     label: 'Custom Design',           price: 600, hasQty: false, defaultQty: 1 },
  { id: 'conversion-opt',    label: 'Conversion Optimization', price: 450, hasQty: false, defaultQty: 1 },
  { id: 'copywriting',       label: 'Copywriting',             price: 150, hasQty: true,  qtyLabel: 'pages', defaultQty: 5 },
  { id: 'blog-setup',        label: 'Blog Setup',              price: 400, hasQty: false, defaultQty: 1 },
  { id: 'blog-posts',        label: 'Blog Posts',              price: 250, hasQty: true,  qtyLabel: 'posts', defaultQty: 4 },
  { id: 'custom-form',       label: 'Custom Form',             price: 250, hasQty: false, defaultQty: 1 },
  { id: 'integrations',      label: 'Integrations',            price: 150, hasQty: true,  qtyLabel: 'each',  defaultQty: 2 },
  { id: 'basic-seo',         label: 'Basic On-Page SEO',       price: 350, hasQty: false, defaultQty: 1 },
  { id: 'technical-seo',     label: 'Technical SEO',           price: 450, hasQty: false, defaultQty: 1 },
  { id: 'local-seo',         label: 'Local SEO',               price: 350, hasQty: false, defaultQty: 1 },
  { id: 'gbp-optimization',  label: 'GBP Optimization',        price: 300, hasQty: false, defaultQty: 1 },
  { id: 'analytics-setup',   label: 'Analytics Setup',         price: 250, hasQty: false, defaultQty: 1 },
  { id: 'speed-optimization',label: 'Speed Optimization',      price: 350, hasQty: false, defaultQty: 1 },
  { id: 'revision-rounds',   label: 'Revision Rounds',         price: 250, hasQty: true,  qtyLabel: 'each',  defaultQty: 2 },
]

function fmt(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProposalDraft {
  websiteEnabled: boolean
  websiteFee: number
  enabledAddons: Record<string, { qty: number }>
  websiteMgmt: boolean
  seoPackage: SeoPackage
  contractMonths: number
  setupTotal: number
  monthlyTotal: number
  grandTotal: number
}

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
  proposal?: ProposalDraft
}

const STATUSES: CompanyStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned']
const SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-500', '500+']
const INDUSTRIES = [
  'OOH', 'Real Estate', 'Healthcare', 'Technology', 'Finance', 'Retail',
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
  const REPS = useTeamMembers()
  // ─── Company form state ───────────────────────────────────────────────────
  const [form, setForm] = useState<Omit<NewCompanyFormData, 'proposal'>>({
    name: '',
    industry: '',
    website: '',
    phone: '',
    hq: '',
    size: '1-10',
    annualRevenue: '',
    status: 'Prospect',
    owner: REPS[0] ?? '',
    description: '',
  })

  function set(field: keyof Omit<NewCompanyFormData, 'proposal'>, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ─── Proposal calculator state ────────────────────────────────────────────
  const [proposalOpen, setProposalOpen] = useState(false)
  const [websiteEnabled, setWebsiteEnabled] = useState(true)
  const [websiteFee, setWebsiteFee]         = useState<string>('3500')
  const [addons, setAddons] = useState<Record<string, { enabled: boolean; qty: number }>>(
    Object.fromEntries(SETUP_ADDONS.map(a => [a.id, { enabled: false, qty: a.defaultQty }]))
  )
  const [websiteMgmt, setWebsiteMgmt]   = useState(false)
  const [seoPackage, setSeoPackage]     = useState<SeoPackage>('none')
  const [contractMonths, setContractMonths] = useState(6)

  // ─── Calculations ─────────────────────────────────────────────────────────
  const websiteSetupCost = websiteEnabled ? (parseFloat(websiteFee) || 0) : 0
  const addonsCost = SETUP_ADDONS.reduce((sum, a) => {
    const s = addons[a.id]
    if (!s?.enabled) return sum
    return sum + a.price * (a.hasQty ? s.qty : 1)
  }, 0)
  const setupTotal   = websiteSetupCost + addonsCost
  const monthlyWebsite = websiteMgmt ? WEBSITE_MGMT_MONTHLY : 0
  const monthlySEO     = seoPackage !== 'none' ? SEO_PRICES[seoPackage] : 0
  const monthlyTotal   = monthlyWebsite + monthlySEO
  const grandTotal     = setupTotal + monthlyTotal * contractMonths

  function toggleAddon(id: string) {
    setAddons(prev => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }))
  }
  function setAddonQty(id: string, qty: number) {
    setAddons(prev => ({ ...prev, [id]: { ...prev[id], qty: Math.max(1, qty) } }))
  }

  // ─── Save ─────────────────────────────────────────────────────────────────
  const canSave = form.name.trim() && form.industry && form.hq.trim()

  function handleSave() {
    if (!canSave) return
    const proposal: ProposalDraft | undefined = proposalOpen ? {
      websiteEnabled,
      websiteFee: parseFloat(websiteFee) || 0,
      enabledAddons: Object.fromEntries(
        SETUP_ADDONS
          .filter(a => addons[a.id]?.enabled)
          .map(a => [a.id, { qty: addons[a.id].qty }])
      ),
      websiteMgmt,
      seoPackage,
      contractMonths,
      setupTotal,
      monthlyTotal,
      grandTotal,
    } : undefined
    onSave({ ...form, proposal })
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(560px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
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

          {/* ─── Proposal Calculator ───────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {/* Toggle header */}
            <button
              onClick={() => setProposalOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calculator size={15} className="text-emerald-700" />
                <span className="text-sm font-semibold text-gray-700">Proposal Calculator</span>
                {proposalOpen && (monthlyTotal > 0 || setupTotal > 0) && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    {fmt(monthlyTotal)}/mo · {fmt(setupTotal)} setup
                  </span>
                )}
              </div>
              {proposalOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>

            {proposalOpen && (
              <div className="p-4 flex flex-col gap-5">

                {/* ── Website Build ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Website Build</span>
                    <button
                      onClick={() => setWebsiteEnabled(v => !v)}
                      className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                      style={{ background: websiteEnabled ? '#015035' : '#e5e7eb' }}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${websiteEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {websiteEnabled && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Website Development Fee</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-500">$</span>
                        <input
                          type="number"
                          value={websiteFee}
                          onChange={e => setWebsiteFee(e.target.value)}
                          placeholder="0"
                          min="0"
                          className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {websiteSetupCost > 0 && (
                          <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmt(websiteSetupCost)}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">Enter the total website development fee for this project</p>
                    </div>
                  )}
                </div>

                {/* ── Setup Add-Ons ── */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Setup Add-Ons</p>
                  <div className="flex flex-col gap-1.5">
                    {SETUP_ADDONS.map(addon => {
                      const state = addons[addon.id]
                      return (
                        <div
                          key={addon.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${state.enabled ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                          onClick={() => toggleAddon(addon.id)}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${state.enabled ? 'bg-emerald-600' : 'bg-white border-2 border-gray-300'}`}>
                            {state.enabled && <Check size={11} className="text-white" />}
                          </div>
                          <span className="flex-1 text-sm text-gray-700">{addon.label}</span>

                          {addon.hasQty && state.enabled ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setAddonQty(addon.id, state.qty - 1)}
                                className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                <Minus size={9} />
                              </button>
                              <span className="w-5 text-center text-xs font-semibold">{state.qty}</span>
                              <button onClick={() => setAddonQty(addon.id, state.qty + 1)}
                                className="w-5 h-5 rounded bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                                <Plus size={9} />
                              </button>
                              <span className="text-[10px] text-gray-400 ml-0.5">{addon.qtyLabel}</span>
                              <span className="text-xs font-bold text-emerald-700 ml-1 w-14 text-right">{fmt(addon.price * state.qty)}</span>
                            </div>
                          ) : (
                            <span className={`text-xs font-semibold ${state.enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                              {fmt(addon.price)}{addon.hasQty ? `/${addon.qtyLabel}` : ''}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Monthly Services ── */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Monthly Services</p>
                  <div className="flex flex-col gap-2">

                    {/* Website Management */}
                    <div
                      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${websiteMgmt ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => setWebsiteMgmt(v => !v)}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${websiteMgmt ? 'bg-emerald-600' : 'bg-white border-2 border-gray-300'}`}>
                        {websiteMgmt && <Check size={11} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 font-medium">Website Management</p>
                        <p className="text-[11px] text-gray-400">Updates, maintenance, security</p>
                      </div>
                      <span className={`text-xs font-semibold ${websiteMgmt ? 'text-emerald-700' : 'text-gray-400'}`}>{fmt(WEBSITE_MGMT_MONTHLY)}/mo</span>
                    </div>

                    {/* SEO Package */}
                    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 mb-2">SEO Package</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['none', 'basic', 'standard', 'premium'] as const).map(pkg => (
                          <button key={pkg} onClick={() => setSeoPackage(pkg)}
                            className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${seoPackage === pkg ? 'text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            style={seoPackage === pkg ? { background: '#015035' } : {}}>
                            {pkg === 'none' ? 'None' : pkg.charAt(0).toUpperCase() + pkg.slice(1)}
                            {pkg !== 'none' && <span className="block text-[9px] font-normal opacity-80">{fmt(SEO_PRICES[pkg])}/mo</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contract Length */}
                    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-600">Contract Length</p>
                        <span className="text-xs font-bold text-gray-900">{contractMonths} months</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[3, 6, 12, 24].map(m => (
                          <button key={m} onClick={() => setContractMonths(m)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${contractMonths === m ? 'text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            style={contractMonths === m ? { background: '#015035' } : {}}>
                            {m}mo
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Live Totals ── */}
                <div className="rounded-2xl overflow-hidden border border-gray-200">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Proposal Summary</p>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    {setupTotal > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">One-Time Setup</span>
                        <span className="font-semibold text-gray-800">{fmt(setupTotal)}</span>
                      </div>
                    )}
                    {monthlyTotal > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Monthly Services</span>
                        <span className="font-bold text-emerald-700">{fmt(monthlyTotal)}/mo</span>
                      </div>
                    )}
                    {monthlyTotal > 0 && (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{contractMonths}-month contract subtotal</span>
                        <span>{fmt(monthlyTotal * contractMonths)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-2 mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Grand Total</span>
                      <span className="text-lg font-bold text-gray-900">{fmt(grandTotal)}</span>
                    </div>
                    {monthlyTotal > 0 && (
                      <p className="text-[11px] text-emerald-700 font-semibold text-right -mt-1">
                        {fmt(monthlyTotal)}/mo recurring
                      </p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Create Company{proposalOpen && grandTotal > 0 ? ` · ${fmt(grandTotal)}` : ''}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
