'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { renewals, crmContacts, contracts, proposals } from '@/lib/data'
import { formatCurrency, serviceTypeColors, renewalStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Renewal } from '@/lib/types'
import {
  X, AlertTriangle, Clock, CheckCircle, Calendar, DollarSign,
  ChevronRight, User, FileText, TrendingUp, Mail, Phone,
  RefreshCw, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

function UrgencyBar({ days }: { days: number }) {
  const pct = Math.max(0, Math.min(100, (days / 90) * 100))
  const color = days <= 14 ? '#ef4444' : days <= 30 ? '#f97316' : days <= 60 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${100 - pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {days <= 0 ? 'Expired!' : `${days}d`}
      </span>
    </div>
  )
}

const urgencyBand = (days: number) =>
  days <= 14 ? { label: 'Critical', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
  : days <= 30 ? { label: 'High', bg: '#fff7ed', color: '#f97316', border: '#fed7aa' }
  : days <= 60 ? { label: 'Medium', bg: '#fffbeb', color: '#d97706', border: '#fde68a' }
  : { label: 'Low', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }

// ─── Renewal Detail Panel ─────────────────────────────────────────────────────

function RenewalPanel({ renewal, onClose }: { renewal: Renewal; onClose: () => void }) {
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
      <div className="w-[480px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isRenewed ? '#015035' : band.color + '33' }}
              >
                <RefreshCw size={18} style={{ color: isRenewed ? '#fff' : band.color }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {renewal.company}
                </h2>
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

          {/* Stats */}
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

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0">
          {(['overview', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">

              {/* Urgency alert */}
              {!isRenewed && (
                <div className="p-4 rounded-xl border" style={{ background: band.bg, borderColor: band.border }}>
                  <div className="flex items-start gap-2.5">
                    {renewal.daysUntilExpiry <= 30
                      ? <AlertCircle size={16} style={{ color: band.color }} className="flex-shrink-0 mt-0.5" />
                      : <Clock size={16} style={{ color: band.color }} className="flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="text-sm font-semibold" style={{ color: band.color }}>
                        {isExpired ? 'Contract Expired' : `Expiring in ${renewal.daysUntilExpiry} days`}
                      </p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: band.color + 'cc' }}>
                        {renewal.daysUntilExpiry <= 14
                          ? 'Immediate action required. Send renewal proposal now.'
                          : renewal.daysUntilExpiry <= 30
                          ? 'Schedule a renewal call this week. Start the proposal process.'
                          : renewal.daysUntilExpiry <= 60
                          ? 'Reach out soon to start the renewal conversation.'
                          : 'On radar — contact 90 days before expiry.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key dates */}
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

              {/* Primary contact */}
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
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                      <Mail size={12} /> Email
                    </a>
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                      <Phone size={12} /> Call
                    </a>
                  </div>
                </div>
              )}

              {/* Original contract */}
              {contract && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original Contract</p>
                    <Link href="/contracts" className="text-xs text-blue-500 flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
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

          {/* ── History ── */}
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {isRenewed ? (
            <div className="flex-1 flex items-center gap-2 py-2.5 justify-center text-emerald-600 text-sm font-semibold">
              <CheckCircle size={16} /> Renewed
            </div>
          ) : renewal.status === 'In Progress' ? (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              Create Renewal Proposal
            </button>
          ) : (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
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

const metrics = {
  expiring30: renewals.filter(r => r.daysUntilExpiry <= 30 && r.status !== 'Renewed').length,
  expiring60: renewals.filter(r => r.daysUntilExpiry <= 60 && r.status !== 'Renewed').length,
  expiring90: renewals.filter(r => r.daysUntilExpiry <= 90 && r.status !== 'Renewed').length,
  renewalValue: renewals.filter(r => r.status !== 'Churned').reduce((s, r) => s + r.renewalValue, 0),
}

export default function RenewalsPage() {
  const [selected, setSelected] = useState<Renewal | null>(null)
  const sorted = [...renewals].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  return (
    <>
      <Header title="Renewals" subtitle="Forecast and manage contract renewals" action={{ label: 'Log Renewal' }} />
      <div className="p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Expiring in 30d', value: metrics.expiring30.toString(), icon: <AlertTriangle size={16} />, color: '#ef4444', sub: 'Immediate action' },
            { label: 'Expiring in 60d', value: metrics.expiring60.toString(), icon: <Clock size={16} />, color: '#f97316', sub: 'Schedule calls' },
            { label: 'Expiring in 90d', value: metrics.expiring90.toString(), icon: <Calendar size={16} />, color: '#f59e0b', sub: 'On radar' },
            { label: 'Renewal Pipeline', value: formatCurrency(metrics.renewalValue), icon: <DollarSign size={16} />, color: '#015035', sub: 'At-risk ARR' },
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

        {/* Renewal Timeline */}
        <div className="metric-card mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Renewal Forecast Timeline (Next 90 Days)</h3>
          <div className="relative">
            <div className="flex gap-0 h-8 rounded-xl overflow-hidden mb-4">
              {['0-30d', '31-60d', '61-90d'].map((label, i) => (
                <div
                  key={label}
                  className="flex-1 flex items-center justify-center text-xs font-semibold text-white"
                  style={{ background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#f59e0b', opacity: 0.85 }}
                >
                  {label}
                </div>
              ))}
              <div className="flex-1 flex items-center justify-center text-xs font-semibold text-gray-500 bg-gray-100">
                90d+
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {sorted.filter(r => r.daysUntilExpiry <= 90).map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="flex items-center gap-3 text-sm text-left hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors w-full"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: r.daysUntilExpiry <= 30 ? '#ef4444' : r.daysUntilExpiry <= 60 ? '#f97316' : '#f59e0b' }}
                  />
                  <span className="font-medium text-gray-800 w-36 truncate">{r.company}</span>
                  <StatusBadge label={r.serviceType} colorClass={serviceTypeColors[r.serviceType]} />
                  <span className="font-bold text-gray-700">{formatCurrency(r.renewalValue)}</span>
                  <span className="text-gray-400 text-xs ml-auto">{formatDate(r.expirationDate)}</span>
                  <UrgencyBar days={r.daysUntilExpiry} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Full Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-800">All Renewals</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> 0–30 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> 31–60 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> 61–90 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> 90+ days</div>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold">Value</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Expiration</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Urgency</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Rep</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-gray-900">{r.company}</p>
                  </td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <UrgencyBar days={r.daysUntilExpiry} />
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" />
                      <span className="text-sm text-gray-600">{r.assignedRep.split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    {r.status === 'Upcoming' && (
                      <button
                        onClick={() => setSelected(r)}
                        className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100"
                      >
                        Start Renewal
                      </button>
                    )}
                    {r.status === 'In Progress' && (
                      <button
                        onClick={() => setSelected(r)}
                        className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100"
                      >
                        Create Proposal
                      </button>
                    )}
                    {r.status === 'Renewed' && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={11} /> Renewed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <RenewalPanel renewal={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
