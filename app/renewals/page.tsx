'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { fetchContracts, fetchCrmContacts, fetchProposals } from '@/lib/supabase'
import { formatCurrency, serviceTypeColors, renewalStatusColors, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useTeamMembers } from '@/lib/useTeamMembers'
import CompanySelect from '@/components/ui/CompanySelect'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Renewal, Contract, CRMContact, Proposal } from '@/lib/types'
import {
  X, AlertTriangle, Clock, CheckCircle, Calendar, DollarSign,
  ChevronRight, User, FileText, TrendingUp, Mail, Phone,
  RefreshCw, AlertCircle, Plus, Minus, Bell, Search, Inbox,
} from 'lucide-react'
import Link from 'next/link'

type FilterTab = 'all' | 'upcoming30' | 'upcoming60' | 'overdue' | 'renewed'

function UrgencyBar({ days }: { days: number }) {
  const pct = Math.max(0, Math.min(100, (days / 90) * 100))
  const color = days <= 0 ? '#dc2626' : days <= 14 ? '#ef4444' : days <= 30 ? '#f97316' : days <= 60 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${100 - pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {days <= 0 ? 'Overdue' : `${days}d`}
      </span>
    </div>
  )
}

function DaysIndicator({ days }: { days: number }) {
  const color = days <= 0 ? '#dc2626' : days <= 14 ? '#ef4444' : days <= 30 ? '#f97316' : days <= 60 ? '#f59e0b' : '#22c55e'
  const bg = days <= 0 ? '#fef2f2' : days <= 14 ? '#fef2f2' : days <= 30 ? '#fff7ed' : days <= 60 ? '#fffbeb' : '#f0fdf4'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color, background: bg }}
    >
      {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
    </span>
  )
}

