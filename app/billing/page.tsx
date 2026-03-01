'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { invoices as seedInvoices, contracts, revenueByMonth } from '@/lib/data'
import { formatCurrency, invoiceStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import NewInvoicePanel, { type NewInvoiceFormData } from '@/components/crm/NewInvoicePanel'
import type { Invoice, InvoiceStatus } from '@/lib/types'
import {
  DollarSign, AlertCircle, CheckCircle, Clock, Send, RefreshCw,
  X, ExternalLink, ScrollText, Calendar, Zap, ArrowDownToLine,
  RotateCcw, Link2,
} from 'lucide-react'

const statuses: InvoiceStatus[] = ['Pending', 'Sent', 'Overdue', 'Paid']

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  Pending: <Clock size={14} className="text-gray-400" />,
  Sent: <Send size={14} className="text-blue-500" />,
  Overdue: <AlertCircle size={14} className="text-red-500" />,
  Paid: <CheckCircle size={14} className="text-emerald-500" />,
}

function InvoicePanel({ invoice, onClose, onUpdateStatus }: { invoice: Invoice; onClose: () => void; onUpdateStatus: (id: string, status: InvoiceStatus) => void }) {
  const linkedContract = contracts.find(c => c.id === invoice.contractId)
  const relatedInvoices = seedInvoices.filter(i => i.contractId === invoice.contractId && i.id !== invoice.id)
  const isOverdue = invoice.status === 'Overdue'
  const isPaid = invoice.status === 'Paid'

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white"
        style={{ width: 'min(400px, 100vw)', height: '100vh' }}
      >
        {/* Dark green header */}
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white/50 text-[11px] mb-0.5">{invoice.id.toUpperCase()}</p>
              <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {invoice.company}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={16} className="text-white/60" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge label={invoice.status} colorClass={invoiceStatusColors[invoice.status]} />
            <StatusBadge label={invoice.serviceType} colorClass={serviceTypeColors[invoice.serviceType]} />
          </div>
        </div>

        {/* Amount highlight */}
        <div className="flex-shrink-0 p-5 border-b border-gray-100 text-center">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Invoice Amount</p>
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: isOverdue ? '#ef4444' : '#015035' }}>
            {formatCurrency(invoice.amount)}
          </p>
          {isOverdue && (
            <p className="text-xs text-red-500 mt-1 font-medium">Payment overdue since {formatDate(invoice.dueDate)}</p>
          )}
          {isPaid && invoice.paidDate && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">Paid on {formatDate(invoice.paidDate)}</p>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {/* Date grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Issued Date', value: formatDate(invoice.issuedDate), icon: <Calendar size={11} /> },
                { label: 'Due Date', value: formatDate(invoice.dueDate), icon: <Calendar size={11} />, alert: isOverdue },
                { label: 'Paid Date', value: invoice.paidDate ? formatDate(invoice.paidDate) : '—', icon: <CheckCircle size={11} /> },
                { label: 'Service', value: invoice.serviceType, icon: <ScrollText size={11} /> },
              ].map((item, i) => (
                <div key={i} className={`p-3 rounded-xl ${item.alert ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                  <div className={`flex items-center gap-1 mb-1 ${item.alert ? 'text-red-400' : 'text-gray-400'}`}>
                    {item.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
                  </div>
                  <p className={`text-xs font-semibold ${item.alert ? 'text-red-700' : 'text-gray-800'}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Linked contract */}
            {linkedContract && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Contract</p>
                <Link href="/contracts" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{linkedContract.company}</p>
                    <p className="text-xs text-gray-500">{linkedContract.status} · {linkedContract.billingStructure}</p>
                    <p className="text-xs text-gray-400">Renewal: {formatDate(linkedContract.renewalDate)}</p>
                  </div>
                  <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                </Link>
              </div>
            )}

            {/* Other invoices for same contract */}
            {relatedInvoices.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Other Invoices — Same Contract</p>
                <div className="flex flex-col gap-1.5">
                  {relatedInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{inv.id.toUpperCase()}</p>
                        <p className="text-[11px] text-gray-400">Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">{formatCurrency(inv.amount)}</span>
                        <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
          {invoice.status === 'Pending' && (
            <button
              onClick={() => onUpdateStatus(invoice.id, 'Sent')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Send Invoice
            </button>
          )}
          {invoice.status === 'Sent' && (
            <button
              onClick={() => onUpdateStatus(invoice.id, 'Paid')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Mark as Paid
            </button>
          )}
          {invoice.status === 'Overdue' && (
            <button
              onClick={() => onUpdateStatus(invoice.id, 'Sent')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#ef4444' }}
            >
              Send Reminder
            </button>
          )}
          {invoice.status === 'Paid' && (
            <button className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Download Receipt
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const [localInvoices, setLocalInvoices] = useState<Invoice[]>(seedInvoices)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState(false)

  function updateInvoiceStatus(id: string, status: InvoiceStatus) {
    const today = new Date().toISOString().split('T')[0]
    setLocalInvoices(prev => prev.map(i => {
      if (i.id !== id) return i
      return { ...i, status, ...(status === 'Paid' ? { paidDate: today } : {}) }
    }))
    setSelectedInvoice(prev => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, status, ...(status === 'Paid' ? { paidDate: today } : {}) }
    })
  }

  function handleNewInvoice(data: NewInvoiceFormData) {
    const today = new Date().toISOString().split('T')[0]
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      contractId: data.contractId || `ct-standalone-${Date.now()}`,
      company: data.company,
      amount: Number(data.amount),
      status: 'Pending',
      dueDate: data.dueDate,
      issuedDate: today,
      serviceType: data.serviceType,
    }
    setLocalInvoices(prev => [newInvoice, ...prev])
    setCreatingInvoice(false)
  }

  const filtered = statusFilter === 'All' ? localInvoices : localInvoices.filter(i => i.status === statusFilter)
  const maxRevenue = Math.max(...revenueByMonth.map(r => r.revenue))

  const metrics = {
    awaitingInvoice: contracts.filter(c => c.status === 'Fully Executed').length,
    sent: localInvoices.filter(i => i.status === 'Sent').length,
    overdue: localInvoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
    collected: localInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
    outstanding: localInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
    mrr: 3417,
  }

  // Revenue by service breakdown (computed from invoices)
  const serviceBreakdown = [
    { service: 'Website', amount: localInvoices.filter(i => i.serviceType === 'Website' && i.status === 'Paid').reduce((s, i) => s + i.amount, 0) },
    { service: 'SEO', amount: localInvoices.filter(i => i.serviceType === 'SEO' && i.status === 'Paid').reduce((s, i) => s + i.amount, 0) },
    { service: 'Email Marketing', amount: localInvoices.filter(i => i.serviceType === 'Email Marketing' && i.status === 'Paid').reduce((s, i) => s + i.amount, 0) },
  ].filter(s => s.amount > 0)
  const maxService = Math.max(...serviceBreakdown.map(s => s.amount))

  return (
    <>
      <Header title="Billing & Revenue" subtitle="Invoices, payments, and revenue tracking" action={{ label: 'Create Invoice', onClick: () => setCreatingInvoice(true) }} />
      <div className="p-3 sm:p-6 flex-1">

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Awaiting Invoice', value: metrics.awaitingInvoice.toString(), icon: <Clock size={16} />, color: '#6b7280', sub: 'Executed contracts' },
            { label: 'Invoices Sent', value: metrics.sent.toString(), icon: <Send size={16} />, color: '#3b82f6', sub: 'Pending payment' },
            { label: 'Overdue Amount', value: formatCurrency(metrics.overdue), icon: <AlertCircle size={16} />, color: '#ef4444', sub: 'Needs attention' },
            { label: 'Revenue Collected', value: formatCurrency(metrics.collected), icon: <CheckCircle size={16} />, color: '#22c55e', sub: 'All time' },
            { label: 'Outstanding', value: formatCurrency(metrics.outstanding), icon: <DollarSign size={16} />, color: '#f59e0b', sub: 'Sent + overdue' },
            { label: 'MRR', value: formatCurrency(metrics.mrr), icon: <RefreshCw size={16} />, color: '#8b5cf6', sub: 'Recurring monthly' },
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

        {/* Revenue Chart + Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Stacked bar chart */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">Revenue by Month</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: '#015035' }} />
                  One-time
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: '#FFF3EA', border: '1px solid #e5c9b2' }} />
                  Recurring
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3 h-36">
              {revenueByMonth.map(d => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col">
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: `${((d.revenue - d.recurring) / maxRevenue) * 120}px`, background: '#015035' }}
                    />
                    <div
                      className="w-full rounded-b-sm"
                      style={{ height: `${(d.recurring / maxRevenue) * 120}px`, background: '#FFF3EA', border: '1px solid #e5c9b2', borderTop: 'none' }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
              <span>Feb total: <strong className="text-gray-800">{formatCurrency(revenueByMonth[revenueByMonth.length - 1].revenue)}</strong></span>
              <span>MoM growth: <strong className="text-emerald-600">+47%</strong></span>
            </div>
          </div>

          {/* Revenue by service */}
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Revenue Collected by Service</h3>
            <div className="flex flex-col gap-3">
              {serviceBreakdown.map(s => (
                <div key={s.service}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{s.service}</span>
                    <span className="text-gray-800 font-bold">{formatCurrency(s.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.round((s.amount / maxService) * 100)}%`, background: '#015035' }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between">
                <span className="text-xs text-gray-500">Total Collected</span>
                <span className="text-sm font-bold" style={{ color: '#015035' }}>{formatCurrency(metrics.collected)}</span>
              </div>
            </div>

            {/* QuickBooks mini status */}
            <div className="mt-4 p-2.5 bg-gray-50 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                <div>
                  <p className="text-[11px] font-semibold text-gray-700">QuickBooks Online</p>
                  <p className="text-[10px] text-gray-400">Last pull: 2 hours ago</p>
                </div>
              </div>
              <button
                onClick={() => {}}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <RotateCcw size={10} /> Sync
              </button>
            </div>
          </div>
        </div>

        {/* QuickBooks Integration Banner */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#2CA01C18' }}>
                <Link2 size={16} style={{ color: '#2CA01C' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">QuickBooks Online Integration</p>
                <p className="text-xs text-gray-500">Billing data pulled directly from your QuickBooks account</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-700">Connected</span>
              </div>
              <button className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <ArrowDownToLine size={12} /> Pull Latest Data
              </button>
              <button className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Settings
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            {[
              { label: 'QB Customers Synced', value: '8', icon: <Zap size={13} className="text-green-600" />, note: 'Matched to CRM' },
              { label: 'Last Pull', value: '2h ago', icon: <RotateCcw size={13} className="text-blue-500" />, note: 'Auto-syncs every 6h' },
              { label: 'Unmatched Invoices', value: '0', icon: <CheckCircle size={13} className="text-emerald-500" />, note: 'All reconciled' },
              { label: 'QB Account', value: 'gravissmarketing', icon: <Link2 size={13} className="text-gray-400" />, note: 'quickbooks.com' },
            ].map(item => (
              <div key={item.label} className="px-5 py-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  {item.icon}
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{item.label}</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{item.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
            <p className="text-xs text-blue-700">
              <strong>Read-only integration:</strong> Invoice creation and payment status flow from QuickBooks into GravHub. Full accounting features remain in QuickBooks.
            </p>
            <a
              href="https://quickbooks.intuit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 flex-shrink-0 ml-4"
            >
              Open QuickBooks <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0">
              <button onClick={() => setStatusFilter('All')} className={`tab-btn flex-shrink-0 ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {statuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}>
                  <span className="flex items-center gap-1.5">
                    {statusIcons[s]} {s}
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {filtered.length} · {formatCurrency(filtered.reduce((s, i) => s + i.amount, 0))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Service</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Amount</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Issued</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Due</th>
                  <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Paid</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inv.company}</p>
                        <p className="text-xs text-gray-400">{inv.id.toUpperCase()}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <StatusBadge label={inv.serviceType} colorClass={serviceTypeColors[inv.serviceType]} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                        {formatCurrency(inv.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(inv.issuedDate)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium ${inv.status === 'Overdue' ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatDate(inv.dueDate)}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {inv.paidDate
                        ? <span className="text-xs text-emerald-600">{formatDate(inv.paidDate)}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        {inv.status === 'Pending' && (
                          <button
                            onClick={() => updateInvoiceStatus(inv.id, 'Sent')}
                            className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                          >Send</button>
                        )}
                        {inv.status === 'Sent' && (
                          <button
                            onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                            className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
                          >Mark Paid</button>
                        )}
                        {inv.status === 'Overdue' && (
                          <button
                            onClick={() => updateInvoiceStatus(inv.id, 'Sent')}
                            className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100 transition-colors"
                          >Send Reminder</button>
                        )}
                        {inv.status === 'Paid' && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle size={11} /> Collected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">No invoices in this status</div>
            )}
          </div>
        </div>
      </div>

      {selectedInvoice && (
        <InvoicePanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onUpdateStatus={updateInvoiceStatus}
        />
      )}
      {creatingInvoice && (
        <NewInvoicePanel onSave={handleNewInvoice} onClose={() => setCreatingInvoice(false)} />
      )}
    </>
  )
}
