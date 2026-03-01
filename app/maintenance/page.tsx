'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { maintenanceRecords, invoices, crmContacts, contracts } from '@/lib/data'
import { formatCurrency, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { MaintenanceRecord } from '@/lib/types'
import {
  X, RefreshCw, DollarSign, Calendar, AlertTriangle, CheckCircle,
  Building2, ChevronRight, Clock, FileText, Ban, CreditCard,
} from 'lucide-react'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  'Pending Cancellation': 'bg-red-100 text-red-600',
  Cancelled: 'bg-gray-100 text-gray-500',
}

// ─── Maintenance Detail Panel ──────────────────────────────────────────────

function MaintenancePanel({ record, onClose }: { record: MaintenanceRecord; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'invoices'>('overview')

  // Cross-linked data
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

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
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
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>

          {/* Key stats */}
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
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0">
          {(['overview', 'invoices'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">

              {/* Contract duration progress */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Duration</p>
                  <span className="text-xs font-bold text-gray-700">{pctElapsed}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pctElapsed}%`, background: isPendingCancel ? '#dc2626' : '#015035' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Start Date', value: formatDate(record.startDate) },
                    { label: 'End Date', value: formatDate(endDate.toISOString().split('T')[0]) },
                    { label: 'Duration', value: `${record.contractDuration} months` },
                    { label: 'Cancel Window', value: `${record.cancellationWindow} days notice` },
                  ].map(f => (
                    <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next billing */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Billing</p>
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 mb-2">
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
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>Annual contract value</span>
                  <span className="font-bold text-gray-800">{formatCurrency(annualValue)}</span>
                </div>
              </div>

              {/* Pending cancellation alert */}
              {isPendingCancel && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Ban size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Cancellation Requested</p>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        This client has initiated cancellation. {record.cancellationWindow}-day notice window applies.
                        Ensure final invoice is sent before service terminates.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary contact */}
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

              {/* Linked contract */}
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

          {/* ── Invoices ── */}
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
                        <p className={`text-base font-bold`} style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: isOverdue ? '#dc2626' : '#015035' }}>
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {isPendingCancel ? (
            <button className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2">
              <Ban size={14} /> Confirm Cancellation
            </button>
          ) : (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              Update Billing
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

const activeRecords = maintenanceRecords.filter(m => m.status === 'Active')
const totalMRR = activeRecords.reduce((s, m) => s + m.monthlyFee, 0)
const totalARR = totalMRR * 12

export default function MaintenancePage() {
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)

  return (
    <>
      <Header title="Maintenance" subtitle="Recurring services and monthly retainers" action={{ label: 'Add Record' }} />
      <div className="p-3 sm:p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Clients', value: activeRecords.length.toString(), icon: <CheckCircle size={16} />, color: '#22c55e' },
            { label: 'Monthly Recurring', value: formatCurrency(totalMRR), icon: <RefreshCw size={16} />, color: '#015035' },
            { label: 'Annual Recurring', value: formatCurrency(totalARR), icon: <DollarSign size={16} />, color: '#8b5cf6' },
            { label: 'Pending Cancel', value: maintenanceRecords.filter(m => m.status === 'Pending Cancellation').length.toString(), icon: <AlertTriangle size={16} />, color: '#ef4444' },
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
        <div className="metric-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Monthly Recurring Revenue Breakdown</h3>
            <span className="text-xs text-gray-400">Total: {formatCurrency(totalMRR)}/mo</span>
          </div>
          <div className="flex flex-col gap-3">
            {activeRecords.map(rec => (
              <div
                key={rec.id}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelected(rec)}
              >
                <div className="flex justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{rec.company}</span>
                    <StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} />
                  </div>
                  <span className="font-bold text-gray-900">{formatCurrency(rec.monthlyFee)}/mo</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${(rec.monthlyFee / totalMRR) * 100}%`, background: '#015035' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">All Maintenance Records</h3>
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
              {maintenanceRecords.map(rec => (
                <tr
                  key={rec.id}
                  onClick={() => setSelected(rec)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400 flex-shrink-0" />
                      <p className="text-sm font-semibold text-gray-900">{rec.company}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={rec.status} colorClass={statusColors[rec.status]} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(rec.monthlyFee)}
                    </span>
                    <span className="text-xs text-gray-400">/mo</span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-sm text-gray-600">{rec.contractDuration} months</span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-600 font-medium">{formatDate(rec.nextBillingDate)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className="text-xs text-gray-500">{rec.cancellationWindow} days</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {selected && <MaintenancePanel record={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
