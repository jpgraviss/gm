'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { fetchCrmContacts, fetchContracts, fetchInvoices } from '@/lib/supabase'
import { formatCurrency, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { MaintenanceRecord, MaintenanceStatus, CRMContact, Contract, Invoice } from '@/lib/types'
import {
  X, RefreshCw, DollarSign, Calendar, AlertTriangle, CheckCircle,
  Building2, ChevronRight, ChevronLeft, Clock, FileText, Ban, CreditCard,
  Plus, Upload, Paperclip, Trash2, Edit2,
} from 'lucide-react'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Onboarding: 'bg-blue-100 text-blue-700',
  'Pending Cancellation': 'bg-red-100 text-red-600',
  Cancelled: 'bg-gray-100 text-gray-500',
  Past: 'bg-gray-100 text-gray-400',
}

type TabFilter = 'All' | 'Active' | 'Onboarding' | 'Pending Cancellation' | 'Past' | 'Cancelled'

// ─── Add/Edit Record Panel ─────────────────────────────────────────────────────

function AddRecordPanel({
  initial,
  onSave,
  onClose,
}: {
  initial?: MaintenanceRecord
  onSave: (r: Omit<MaintenanceRecord, 'id'>) => void
  onClose: () => void
}) {
  const [crmCompanies, setCrmCompanies] = useState<string[]>([])
  const defaultEnd = initial?.endDate ?? (() => {
    const d = new Date(initial?.startDate ?? new Date())
    d.setMonth(d.getMonth() + (initial?.contractDuration ?? 12))
    return d.toISOString().split('T')[0]
  })()

  const [form, setForm] = useState({
    company: initial?.company ?? '',
    serviceType: initial?.serviceType ?? 'Website',
    startDate: initial?.startDate ?? new Date().toISOString().split('T')[0],
    endDate: defaultEnd,
    monthlyFee: initial?.monthlyFee?.toString() ?? '350',
    cancellationWindow: initial?.cancellationWindow?.toString() ?? '30',
    cancellationFeeOverride: initial?.cancellationFee?.toString() ?? '',
    paymentTerms: initial?.paymentTerms ?? 'Net 30',
    status: initial?.status ?? ('Active' as MaintenanceStatus),
    nextBillingDate: initial?.nextBillingDate ?? new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetch('/api/crm/companies').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCrmCompanies(d.map((c: { name: string }) => c.name))
    }).catch(() => {})
  }, [])

  // Auto-calculate duration in months from start → end dates
  const autoMonths = useMemo(() => {
    const s = new Date(form.startDate)
    const e = new Date(form.endDate)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return 0
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  }, [form.startDate, form.endDate])

  // Default cancellation fee = 3x monthly
  const defaultCancellationFee = (parseFloat(form.monthlyFee) || 0) * 3
  const cancellationFee = form.cancellationFeeOverride ? parseFloat(form.cancellationFeeOverride) : defaultCancellationFee

  function save() {
    if (!form.company) return
    onSave({
      company: form.company,
      serviceType: form.serviceType as MaintenanceRecord['serviceType'],
      startDate: form.startDate,
      endDate: form.endDate,
      monthlyFee: parseFloat(form.monthlyFee) || 0,
      contractDuration: autoMonths,
      cancellationWindow: parseInt(form.cancellationWindow) || 30,
      cancellationFee,
      paymentTerms: form.paymentTerms,
      status: form.status,
      nextBillingDate: form.nextBillingDate,
      documents: initial?.documents ?? [],
    })
  }

  const serviceTypes = ['Website', 'SEO', 'Social Media', 'Email Marketing', 'Branding', 'Custom', 'General']
  const statuses: MaintenanceStatus[] = ['Active', 'Onboarding', 'Pending Cancellation', 'Cancelled', 'Past']
  const paymentTermOptions = ['Net 30', 'End of service', 'End of 30 days', 'Due on receipt', 'Net 15', 'Custom']

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(440px, 100vw)' }}>
        <div className="p-5 flex-shrink-0 border-b border-gray-100 flex items-center justify-between" style={{ background: '#012b1e' }}>
          <h2 className="text-white text-base font-bold">{initial ? 'Edit Record' : 'Add Maintenance Record'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/60" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Company — from CRM */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company *</label>
            <select value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              <option value="">— Select a company —</option>
              {crmCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
              <select value={form.serviceType} onChange={e => setForm(p => ({ ...p, serviceType: e.target.value as MaintenanceRecord['serviceType'] }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
                {serviceTypes.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as MaintenanceStatus }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Contract dates + auto-calculated duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
          </div>
          {autoMonths > 0 && (
            <p className="text-xs text-gray-400 -mt-2">
              Contract duration: <span className="font-semibold text-gray-700">{autoMonths} months</span> (auto-calculated)
            </p>
          )}

          {/* Monthly fee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monthly Fee ($)</label>
            <input type="number" value={form.monthlyFee} onChange={e => setForm(p => ({ ...p, monthlyFee: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" placeholder="350" />
          </div>

          {/* Cancellation */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col gap-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Cancellation Terms</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notice Window (days)</label>
                <input type="number" value={form.cancellationWindow} onChange={e => setForm(p => ({ ...p, cancellationWindow: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white" placeholder="30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Cancellation Fee ($)
                </label>
                <input type="number" value={form.cancellationFeeOverride} onChange={e => setForm(p => ({ ...p, cancellationFeeOverride: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white"
                  placeholder={`${defaultCancellationFee.toFixed(2)} (3× monthly)`} />
              </div>
            </div>
            <p className="text-[11px] text-amber-700">
              Default fee: <strong>${defaultCancellationFee.toFixed(2)}</strong> (3× monthly rate). Leave blank to use default, or enter a custom amount per contract terms.
            </p>
          </div>

          {/* Payment terms */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment Terms</label>
            <select value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              {paymentTermOptions.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Next billing date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next Billing Date</label>
            <input type="date" value={form.nextBillingDate} onChange={e => setForm(p => ({ ...p, nextBillingDate: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={save}
            disabled={!form.company}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            {initial ? 'Save Changes' : 'Add Record'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Maintenance Detail Panel ──────────────────────────────────────────────

function MaintenancePanel({
  record,
  onClose,
  onConfirmCancellation,
  onUpdateBilling,
  onEdit,
  crmContacts,
  contracts,
  invoices,
}: {
  record: MaintenanceRecord
  onClose: () => void
  onConfirmCancellation: (id: string) => void
  onUpdateBilling: (id: string, fee: number, nextDate: string) => void
  onEdit: (record: MaintenanceRecord) => void
  crmContacts: CRMContact[]
  contracts: Contract[]
  invoices: Invoice[]
}) {
  const [tab, setTab] = useState<'overview' | 'invoices' | 'documents'>('overview')
  const [showBillingEdit, setShowBillingEdit] = useState(false)
  const [newFee, setNewFee] = useState(record.monthlyFee.toString())
  const [newBillingDate, setNewBillingDate] = useState(record.nextBillingDate)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [documents, setDocuments] = useState(record.documents ?? [])
  const fileRef = useRef<HTMLInputElement>(null)

  const contact = crmContacts.find(c => c.companyName === record.company && c.isPrimary)
  const contract = contracts.find(c => c.company === record.company && c.serviceType === record.serviceType)
  const relatedInvoices = invoices.filter(i => i.company === record.company)

  const startDate = new Date(record.startDate)
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + record.contractDuration)
  const today = new Date()
  const totalMs = endDate.getTime() - startDate.getTime()
  const elapsedMs = today.getTime() - startDate.getTime()
  const pctElapsed = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
  const monthsRemaining = Math.max(0, Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)))
  const annualValue = record.monthlyFee * 12
  const isPendingCancel = record.status === 'Pending Cancellation'

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setDocuments(prev => [...prev, {
        id: `doc-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedDate: new Date().toISOString().split('T')[0],
        dataUrl: ev.target?.result as string,
      }])
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: isPendingCancel ? '#dc2626' : '#015035' }}>
                <RefreshCw size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {record.company}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge label={record.serviceType} colorClass={serviceTypeColors[record.serviceType]} />
                  <StatusBadge label={record.status} colorClass={statusColors[record.status]} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(record)} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Edit record">
                <Edit2 size={14} className="text-white/60" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
                <X size={18} className="text-white/60" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Monthly Fee', value: formatCurrency(record.monthlyFee) },
              { label: 'Annual Value', value: formatCurrency(annualValue) },
              { label: 'Months Left', value: `${monthsRemaining}mo` },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-xs font-bold">{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'invoices', 'documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Duration</p>
                  <span className="text-xs font-bold text-gray-700">{pctElapsed}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pctElapsed}%`, background: isPendingCancel ? '#dc2626' : '#015035' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Start Date', value: formatDate(record.startDate) },
                    { label: 'End Date', value: record.endDate ? formatDate(record.endDate) : formatDate(endDate.toISOString().split('T')[0]) },
                    { label: 'Duration', value: `${record.contractDuration} months` },
                    { label: 'Cancel Window', value: `${record.cancellationWindow} days notice` },
                    { label: 'Cancel Fee', value: record.cancellationFee ? formatCurrency(record.cancellationFee) : formatCurrency(record.monthlyFee * 3) },
                    { label: 'Payment Terms', value: record.paymentTerms ?? 'Net 30' },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Billing</p>
                  <button onClick={() => setShowBillingEdit(!showBillingEdit)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Edit2 size={11} /> Update
                  </button>
                </div>
                {showBillingEdit ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Monthly Fee</label>
                        <input type="number" value={newFee} onChange={e => setNewFee(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 uppercase tracking-wide mb-1">Next Billing Date</label>
                        <input type="date" value={newBillingDate} onChange={e => setNewBillingDate(e.target.value)}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => { onUpdateBilling(record.id, parseFloat(newFee) || record.monthlyFee, newBillingDate); setShowBillingEdit(false) }}
                        className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg"
                        style={{ background: '#015035' }}
                      >
                        Save Billing
                      </button>
                      <button onClick={() => setShowBillingEdit(false)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Next Billing Date</p>
                        <p className="text-sm font-semibold text-gray-900">{formatDate(record.nextBillingDate)}</p>
                      </div>
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}>
                      {formatCurrency(record.monthlyFee)}
                    </p>
                  </div>
                )}
              </div>

              {isPendingCancel && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Ban size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">Cancellation Requested</p>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        This client has initiated cancellation. {record.cancellationWindow}-day notice window applies.
                      </p>
                      {!showCancelConfirm && (
                        <button onClick={() => setShowCancelConfirm(true)} className="mt-2 text-xs text-red-600 underline">
                          Confirm final cancellation
                        </button>
                      )}
                      {showCancelConfirm && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => { onConfirmCancellation(record.id); setShowCancelConfirm(false); onClose() }}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                          >
                            Yes, Cancel Contract
                          </button>
                          <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                            Keep Active
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {contact && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Contact</p>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{contact.fullName}</p>
                      <p className="text-xs text-gray-500">{contact.title}</p>
                    </div>
                    <Link href="/crm/contacts" className="text-xs text-blue-500 hover:underline flex-shrink-0 flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                </div>
              )}

              {contract && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Contract</p>
                    <Link href="/contracts" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{contract.billingStructure}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(contract.value)} total</p>
                      </div>
                    </div>
                    <StatusBadge label={contract.status} colorClass="bg-green-100 text-green-700" />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'invoices' && (
            <div className="flex flex-col gap-3">
              {relatedInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No invoices found for this company.</p>
                </div>
              ) : (
                relatedInvoices.map(inv => {
                  const isOverdue = inv.status === 'Overdue'
                  return (
                    <div key={inv.id} className={`p-4 rounded-xl border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-gray-900">{inv.id.toUpperCase()}</p>
                        <p className="text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: isOverdue ? '#dc2626' : '#015035' }}>
                          {formatCurrency(inv.amount)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`status-badge ${inv.status === 'Paid' ? 'bg-green-100 text-green-700' : inv.status === 'Overdue' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'}`}>
                          {inv.status}
                        </span>
                        <span className="text-xs text-gray-400">{inv.dueDate ? `Due ${formatDate(inv.dueDate)}` : 'No due date'}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <Link href="/billing" className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2">
                View all in Billing <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {tab === 'documents' && (
            <div className="flex flex-col gap-3">
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors"
              >
                <Upload size={16} /> Upload Document (PDF, Word, Image)
              </button>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <Paperclip size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No documents attached yet.</p>
                </div>
              ) : (
                documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-400">{Math.round(doc.size / 1024)} KB · {formatDate(doc.uploadedDate)}</p>
                    </div>
                    <a href={doc.dataUrl} download={doc.name} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                      <FileText size={14} />
                    </a>
                    <button onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {isPendingCancel ? (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <Ban size={14} /> Confirm Cancellation
            </button>
          ) : record.status === 'Active' || record.status === 'Onboarding' ? (
            <button
              onClick={() => setShowBillingEdit(true)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#015035' }}
            >
              <DollarSign size={14} /> Update Billing
            </button>
          ) : (
            <button
              onClick={() => onEdit(record)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              Edit Record
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

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)
  const [addingRecord, setAddingRecord] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null)
  const [tabFilter, setTabFilter] = useState<TabFilter>('All')
  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    fetch('/api/maintenance')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data) })
      .catch(() => {})
    fetchCrmContacts().then(setCrmContacts)
    fetchContracts().then(setContracts)
    fetchInvoices().then(setInvoices)
  }, [])

  const activeRecords = records.filter(m => m.status === 'Active')
  const totalMRR = activeRecords.reduce((s, m) => s + m.monthlyFee, 0)
  const totalARR = totalMRR * 12

  const tabCounts: Record<TabFilter, number> = {
    All: records.length,
    Active: records.filter(r => r.status === 'Active').length,
    Onboarding: records.filter(r => r.status === 'Onboarding').length,
    'Pending Cancellation': records.filter(r => r.status === 'Pending Cancellation').length,
    Past: records.filter(r => r.status === 'Past').length,
    Cancelled: records.filter(r => r.status === 'Cancelled').length,
  }

  const filtered = tabFilter === 'All' ? records : records.filter(r => r.status === tabFilter)

  async function handleAddRecord(data: Omit<MaintenanceRecord, 'id'>) {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const saved = await res.json()
      if (res.ok && saved.id) {
        setRecords(prev => [saved, ...prev])
      } else {
        // API error — persist locally with a temp id so the user can see the record
        setRecords(prev => [{ ...data, id: `mr-${Date.now()}`, documents: data.documents ?? [] }, ...prev])
      }
    } catch {
      setRecords(prev => [{ ...data, id: `mr-${Date.now()}`, documents: data.documents ?? [] }, ...prev])
    }
    setAddingRecord(false)
  }

  function handleEditRecord(data: Omit<MaintenanceRecord, 'id'>) {
    if (!editingRecord) return
    setRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...r, ...data } : r))
    fetch(`/api/maintenance/${editingRecord.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
    setEditingRecord(null)
    setSelected(null)
  }

  function confirmCancellation(id: string) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'Cancelled' } : r))
    fetch(`/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' }),
    }).catch(() => {})
    setSelected(null)
  }

  function updateBilling(id: string, fee: number, nextDate: string) {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, monthlyFee: fee, nextBillingDate: nextDate } : r))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, monthlyFee: fee, nextBillingDate: nextDate } : prev)
    fetch(`/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFee: fee, nextBillingDate: nextDate }),
    }).catch(() => {})
  }

  return (
    <>
      <Header
        title="Maintenance"
        subtitle="Recurring services and monthly retainers"
        action={{ label: 'Add Record', onClick: () => setAddingRecord(true) }}
      />
      <div className="p-3 sm:p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Clients', value: activeRecords.length.toString(), icon: <CheckCircle size={16} />, color: '#22c55e' },
            { label: 'Monthly Recurring', value: formatCurrency(totalMRR), icon: <RefreshCw size={16} />, color: '#015035' },
            { label: 'Annual Recurring', value: formatCurrency(totalARR), icon: <DollarSign size={16} />, color: '#8b5cf6' },
            { label: 'Pending Cancel', value: tabCounts['Pending Cancellation'].toString(), icon: <AlertTriangle size={16} />, color: '#ef4444' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{m.label}</p>
            </div>
          ))}
        </div>

        {/* MRR Breakdown */}
        {activeRecords.length > 0 && (
          <div className="metric-card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Monthly Recurring Revenue Breakdown</h3>
              <span className="text-xs text-gray-400">Total: {formatCurrency(totalMRR)}/mo</span>
            </div>
            <div className="flex flex-col gap-3">
              {activeRecords.map(rec => (
                <div key={rec.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelected(rec)}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{rec.company}</span>
                      <StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} />
                    </div>
                    <span className="font-bold text-gray-900">{formatCurrency(rec.monthlyFee)}/mo</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${(rec.monthlyFee / totalMRR) * 100}%`, background: '#015035' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Records Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Status filter tabs */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 overflow-x-auto">
            {(['All', 'Active', 'Onboarding', 'Pending Cancellation', 'Past', 'Cancelled'] as TabFilter[]).map(t => (
              <button
                key={t}
                onClick={() => setTabFilter(t)}
                className={`filter-pill flex-shrink-0 ${tabFilter === t ? 'active' : ''}`}
              >
                {t} <span className="ml-1 opacity-60">{tabCounts[t]}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Monthly Fee</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Duration</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Next Billing</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Cancel Window</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No records in this category</td></tr>
                ) : filtered.map(rec => (
                  <tr key={rec.id} onClick={() => setSelected(rec)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-900">{rec.company}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4"><StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} /></td>
                    <td className="py-3 px-4"><StatusBadge label={rec.status} colorClass={statusColors[rec.status] ?? 'bg-gray-100 text-gray-500'} /></td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                        {formatCurrency(rec.monthlyFee)}
                      </span>
                      <span className="text-xs text-gray-400">/mo</span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell"><span className="text-sm text-gray-600">{rec.contractDuration} months</span></td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-600 font-medium">{formatDate(rec.nextBillingDate)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell"><span className="text-xs text-gray-500">{rec.cancellationWindow} days</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <MaintenancePanel
          record={selected}
          onClose={() => setSelected(null)}
          onConfirmCancellation={confirmCancellation}
          onUpdateBilling={updateBilling}
          onEdit={r => { setSelected(null); setEditingRecord(r) }}
          crmContacts={crmContacts}
          contracts={contracts}
          invoices={invoices}
        />
      )}
      {addingRecord && <AddRecordPanel onSave={handleAddRecord} onClose={() => setAddingRecord(false)} />}
      {editingRecord && <AddRecordPanel initial={editingRecord} onSave={handleEditRecord} onClose={() => setEditingRecord(null)} />}
    </>
  )
}
