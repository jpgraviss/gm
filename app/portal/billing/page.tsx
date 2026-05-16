'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, invoiceStatusColors } from '@/lib/utils'
import {
  ArrowLeft, FileText, Download, DollarSign, AlertTriangle, CheckCircle,
} from 'lucide-react'

interface Invoice {
  id: string
  contractId: string
  company: string
  amount: number
  status: string
  dueDate: string
  issuedDate: string
  paidDate?: string
  serviceType: string
}

export default function PortalBillingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { setLoading(false); return }
    fetch(`/api/invoices?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: Invoice[]) => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => toast('Failed to load invoices', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + i.amount, 0), [invoices])
  const totalPaid = useMemo(() => invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0), [invoices])
  const totalOutstanding = useMemo(() => invoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + i.amount, 0), [invoices])

  function downloadInvoice(inv: Invoice) {
    const w = window.open('', '_blank', 'width=600,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.id.toUpperCase()}</title><style>body{font-family:'Montserrat',Arial,sans-serif;margin:40px;color:#1a1a1a}
.header{background:#012b1e;color:#fff;padding:28px 32px;border-radius:10px 10px 0 0}.header h1{margin:0 0 4px;font-size:20px}.header p{margin:0;font-size:12px;opacity:.6}
.body{border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:28px 32px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
.row:last-of-type{border-bottom:none}.label{color:#6b7280}.value{font-weight:600;color:#111827}.amount{font-size:28px;font-weight:800;color:#015035;text-align:center;padding:20px 0 10px}
.badge{text-align:center;margin:16px 0 0}.badge span{display:inline-block;border:4px solid ${inv.status === 'Paid' ? '#015035' : '#f59e0b'};color:${inv.status === 'Paid' ? '#015035' : '#f59e0b'};font-size:28px;font-weight:900;letter-spacing:.2em;padding:6px 24px;border-radius:6px;transform:rotate(-8deg);opacity:.85}
@media print{body{margin:0}}</style></head><body>
<div class="header"><h1>GravHub Invoice</h1><p>${inv.id.toUpperCase()}</p></div>
<div class="body"><div class="amount">$${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
<div class="row"><span class="label">Company</span><span class="value">${company}</span></div>
<div class="row"><span class="label">Service</span><span class="value">${inv.serviceType}</span></div>
<div class="row"><span class="label">Status</span><span class="value">${inv.status}</span></div>
<div class="row"><span class="label">Issued</span><span class="value">${inv.issuedDate ?? '—'}</span></div>
<div class="row"><span class="label">Due Date</span><span class="value">${inv.dueDate ?? '—'}</span></div>
${inv.paidDate ? `<div class="row"><span class="label">Paid Date</span><span class="value">${inv.paidDate}</span></div>` : ''}
<div class="badge"><span>${inv.status === 'Paid' ? 'PAID' : inv.status.toUpperCase()}</span></div></div>
<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`)
    w.document.close()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Invoices & Billing</h1>
        <p className="text-xs text-gray-500 mt-0.5">View invoices and payment history</p>
      </div>
      <div className="p-4 sm:p-8 max-w-4xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e6f0ec' }}>
                <DollarSign size={14} style={{ color: '#015035' }} />
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Invoiced</p>
            </div>
            <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
              {formatCurrency(totalInvoiced)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                <CheckCircle size={14} className="text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Paid</p>
            </div>
            <p className="text-xl font-bold text-emerald-700" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
                <AlertTriangle size={14} className="text-orange-500" />
              </div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-orange-600" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">All Invoices</h3>
          </div>
          {invoices.length > 0 ? (
            <div className="flex flex-col divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                    <p className="text-xs text-gray-400">
                      Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}
                      {inv.serviceType ? ` · ${inv.serviceType}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                    <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status] ?? 'bg-gray-100 text-gray-600'} />
                    <button
                      onClick={() => downloadInvoice(inv)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
                      title="Download PDF"
                    >
                      <Download size={13} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <FileText size={24} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No invoices yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
