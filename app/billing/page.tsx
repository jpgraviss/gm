'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchContracts, fetchRevenueByMonth } from '@/lib/supabase'
import { formatCurrency, invoiceStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Invoice, InvoiceStatus, Contract, RevenueMonth } from '@/lib/types'
import {
  DollarSign, AlertCircle, CheckCircle, Clock, Send, RefreshCw,
  X, ExternalLink, ScrollText, Calendar, Zap, ArrowDownToLine,
  RotateCcw, Link2, Info,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const statuses: InvoiceStatus[] = ['Pending', 'Sent', 'Overdue', 'Paid', 'Cancelled']

const statusIcons: Record<InvoiceStatus, React.ReactNode> = {
  Pending: <Clock size={14} className="text-gray-400" />,
  Sent: <Send size={14} className="text-blue-500" />,
  Overdue: <AlertCircle size={14} className="text-red-500" />,
  Paid: <CheckCircle size={14} className="text-emerald-500" />,
  Cancelled: <X size={14} className="text-orange-500" />,
}

function downloadReceipt(invoice: Invoice) {
  const w = window.open('', '_blank', 'width=600,height=700')
  if (!w) return
  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt — ${invoice.id.toUpperCase()}</title>
      <style>
        body { font-family: 'Montserrat', Arial, sans-serif; margin: 40px; color: #1a1a1a; background: #fff; }
        .header { background: #012b1e; color: #fff; padding: 28px 32px; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 0.04em; }
        .header p { margin: 0; font-size: 12px; opacity: 0.6; }
        .body { border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 28px 32px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        .row:last-of-type { border-bottom: none; }
        .label { color: #6b7280; }
        .value { font-weight: 600; color: #111827; }
        .amount { font-size: 28px; font-weight: 800; color: #015035; text-align: center; padding: 20px 0 10px; }
        .stamp { text-align: center; margin: 16px 0 0; }
        .stamp span { display: inline-block; border: 4px solid #015035; color: #015035; font-size: 28px; font-weight: 900; letter-spacing: 0.2em; padding: 6px 24px; border-radius: 6px; transform: rotate(-8deg); opacity: 0.85; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GravHub Receipt</h1>
        <p>${invoice.id.toUpperCase()}</p>
      </div>
      <div class="body">
        <div class="amount">$${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        <div class="row"><span class="label">Company</span><span class="value">${invoice.company}</span></div>
        <div class="row"><span class="label">Service Type</span><span class="value">${invoice.serviceType}</span></div>
        <div class="row"><span class="label">Issued Date</span><span class="value">${invoice.issuedDate}</span></div>
        <div class="row"><span class="label">Paid Date</span><span class="value">${invoice.paidDate ?? '—'}</span></div>
        <div class="row"><span class="label">Invoice ID</span><span class="value">${invoice.id.toUpperCase()}</span></div>
        <div class="stamp"><span>PAID</span></div>
      </div>
      <script>window.onload = function() { window.print(); window.close(); }<\/script>
    </body>
    </html>
  `)
  w.document.close()
}

function InvoicePanel({ invoice, onClose, contracts, allInvoices }: { invoice: Invoice; onClose: () => void; contracts: Contract[]; allInvoices: Invoice[] }) {
  const linkedContract = contracts.find(c => c.id === invoice.contractId)
  const relatedInvoices = allInvoices.filter(i => i.contractId === invoice.contractId && i.id !== invoice.id)
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

        {/* Footer — view only, all changes happen in QuickBooks */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex flex-col gap-2">
          <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg">
            <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700">Invoice data is read-only — all changes are managed in QuickBooks Online.</p>
          </div>
          <div className="flex gap-2">
            {invoice.status === 'Paid' && (
              <button onClick={() => downloadReceipt(invoice)} className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
                Download Receipt
              </button>
            )}
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const { toast } = useToast()
  const [localInvoices, setLocalInvoices] = useState<Invoice[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonth[]>([])
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Billable time summary (view-only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [billableSummary, setBillableSummary] = useState<any[]>([])
  const [showBillable, setShowBillable] = useState(false)

  // QuickBooks
  const [qbConnected, setQbConnected]     = useState(false)
  const [qbStatus, setQbStatus]           = useState<{ lastSync: string | null; invoicesSynced: number; paymentsSynced: number } | null>(null)
  const [qbSyncing, setQbSyncing]         = useState(false)
  const [loading, setLoading] = useState(true)

  // Handle QB callback params
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('qb_connected') === 'true') {
      toast('QuickBooks connected successfully!', 'success')
      fetchQBStatus()
      window.history.replaceState({}, '', '/billing')
    }
    if (searchParams.get('qb_error')) {
      const err = searchParams.get('qb_error')
      toast(`QuickBooks connection failed: ${err}`, 'error')
      window.history.replaceState({}, '', '/billing')
    }
  }, [searchParams])

  function fetchQBStatus() {
    fetch('/api/quickbooks/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.connected) {
          setQbConnected(true)
          setQbStatus({ lastSync: d.lastSync, invoicesSynced: d.invoicesSynced, paymentsSynced: d.paymentsSynced })
        } else {
          setQbConnected(false)
          setQbStatus(null)
        }
      })
      .catch(() => toast('Failed to load QuickBooks status', 'error'))
  }

  async function handleQBSync() {
    setQbSyncing(true)
    try {
      const res  = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        fetchQBStatus()
        // Refresh invoices after sync
        fetch('/api/invoices').then(r => r.json()).then(d => { if (Array.isArray(d)) setLocalInvoices(d) }).catch(() => toast('Failed to load invoices', 'error'))
      }
    } catch { toast('QuickBooks sync failed', 'error') } finally {
      setQbSyncing(false)
    }
  }

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLocalInvoices(data) })
      .catch(() => toast('Failed to load invoices', 'error'))
      .finally(() => setLoading(false))
    fetchContracts().then(d => { if (Array.isArray(d)) setContracts(d) }).catch(() => {})
    fetchRevenueByMonth().then(d => { if (Array.isArray(d)) setRevenueByMonth(d) }).catch(() => {})
    fetchQBStatus()
    fetch('/api/time-entries/billable-summary').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setBillableSummary(d) }).catch(() => toast('Failed to load billable time summary', 'error'))
  }, [])

  const filtered = statusFilter === 'All' ? localInvoices : localInvoices.filter(i => i.status === statusFilter)
  const maxRevenue = Math.max(1, ...revenueByMonth.map(r => r.revenue || 0))

  const metrics = {
    awaitingInvoice: contracts.filter(c => c.status === 'Fully Executed').length,
    sent: localInvoices.filter(i => i.status === 'Sent').length,
    overdue: localInvoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.amount, 0),
    collected: localInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
    outstanding: localInvoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
    mrr: contracts
      .filter(c => ['Fully Executed', 'Active'].includes(c.status) && c.duration > 0)
      .reduce((sum, c) => sum + c.value / c.duration, 0),
  }

  // Revenue by service breakdown (computed from invoices — all service types)
  const paidInvoices = localInvoices.filter(i => i.status === 'Paid')
  const serviceMap = new Map<string, number>()
  for (const inv of paidInvoices) {
    serviceMap.set(inv.serviceType, (serviceMap.get(inv.serviceType) ?? 0) + inv.amount)
  }
  const serviceBreakdown = Array.from(serviceMap.entries())
    .map(([service, amount]) => ({ service, amount }))
    .filter(s => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  const maxService = Math.max(1, ...serviceBreakdown.map(s => s.amount || 0))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Billing & Revenue" subtitle="View-only · Invoice data synced from QuickBooks Online" />
      <div className="page-content">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Awaiting Invoice',  value: metrics.awaitingInvoice.toString(), icon: <Clock size={16} />,      color: '#6b7280', sub: 'Executed contracts' },
            { label: 'Invoices Sent',     value: metrics.sent.toString(),            icon: <Send size={16} />,        color: '#3b82f6', sub: 'Pending payment' },
            { label: 'Overdue Amount',    value: formatCurrency(metrics.overdue),    icon: <AlertCircle size={16} />, color: '#ef4444', sub: 'Needs attention' },
            { label: 'Revenue Collected', value: formatCurrency(metrics.collected),  icon: <CheckCircle size={16} />, color: '#22c55e', sub: 'All time' },
            { label: 'Outstanding',       value: formatCurrency(metrics.outstanding),icon: <DollarSign size={16} />,  color: '#f59e0b', sub: 'Sent + overdue' },
            { label: 'MRR',              value: formatCurrency(metrics.mrr),        icon: <RefreshCw size={16} />,   color: '#8b5cf6', sub: 'Recurring monthly' },
          ].map(m => (
            <div key={m.label} className="kpi-card" style={{ '--kpi-accent': m.color } as React.CSSProperties}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${m.color}15` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.label}</p>
              <p className="text-[11px] text-gray-400 mt-1">{m.sub}</p>
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
                      style={{ height: `${(((d.revenue || 0) - (d.recurring || 0)) / maxRevenue) * 120}px`, background: '#015035' }}
                    />
                    <div
                      className="w-full rounded-b-sm"
                      style={{ height: `${((d.recurring || 0) / maxRevenue) * 120}px`, background: '#FFF3EA', border: '1px solid #e5c9b2', borderTop: 'none' }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">{d.month}</span>
                </div>
              ))}
            </div>
            {revenueByMonth.length > 0 && (() => {
              const latest = revenueByMonth[revenueByMonth.length - 1]
              const prev = revenueByMonth.length >= 2 ? revenueByMonth[revenueByMonth.length - 2] : null
              const momGrowth = prev && prev.revenue > 0 ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : null
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>{latest.month} total: <strong className="text-gray-800">{formatCurrency(latest.revenue)}</strong></span>
                  {momGrowth !== null && (
                    <span>MoM growth: <strong className={momGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}>{momGrowth >= 0 ? '+' : ''}{Math.round(momGrowth)}%</strong></span>
                  )}
                </div>
              )
            })()}
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
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${qbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-[11px] font-semibold text-gray-700">QuickBooks Online</p>
                  <p className="text-[10px] text-gray-400">
                    {qbConnected
                      ? qbStatus?.lastSync ? `Last pull: ${new Date(qbStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connected'
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              {qbConnected && (
                <button
                  onClick={handleQBSync}
                  disabled={qbSyncing}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={10} className={qbSyncing ? 'animate-spin' : ''} /> {qbSyncing ? 'Syncing…' : 'Sync'}
                </button>
              )}
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
                <p className="text-xs text-gray-500">
                  {qbConnected ? 'Billing data pulled directly from your QuickBooks account' : 'Connect QuickBooks to sync invoices and payments'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {qbConnected ? (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-emerald-700">Connected</span>
                  </div>
                  <button
                    onClick={handleQBSync}
                    disabled={qbSyncing}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <ArrowDownToLine size={12} /> {qbSyncing ? 'Pulling…' : 'Pull Latest Data'}
                  </button>
                  <a href="/settings?tab=Billing" className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    Settings
                  </a>
                </>
              ) : (
                <a href="/api/quickbooks/connect" className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors hover:opacity-90" style={{ background: '#015035' }}>
                  Connect QuickBooks
                </a>
              )}
            </div>
          </div>
          {qbConnected ? (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
              {[
                { label: 'Invoices Synced', value: String(qbStatus?.invoicesSynced ?? 0), icon: <Zap size={13} className="text-green-600" />, note: 'From QuickBooks' },
                { label: 'Last Pull', value: qbStatus?.lastSync ? new Date(qbStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', icon: <RotateCcw size={13} className="text-blue-500" />, note: 'Most recent sync' },
                { label: 'Payments Synced', value: String(qbStatus?.paymentsSynced ?? 0), icon: <CheckCircle size={13} className="text-emerald-500" />, note: 'Status updated' },
                { label: 'QB Account', value: 'GravHub App', icon: <Link2 size={13} className="text-gray-400" />, note: 'quickbooks.com' },
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
          ) : (
            <div className="px-5 py-4 text-xs text-gray-400">
              <a href="/api/quickbooks/connect" className="text-emerald-700 font-semibold hover:underline">Connect QuickBooks</a> to enable automatic invoice and payment sync.
            </div>
          )}
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

        {/* Unbilled Time Entries */}
        {billableSummary.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800">Unbilled Time</h3>
                <span className="text-xs text-gray-400 ml-1">{billableSummary.reduce((s, g) => s + g.entryCount, 0)} entries</span>
              </div>
              <button
                onClick={() => setShowBillable(!showBillable)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {showBillable ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {showBillable && (
              <div className="divide-y divide-gray-100">
                {billableSummary.map(group => (
                  <div key={group.projectName} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{group.projectName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {group.totalHours}h {group.totalMinutes}m · {group.entryCount} {group.entryCount === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 px-2.5 py-1 rounded-full bg-amber-50">
                      Not yet invoiced in QB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invoice Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0">
              <button onClick={() => setStatusFilter('All')} className={`filter-pill flex-shrink-0 ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {statuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`filter-pill flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}>
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
          contracts={contracts}
          allInvoices={localInvoices}
        />
      )}
    </>
  )
}
