'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { invoices, contracts, revenueByMonth } from '@/lib/data'
import { formatCurrency, invoiceStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Invoice, InvoiceStatus } from '@/lib/types'
import { DollarSign, AlertCircle, CheckCircle, Clock, Send, TrendingUp, RefreshCw } from 'lucide-react'

const statuses: InvoiceStatus[] = ['Pending', 'Sent', 'Overdue', 'Paid']

const metrics = {
  awaitingInvoice: contracts.filter(c => c.status === 'Fully Executed').length,
  sent: invoices.filter(i => i.status === 'Sent').length,
  overdue: invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
  collected: invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
  outstanding: invoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
  mrr: 3417,
}

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  Pending: <Clock size={14} className="text-gray-400" />,
  Sent: <Send size={14} className="text-blue-500" />,
  Overdue: <AlertCircle size={14} className="text-red-500" />,
  Paid: <CheckCircle size={14} className="text-emerald-500" />,
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{invoice.company}</p>
          <p className="text-xs text-gray-400">{invoice.id.toUpperCase()}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={invoice.status} colorClass={invoiceStatusColors[invoice.status]} />
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={invoice.serviceType} colorClass={serviceTypeColors[invoice.serviceType]} />
      </td>
      <td className="py-3 px-4">
        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
          {formatCurrency(invoice.amount)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-500">{formatDate(invoice.issuedDate)}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium ${invoice.status === 'Overdue' ? 'text-red-600' : 'text-gray-500'}`}>
          {formatDate(invoice.dueDate)}
        </span>
      </td>
      <td className="py-3 px-4">
        {invoice.paidDate
          ? <span className="text-xs text-emerald-600">{formatDate(invoice.paidDate)}</span>
          : <span className="text-xs text-gray-300">—</span>}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1.5">
          {invoice.status === 'Pending' && (
            <button className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100">Send</button>
          )}
          {invoice.status === 'Sent' && (
            <button className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100">Mark Paid</button>
          )}
          {invoice.status === 'Overdue' && (
            <button className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md hover:bg-red-100">Send Reminder</button>
          )}
          {invoice.status === 'Paid' && (
            <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Collected</span>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? invoices : invoices.filter(i => i.status === statusFilter)
  const maxRevenue = Math.max(...revenueByMonth.map(r => r.revenue))

  return (
    <>
      <Header title="Billing & Revenue" subtitle="Invoices, payments, and revenue tracking" action={{ label: 'Create Invoice' }} />
      <div className="p-6 flex-1">

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
          {/* Chart */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">Revenue Collected by Month</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#015035' }} /> One-time</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#FFF3EA', border: '1px solid #e5c9b2' }} /> Recurring</div>
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
          </div>

          {/* Breakdown by service */}
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Revenue by Service</h3>
            <div className="flex flex-col gap-3">
              {[
                { service: 'Website', amount: 37500, pct: 65 },
                { service: 'SEO', amount: 10000, pct: 35 },
                { service: 'Email Marketing', amount: 3200, pct: 18 },
              ].map(s => (
                <div key={s.service}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{s.service}</span>
                    <span className="text-gray-800 font-bold">{formatCurrency(s.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${s.pct}%`, background: '#015035' }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 flex justify-between">
                <span className="text-xs text-gray-500">Total Collected</span>
                <span className="text-sm font-bold" style={{ color: '#015035' }}>{formatCurrency(metrics.collected)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button onClick={() => setStatusFilter('All')} className={`tab-btn ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {statuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>
                  <span className="flex items-center gap-1.5">
                    {statusIcons[s]} {s}
                  </span>
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {filtered.length} invoices · {formatCurrency(filtered.reduce((s, i) => s + i.amount, 0))}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Amount</th>
                <th className="text-left py-2.5 px-4 font-semibold">Issued</th>
                <th className="text-left py-2.5 px-4 font-semibold">Due</th>
                <th className="text-left py-2.5 px-4 font-semibold">Paid</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => <InvoiceRow key={i.id} invoice={i} />)}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No invoices in this status</div>
          )}
        </div>
      </div>
    </>
  )
}