const urgencyBand = (days: number) =>
  days <= 0 ? { label: 'Overdue', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  : days <= 14 ? { label: 'Critical', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  : days <= 30 ? { label: 'High', bg: '#fff7ed', color: '#f97316', border: '#fed7aa' }
  : days <= 60 ? { label: 'Medium', bg: '#fffbeb', color: '#d97706', border: '#fde68a' }
  : { label: 'Low', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }

// ─── Renewal Proposal Sidebar ─────────────────────────────────────────────────

function RenewalProposalSidebar({
  renewal,
  onClose,
  onSave,
  contracts,
}: {
  renewal: Renewal
  onClose: () => void
  onSave: (renewalId: string) => void
  contracts: Contract[]
}) {
  const contract = contracts.find(c => c.id === renewal.contractId || c.company === renewal.company)
  const [increasePercent, setIncreasePercent] = useState(5)
  const [months, setMonths] = useState(12)
  const [notes, setNotes] = useState('')
  const [includeSetup, setIncludeSetup] = useState(false)
  const [setupFee, setSetupFee] = useState(0)

  const baseMonthly = contract ? contract.value : renewal.renewalValue
  const newMonthly = Math.round(baseMonthly * (1 + increasePercent / 100))
  const newContractTotal = newMonthly * months
  const totalWithSetup = newContractTotal + setupFee
  const difference = newMonthly - baseMonthly

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(440px, 100vw)' }}>
        <div className="p-5 flex-shrink-0 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-white/50 text-[11px] mb-0.5">{renewal.company} · {renewal.serviceType}</p>
              <h2 className="text-white text-base font-bold">Renewal Proposal</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/60" /></button>
          </div>
          <p className="text-white/40 text-xs mt-1">Internal use only — not sent to client until approved</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Contract</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Service', value: renewal.serviceType },
                { label: 'Current Monthly', value: formatCurrency(Math.round(baseMonthly)) },
                { label: 'Current Annual', value: formatCurrency(Math.round(baseMonthly * 12)) },
                { label: 'Expires', value: formatDate(renewal.expirationDate) },
              ].map(f => (
                <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                  <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Price Adjustment</p>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setIncreasePercent(p => Math.max(0, p - 1))}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
              >
                <Minus size={14} />
              </button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-gray-900">{increasePercent}%</span>
                <p className="text-xs text-gray-400 mt-0.5">increase</p>
              </div>
              <button
                onClick={() => setIncreasePercent(p => Math.min(50, p + 1))}
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[0, 3, 5, 8, 10, 15].map(pct => (
                <button
                  key={pct}
                  onClick={() => setIncreasePercent(pct)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    increasePercent === pct
                      ? 'text-white border-transparent'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  style={increasePercent === pct ? { background: '#015035' } : {}}
                >
                  {pct === 0 ? 'Same rate' : `+${pct}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">New Contract Length</p>
            <div className="flex gap-2">
              {[6, 12, 18, 24].map(m => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    months === m
                      ? 'text-white border-transparent'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                  style={months === m ? { background: '#015035' } : {}}
                >
                  {m}mo
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">One-Time Setup / Onboarding</p>
              <button
                onClick={() => setIncludeSetup(!includeSetup)}
                className="w-10 h-5 rounded-full relative transition-colors"
                style={{ background: includeSetup ? '#015035' : '#d1d5db' }}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform" style={{ transform: includeSetup ? 'translateX(18px)' : 'translateX(2px)' }} />
              </button>
            </div>
            {includeSetup && (
              <div>
                <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Setup Fee ($)</label>
                <input
                  type="number"
                  value={setupFee}
                  onChange={e => setSetupFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Internal Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Rationale for rate increase, scope changes, key talking points..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-700 resize-none"
            />
          </div>

          <div className="p-4 rounded-xl" style={{ background: '#012b1e' }}>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wide mb-3">Renewal Summary</p>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-xs">New Monthly Rate</span>
                <span className="text-white font-bold">{formatCurrency(newMonthly)}/mo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-xs">Change from Current</span>
                <span className={`text-xs font-semibold ${difference >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {difference >= 0 ? '+' : ''}{formatCurrency(difference)}/mo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-xs">Contract Duration</span>
                <span className="text-white text-xs font-medium">{months} months</span>
              </div>
              {includeSetup && setupFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-xs">Setup Fee</span>
                  <span className="text-white text-xs font-medium">{formatCurrency(setupFee)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 mt-1 flex justify-between items-center">
                <span className="text-white/70 text-xs font-semibold">Total Contract Value</span>
                <span className="text-white font-bold text-lg">{formatCurrency(totalWithSetup)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onSave(renewal.id)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Save Renewal Proposal
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Log Renewal Modal ────────────────────────────────────────────────────────

type LogRenewalPayload = {
  company: string
  serviceType: string
  startDate: string
  expirationDate: string
  daysUntilExpiry: number
  renewalValue: number
  assignedRep: string
  notes: string
  contractId: string
  status: 'Upcoming'
}

function LogRenewalModal({ onClose, onSave }: { onClose: () => void; onSave: (payload: LogRenewalPayload) => void }) {
  const teamMembers = useTeamMembers()

  const [company, setCompany] = useState('')
  const [serviceType, setServiceType] = useState('Website')
  const [customServices, setCustomServices] = useState<string[]>([])
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expirationDate, setExpirationDate] = useState(() => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [costPerMonth, setCostPerMonth] = useState('')
  const [contractMonths, setContractMonths] = useState('12')
  const [assignedRep, setAssignedRep] = useState('')
  const [notes, setNotes] = useState('')

  const monthlyRate = parseFloat(costPerMonth) || 0
  const months = parseInt(contractMonths) || 12
  const renewalValue = monthlyRate * months

  const canSave = company.trim() && expirationDate

  const CUSTOM_SERVICE_OPTIONS = ['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Content Marketing', 'PPC', 'Design', 'Development', 'Consulting']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <h2 className="text-white text-sm font-bold">Log Renewal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/60" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Name *</label>
            <CompanySelect
              value={company}
              onChange={(name) => setCompany(name)}
              placeholder="Select a company..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
            <select value={serviceType} onChange={e => { setServiceType(e.target.value); if (e.target.value !== 'Custom') setCustomServices([]) }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              {['Website', 'SEO', 'Social Media', 'Branding', 'Email Marketing', 'Custom'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {serviceType === 'Custom' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Select Services</label>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_SERVICE_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCustomServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      customServices.includes(s)
                        ? 'bg-green-50 border-green-600 text-green-800 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End / Expiry Date *</label>
              <input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cost Per Month ($)</label>
              <input type="number" value={costPerMonth} onChange={e => setCostPerMonth(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" placeholder="1000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contract Months</label>
              <select value={contractMonths} onChange={e => setContractMonths(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
                {[3, 6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} months</option>)}
              </select>
            </div>
          </div>
          {monthlyRate > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Renewal Value</span>
                <span className="font-bold text-gray-900">{formatCurrency(renewalValue)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">{formatCurrency(monthlyRate)}/mo &times; {months} months</span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assigned Rep</label>
            <select value={assignedRep} onChange={e => setAssignedRep(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              <option value="">Select rep...</option>
              {teamMembers.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 resize-none" placeholder="Renewal details..." />
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 flex gap-2 flex-shrink-0 border-t border-gray-100">
          <button
            onClick={() => {
              if (canSave) {
                const daysUntilExpiry = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86400000)
                const svcType = serviceType === 'Custom' && customServices.length > 0 ? customServices.join(', ') : serviceType
                onSave({ company: company.trim(), serviceType: svcType, startDate, expirationDate, daysUntilExpiry, renewalValue: renewalValue || 0, assignedRep, notes, contractId: '', status: 'Upcoming' })
                onClose()
              }
            }}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            Log Renewal
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Renewal Detail Panel ─────────────────────────────────────────────────────

function RenewalPanel({
  renewal,
  onClose,
  onStartRenewal,
  onOpenProposal,
  crmContacts,
  contracts,
  proposals,
}: {
  renewal: Renewal
  onClose: () => void
  onStartRenewal: (id: string) => void
  onOpenProposal: (renewal: Renewal) => void
  crmContacts: CRMContact[]
  contracts: Contract[]
  proposals: Proposal[]
}) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview')

  const contact = crmContacts.find(c => c.companyName === renewal.company && c.isPrimary)
  const contract = contracts.find(c => c.id === renewal.contractId || c.company === renewal.company)
  const relatedProposals = proposals.filter(p => p.company === renewal.company)
  const band = urgencyBand(renewal.daysUntilExpiry)
  const isExpired = renewal.daysUntilExpiry <= 0
  const isRenewed = renewal.status === 'Renewed'

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isRenewed ? '#015035' : band.color + '33' }}>
                <RefreshCw size={18} style={{ color: isRenewed ? '#fff' : band.color }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{renewal.company}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge label={renewal.serviceType} colorClass={serviceTypeColors[renewal.serviceType]} />
                  <StatusBadge label={renewal.status} colorClass={renewalStatusColors[renewal.status]} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Renewal Value', value: formatCurrency(renewal.renewalValue) },
              { label: 'Days Until Expiry', value: isExpired ? 'Expired' : `${renewal.daysUntilExpiry}d` },
              { label: 'Urgency', value: band.label },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-xs font-bold truncate">{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {!isRenewed && (
                <div className="p-4 rounded-xl border" style={{ background: band.bg, borderColor: band.border }}>
                  <div className="flex items-start gap-2.5">
                    {renewal.daysUntilExpiry <= 30
                      ? <AlertCircle size={16} style={{ color: band.color }} className="flex-shrink-0 mt-0.5" />
                      : <Clock size={16} style={{ color: band.color }} className="flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-sm font-semibold" style={{ color: band.color }}>
                        {isExpired ? 'Contract Expired' : `Expiring in ${renewal.daysUntilExpiry} days`}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: band.color + 'cc' }}>
                        {renewal.daysUntilExpiry <= 14 ? 'Immediate action required. Send renewal proposal now.'
                          : renewal.daysUntilExpiry <= 30 ? 'Schedule a renewal call this week. Start the proposal process.'
                          : renewal.daysUntilExpiry <= 60 ? 'Reach out soon to start the renewal conversation.'
                          : 'On radar — contact 90 days before expiry.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Renewal Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Expiration Date', value: formatDate(renewal.expirationDate) },
                    { label: 'Renewal Value', value: formatCurrency(renewal.renewalValue) },
                    { label: 'Service Type', value: renewal.serviceType },
                    { label: 'Assigned Rep', value: renewal.assignedRep },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {contact && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Contact</p>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 mb-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{contact.fullName}</p>
                      <p className="text-xs text-gray-500">{contact.title}</p>
                    </div>
                    <Link href="/crm/contacts" className="text-xs text-blue-500 flex items-center gap-1 flex-shrink-0">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex gap-2">
                    <a href={`mailto:${contact.emails[0] ?? ''}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                      <Mail size={12} /> Email
                    </a>
                    <a href={`tel:${contact.phones[0] ?? ''}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                      <Phone size={12} /> Call
                    </a>
                  </div>
                </div>
              )}

              {contract && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original Contract</p>
                    <Link href="/contracts" className="text-xs text-blue-500 flex items-center gap-1">View <ChevronRight size={11} /></Link>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{contract.billingStructure}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(contract.value)} · {contract.serviceType}</p>
                      </div>
                    </div>
                    <StatusBadge label={contract.status} colorClass="bg-green-100 text-green-700" />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="flex flex-col gap-3">
              {relatedProposals.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No prior proposals found.</p>
                </div>
              ) : (
                relatedProposals.map(p => (
                  <div key={p.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <StatusBadge
                          label={p.status}
                          colorClass={
                            p.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                            p.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            p.status === 'Draft' ? 'bg-gray-100 text-gray-500' :
                            'bg-red-100 text-red-600'
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">{p.serviceType}</p>
                      </div>
                      <p className="text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}>
                        {formatCurrency(p.value)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400">Sent {formatDate(p.createdDate)}</p>
                  </div>
                ))
              )}
              <Link href="/proposals" className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2">
                View all proposals <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {isRenewed ? (
            <div className="flex-1 flex items-center gap-2 py-2.5 justify-center text-emerald-600 text-sm font-semibold">
              <CheckCircle size={16} /> Renewed
            </div>
          ) : renewal.status === 'In Progress' ? (
            <button
              onClick={() => { onOpenProposal(renewal); onClose() }}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              Create Renewal Proposal
            </button>
          ) : (
            <button
              onClick={() => { onStartRenewal(renewal.id); onClose() }}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              Start Renewal Process
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RenewalsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [localRenewals, setLocalRenewals] = useState<Renewal[]>([])
  const [selected, setSelected] = useState<Renewal | null>(null)
  const [renewalProposalFor, setRenewalProposalFor] = useState<Renewal | null>(null)
  const [showLogRenewal, setShowLogRenewal] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/renewals')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalRenewals(data) })
      .catch(() => toast('Failed to load renewals', 'error'))
      .finally(() => setLoading(false))
    fetchContracts().then(setContracts)
    fetchCrmContacts().then(setCrmContacts)
    fetchProposals().then(setProposals)
  }, [])

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const metrics = useMemo(() => ({
    total: localRenewals.length,
    due30: localRenewals.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 30 && r.status !== 'Renewed').length,
    due60: localRenewals.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 60 && r.status !== 'Renewed').length,
    renewedThisMonth: localRenewals.filter(r => {
      if (r.status !== 'Renewed') return false
      const expDate = new Date(r.expirationDate)
      return expDate >= thisMonthStart && expDate <= thisMonthEnd
    }).length,
    renewalValue: localRenewals.filter(r => r.status !== 'Churned').reduce((s, r) => s + r.renewalValue, 0),
  }), [localRenewals])

  const filtered = useMemo(() => {
    let list = [...localRenewals]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r => r.company.toLowerCase().includes(q))
    }

    switch (activeTab) {
      case 'upcoming30':
        list = list.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 30 && r.status !== 'Renewed')
        break
      case 'upcoming60':
        list = list.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 60 && r.status !== 'Renewed')
        break
      case 'overdue':
        list = list.filter(r => r.daysUntilExpiry <= 0 && r.status !== 'Renewed')
        break
      case 'renewed':
        list = list.filter(r => r.status === 'Renewed')
        break
    }

    return list.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  }, [localRenewals, activeTab, searchQuery])

  const tabCounts = useMemo(() => ({
    all: localRenewals.length,
    upcoming30: localRenewals.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 30 && r.status !== 'Renewed').length,
    upcoming60: localRenewals.filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 60 && r.status !== 'Renewed').length,
    overdue: localRenewals.filter(r => r.daysUntilExpiry <= 0 && r.status !== 'Renewed').length,
    renewed: localRenewals.filter(r => r.status === 'Renewed').length,
  }), [localRenewals])

  function startRenewal(id: string) {
    setLocalRenewals(prev => prev.map(r => r.id === id ? { ...r, status: 'In Progress' as const } : r))
    fetch(`/api/renewals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'In Progress' }),
    }).catch(() => toast('Failed to start renewal', 'error'))
  }

  async function logRenewal(data: LogRenewalPayload) {
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const saved = await res.json()
        setLocalRenewals(prev => [saved, ...prev])
      } else {
        setLocalRenewals(prev => [{ id: `ren-${Date.now()}`, ...data } as Renewal, ...prev])
      }
    } catch {
      setLocalRenewals(prev => [{ id: `ren-${Date.now()}`, ...data } as Renewal, ...prev])
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  const FILTER_TABS: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <RefreshCw size={13} /> },
    { key: 'upcoming30', label: '30 Days', icon: <AlertTriangle size={13} /> },
    { key: 'upcoming60', label: '60 Days', icon: <Clock size={13} /> },
    { key: 'overdue', label: 'Overdue', icon: <AlertCircle size={13} /> },
    { key: 'renewed', label: 'Renewed', icon: <CheckCircle size={13} /> },
  ]

  return (
    <>
      <Header
        title="Renewals"
        subtitle="Forecast and manage contract renewals"
        action={{ label: 'Log Renewal', onClick: () => setShowLogRenewal(true) }}
      />
      <div className="p-3 sm:p-6 flex-1">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Renewals', value: metrics.total.toString(), icon: <RefreshCw size={16} />, color: '#015035', sub: 'All tracked renewals' },
            { label: 'Due in 30 Days', value: metrics.due30.toString(), icon: <AlertTriangle size={16} />, color: '#ef4444', sub: 'Immediate action' },
            { label: 'Due in 60 Days', value: metrics.due60.toString(), icon: <Clock size={16} />, color: '#f97316', sub: 'Schedule outreach' },
            { label: 'Renewed This Month', value: metrics.renewedThisMonth.toString(), icon: <CheckCircle size={16} />, color: '#22c55e', sub: formatCurrency(metrics.renewalValue) + ' pipeline' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-1 overflow-x-auto flex-1">
              {FILTER_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === t.key
                      ? 'text-white'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                  style={activeTab === t.key ? { background: '#015035' } : {}}
                >
                  {t.icon}
                  {t.label}
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tabCounts[t.key]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 sm:w-64">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by company..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="flex-shrink-0">
                  <X size={13} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#01503512' }}>
                <Inbox size={28} style={{ color: '#015035' }} />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No renewals found</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                {searchQuery
                  ? `No renewals match "${searchQuery}". Try a different search term.`
                  : activeTab === 'overdue'
                  ? 'No overdue renewals right now. Great job staying on top of things!'
                  : activeTab === 'renewed'
                  ? 'No renewals completed yet this period.'
                  : 'No renewals match the selected filter.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ color: '#015035' }}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-4">
              {filtered.map(r => (
                <div key={r.id} onClick={() => setSelected(r)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-gray-900">{r.company}</span>
                    <StatusBadge label={r.status} colorClass={renewalStatusColors[r.status]} />
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Service: <span className="text-gray-700">{r.serviceType}</span></div>
                    <div>Expires: <span className="text-gray-700">{formatDate(r.expirationDate)}</span></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table view */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/80">
                    <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                    <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Service</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Value</th>
                    <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Expiration</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Days Left</th>
                    <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Urgency</th>
                    <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Rep</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => setSelected(r)}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: r.daysUntilExpiry <= 0 ? '#dc2626'
                                : r.daysUntilExpiry <= 30 ? '#ef4444'
                                : r.daysUntilExpiry <= 60 ? '#f97316'
                                : '#22c55e'
                            }}
                          />
                          <p className="text-sm font-semibold text-gray-900">{r.company}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <StatusBadge label={r.serviceType} colorClass={serviceTypeColors[r.serviceType]} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge label={r.status} colorClass={renewalStatusColors[r.status]} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                          {formatCurrency(r.renewalValue)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-xs text-gray-500">{formatDate(r.expirationDate)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <DaysIndicator days={r.daysUntilExpiry} />
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell"><UrgencyBar days={r.daysUntilExpiry} /></td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-gray-400" />
                          <span className="text-sm text-gray-600">{r.assignedRep.split(' ')[0]}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        {r.status === 'Upcoming' && (
                          <button
                            onClick={() => startRenewal(r.id)}
                            className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            Start
                          </button>
                        )}
                        {r.status === 'In Progress' && (
                          <button
                            onClick={() => setRenewalProposalFor(r)}
                            className="text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md hover:bg-orange-100 transition-colors"
                          >
                            Propose
                          </button>
                        )}
                        {r.status === 'Renewed' && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle size={11} /> Done
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {filtered.length} renewal{filtered.length !== 1 ? 's' : ''}
                {activeTab !== 'all' || searchQuery ? ' matching filters' : ' total'}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Overdue / Critical</div>
                <div className="flex items-center gap-1 hidden sm:flex"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> 31-60d</div>
                <div className="flex items-center gap-1 hidden sm:flex"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 60d+</div>
              </div>
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#01503518' }}>
              <Bell size={16} style={{ color: '#015035' }} />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">Renewal Sequence</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Automatic notifications are sent to the assigned rep and client contact at these intervals:
          </p>
          <ul className="flex flex-col gap-2 mb-4">
            {[
              { label: '60 days before expiry', urgent: false },
              { label: '30 days before expiry', urgent: false },
              { label: '14 days before expiry', urgent: false },
              { label: '7 days before expiry (urgent)', urgent: true },
            ].map(item => (
              <li key={item.label} className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: item.urgent ? '#ef4444' : '#015035' }}
                />
                <span className={`text-xs ${item.urgent ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
            <Mail size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              Notifications go to the assigned rep (internal) and the primary contact on the account (external email)
            </p>
          </div>
        </div>

      </div>

      {selected && (
        <RenewalPanel
          renewal={selected}
          onClose={() => setSelected(null)}
          onStartRenewal={id => { startRenewal(id) }}
          onOpenProposal={r => { setSelected(null); setRenewalProposalFor(r) }}
          crmContacts={crmContacts}
          contracts={contracts}
          proposals={proposals}
        />
      )}
      {renewalProposalFor && (
        <RenewalProposalSidebar
          renewal={renewalProposalFor}
          onClose={() => setRenewalProposalFor(null)}
          onSave={renewalId => {
            setLocalRenewals(prev => prev.map(r => r.id === renewalId ? { ...r, status: 'In Progress' as const } : r))
            fetch(`/api/renewals/${renewalId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'In Progress' }) }).catch(() => toast('Failed to save renewal proposal', 'error'))
            setRenewalProposalFor(null)
          }}
          contracts={contracts}
        />
      )}
      {showLogRenewal && (
        <LogRenewalModal
          onClose={() => setShowLogRenewal(false)}
          onSave={logRenewal}
        />
      )}
    </>
  )
}
