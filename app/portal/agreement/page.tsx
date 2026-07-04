'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowLeft, FileText, Download, Calendar, DollarSign, Clock,
  CheckCircle, User,
} from 'lucide-react'

interface Contract {
  id: string
  company: string
  status: string
  value: number
  serviceType: string
  billingStructure: string
  startDate: string
  duration: number
  renewalDate: string
  clientSigned?: string
  internalSigned?: string
}

export default function PortalAgreementPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/contracts?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Contract[]) => {
        const active = (Array.isArray(data) ? data : []).find(
          c => ['Active', 'Signed by Client', 'Fully Executed'].includes(c.status)
        )
        setContract(active ?? data?.[0] ?? null)
      })
      .catch(() => toast('Failed to load agreement', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  function downloadPdf() {
    if (!contract) return
    const w = window.open('', '_blank', 'width=700,height=900')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Service Agreement - ${company}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Montserrat', Arial, sans-serif; color: #1a1a1a; padding: 48px; }
  .header { background: #012b1e; color: #fff; padding: 32px 40px; border-radius: 12px 12px 0 0; margin: -48px -48px 0; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .header p { font-size: 12px; opacity: 0.6; }
  .body { padding: 32px 0; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #015035; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .row:last-of-type { border-bottom: none; }
  .label { color: #6b7280; }
  .value { font-weight: 600; color: #111827; }
  .amount { font-size: 32px; font-weight: 800; color: #015035; text-align: center; padding: 24px 0 16px; }
  .signatures { display: flex; gap: 24px; margin-top: 24px; }
  .sig-box { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; }
  .sig-box .sig-label { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
  .sig-box .sig-status { font-size: 13px; font-weight: 600; }
  .sig-box .sig-date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 24px; } .header { margin: -24px -24px 0; } }
</style></head><body>
<div class="header">
  <h1>Service Agreement</h1>
  <p>${company} &middot; ${contract.id.toUpperCase()}</p>
</div>
<div class="body">
  <div class="amount">${formatCurrency(contract.value)}</div>
  <div class="section">
    <div class="section-title">Agreement Details</div>
    <div class="row"><span class="label">Company</span><span class="value">${company}</span></div>
    <div class="row"><span class="label">Service</span><span class="value">${contract.serviceType}</span></div>
    <div class="row"><span class="label">Status</span><span class="value">${contract.status}</span></div>
    <div class="row"><span class="label">Billing</span><span class="value">${contract.billingStructure}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Term</div>
    <div class="row"><span class="label">Start Date</span><span class="value">${contract.startDate || '---'}</span></div>
    <div class="row"><span class="label">Duration</span><span class="value">${contract.duration} months</span></div>
    <div class="row"><span class="label">Renewal Date</span><span class="value">${contract.renewalDate || '---'}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Signatures</div>
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">Client</div>
        <div class="sig-status" style="color: ${contract.clientSigned ? '#015035' : '#f59e0b'}">${contract.clientSigned ? 'Signed' : 'Pending'}</div>
        ${contract.clientSigned ? `<div class="sig-date">${contract.clientSigned}</div>` : ''}
      </div>
      <div class="sig-box">
        <div class="sig-label">Graviss Marketing</div>
        <div class="sig-status" style="color: ${contract.internalSigned ? '#015035' : '#f59e0b'}">${contract.internalSigned ? 'Signed' : 'Pending'}</div>
        ${contract.internalSigned ? `<div class="sig-date">${contract.internalSigned}</div>` : ''}
      </div>
    </div>
  </div>
</div>
<div class="footer">
  Generated by GravHub &middot; ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`)
    w.document.close()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
          <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
            <ArrowLeft size={14} /> Portal
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Service Agreement</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <FileText size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No active agreement found</p>
          <p className="text-xs text-gray-400 mt-1">Your agreement details will appear here once available.</p>
        </div>
      </div>
    )
  }

  const startMs = contract.startDate ? new Date(contract.startDate + 'T12:00:00').getTime() : 0
  const endMs = contract.renewalDate ? new Date(contract.renewalDate + 'T12:00:00').getTime() : 0
  const totalDays = endMs > startMs ? Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) : 0
  const daysRemaining = endMs > nowMs ? Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)) : 0
  const progressPct = totalDays > 0 ? Math.min(100, Math.max(0, ((totalDays - daysRemaining) / totalDays) * 100)) : 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Service Agreement</h1>
            <p className="text-xs text-gray-500 mt-0.5">{contract.serviceType} Agreement</p>
          </div>
          <button
            onClick={downloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#015035' }}
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-3xl mx-auto flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Agreement Value</p>
          <p className="text-3xl font-bold" style={{ color: '#015035', fontFamily: 'var(--font-syncopate), sans-serif' }}>
            {formatCurrency(contract.value)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{contract.billingStructure}</p>
        </div>

        {totalDays > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Agreement Term</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#e6f0ec', color: '#015035' }}>
                {daysRemaining} days remaining
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{ width: `${progressPct}%`, background: '#015035' }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{contract.startDate ? formatDate(contract.startDate) : '---'}</span>
              <span>{contract.renewalDate ? formatDate(contract.renewalDate) : '---'}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Contract Details</h3>
          <div className="flex flex-col gap-2 text-sm">
            {[
              { icon: FileText, label: 'Service', value: contract.serviceType },
              { icon: DollarSign, label: 'Billing', value: contract.billingStructure },
              { icon: Calendar, label: 'Start Date', value: contract.startDate ? formatDate(contract.startDate) : '---' },
              { icon: Clock, label: 'Duration', value: `${contract.duration} months` },
              { icon: Calendar, label: 'Renewal Date', value: contract.renewalDate ? formatDate(contract.renewalDate) : '---' },
            ].map(row => {
              const Icon = row.icon
              return (
                <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Icon size={14} />
                    <span>{row.label}</span>
                  </div>
                  <span className="font-semibold text-gray-800">{row.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Signatures</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-5 text-center">
              <User size={20} className="mx-auto mb-2 text-gray-400" />
              <p className="text-xs text-gray-500 mb-1">Client</p>
              {contract.clientSigned ? (
                <>
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                    <span className="text-sm font-semibold" style={{ color: '#015035' }}>Signed</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(contract.clientSigned)}</p>
                </>
              ) : (
                <span className="text-sm font-semibold text-amber-600">Pending</span>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl p-5 text-center">
              <div className="w-5 h-5 rounded mx-auto mb-2 flex items-center justify-center" style={{ background: '#015035' }}>
                <span className="text-white text-[10px] font-bold">GM</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">Graviss Marketing</p>
              {contract.internalSigned ? (
                <>
                  <div className="flex items-center justify-center gap-1.5">
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                    <span className="text-sm font-semibold" style={{ color: '#015035' }}>Signed</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(contract.internalSigned)}</p>
                </>
              ) : (
                <span className="text-sm font-semibold text-amber-600">Pending</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
