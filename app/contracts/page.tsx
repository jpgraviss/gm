'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { contracts, invoices, projects, proposals } from '@/lib/data'
import { formatCurrency, contractStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Contract, ContractStatus } from '@/lib/types'
import {
  X, CheckCircle, Clock, AlertCircle, ScrollText, Calendar, DollarSign, User,
  ExternalLink, FileText, FolderKanban, Send, RefreshCw, Shield,
} from 'lucide-react'

const allStatuses: ContractStatus[] = [
  'Draft', 'Sent', 'Viewed', 'Signed by Client', 'Countersign Needed', 'Fully Executed', 'Expired',
]

function ContractPanel({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'project'>('overview')

  const linkedInvoices = invoices.filter(i => i.contractId === contract.id)
  const linkedProject = projects.find(p => p.contractId === contract.id)
  const linkedProposal = contract.proposalId ? proposals.find(p => p.id === contract.proposalId) : null

  const signedPercent =
    contract.status === 'Fully Executed' ? 100
    : contract.status === 'Countersign Needed' || contract.status === 'Signed by Client' ? 50
    : 0

  // Duration progress
  const startMs = new Date(contract.startDate).getTime()
  const renewalMs = new Date(contract.renewalDate).getTime()
  const nowMs = Date.now()
  const durationPct = Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (renewalMs - startMs)) * 100)))

  const invoicePaid = linkedInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const invoiceOutstanding = linkedInvoices.filter(i => ['Sent', 'Overdue', 'Pending'].includes(i.status)).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white"
        style={{ width: 440, height: '100vh' }}
      >
        {/* Dark green header */}
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white/50 text-[11px] mb-0.5">{contract.id.toUpperCase()} · Contract</p>
              <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {contract.company}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={16} className="text-white/60" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge label={contract.status} colorClass={contractStatusColors[contract.status]} />
            <StatusBadge label={contract.serviceType} colorClass={serviceTypeColors[contract.serviceType]} />
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex-shrink-0 grid grid-cols-3 border-b border-gray-100 divide-x divide-gray-100">
          {[
            { label: 'Contract Value', value: formatCurrency(contract.value) },
            { label: 'Paid', value: formatCurrency(invoicePaid) },
            { label: 'Outstanding', value: formatCurrency(invoiceOutstanding) },
          ].map((stat, i) => (
            <div key={i} className="p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">{stat.label}</p>
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-gray-100 px-4 pt-3 gap-5">
          {(['overview', 'invoices', 'project'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${
                activeTab === tab ? 'border-green-800 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'invoices' ? `Invoices (${linkedInvoices.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Key terms */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Contract Value', value: formatCurrency(contract.value), icon: <DollarSign size={11} /> },
                  { label: 'Billing Structure', value: contract.billingStructure, icon: <RefreshCw size={11} /> },
                  { label: 'Start Date', value: formatDate(contract.startDate), icon: <Calendar size={11} /> },
                  { label: 'Renewal Date', value: formatDate(contract.renewalDate), icon: <Calendar size={11} /> },
                  { label: 'Duration', value: `${contract.duration} months`, icon: <Clock size={11} /> },
                  { label: 'Assigned Rep', value: contract.assignedRep, icon: <User size={11} /> },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-1 text-gray-400 mb-1">
                      {item.icon}
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Duration progress bar */}
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Contract Progress</p>
                  <span className="text-xs font-bold text-gray-800">{durationPct}% through term</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${durationPct}%`, background: '#015035' }} />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{formatDate(contract.startDate)}</span>
                  <span>{formatDate(contract.renewalDate)}</span>
                </div>
              </div>

              {/* E-Signature flow */}
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">E-Signature Status</p>
                <div className="flex items-stretch gap-2">
                  {/* Client sig */}
                  <div className={`flex-1 p-3 rounded-xl border-2 ${contract.clientSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {contract.clientSigned
                        ? <CheckCircle size={13} className="text-emerald-500" />
                        : <Clock size={13} className="text-gray-300" />}
                      <span className="text-xs font-semibold text-gray-600">Client</span>
                    </div>
                    {contract.clientSigned
                      ? <p className="text-[11px] text-emerald-600">{formatDate(contract.clientSigned)}</p>
                      : <p className="text-[11px] text-gray-400">Pending</p>}
                  </div>

                  <div className="flex items-center text-gray-300 text-sm">→</div>

                  {/* Internal sig */}
                  <div className={`flex-1 p-3 rounded-xl border-2 ${contract.internalSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {contract.internalSigned
                        ? <CheckCircle size={13} className="text-emerald-500" />
                        : <Clock size={13} className="text-gray-300" />}
                      <span className="text-xs font-semibold text-gray-600">Internal</span>
                    </div>
                    {contract.internalSigned
                      ? <p className="text-[11px] text-emerald-600">{formatDate(contract.internalSigned)}</p>
                      : <p className="text-[11px] text-gray-400">Pending</p>}
                  </div>

                  <div className="flex items-center text-gray-300 text-sm">→</div>

                  {/* Final */}
                  <div className={`flex-1 p-3 rounded-xl border-2 ${contract.status === 'Fully Executed' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {contract.status === 'Fully Executed'
                        ? <Shield size={13} className="text-emerald-500" />
                        : <AlertCircle size={13} className="text-gray-300" />}
                      <span className="text-xs font-semibold text-gray-600">Executed</span>
                    </div>
                    {contract.status === 'Fully Executed'
                      ? <p className="text-[11px] text-emerald-600">Complete</p>
                      : <p className="text-[11px] text-gray-400">Awaiting</p>}
                  </div>
                </div>
              </div>

              {/* Linked proposal */}
              {linkedProposal && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Proposal</p>
                  <Link href="/proposals" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{linkedProposal.company}</p>
                      <p className="text-xs text-gray-500">{linkedProposal.id.toUpperCase()} · {linkedProposal.status} · {formatCurrency(linkedProposal.value)}</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              {linkedInvoices.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No invoices yet</p>
                  <p className="text-xs text-gray-300 mt-1">Create the first invoice for this contract</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {linkedInvoices.map(inv => {
                    const isOverdue = inv.status === 'Overdue'
                    const isPaid = inv.status === 'Paid'
                    return (
                      <div key={inv.id} className={`p-3 rounded-xl border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                            <p className="text-[11px] text-gray-500">Issued {formatDate(inv.issuedDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                            <StatusBadge label={inv.status} colorClass={
                              inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700'
                              : inv.status === 'Overdue' ? 'bg-red-100 text-red-700'
                              : inv.status === 'Sent' ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                            } />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Due: <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>{formatDate(inv.dueDate)}</span></span>
                          {inv.paidDate && <span className="text-emerald-600">Paid {formatDate(inv.paidDate)}</span>}
                          {!isPaid && (
                            <button className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                              {isOverdue ? 'Send Reminder' : inv.status === 'Pending' ? 'Send Invoice' : 'Mark Paid'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Summary */}
                  <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">Total Invoiced</span>
                      <span className="font-bold text-gray-800">{formatCurrency(linkedInvoices.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-emerald-600">Collected</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(invoicePaid)}</span>
                    </div>
                    {invoiceOutstanding > 0 && (
                      <div className="flex justify-between text-xs pt-1.5 border-t border-gray-100">
                        <span className="text-amber-600">Outstanding</span>
                        <span className="font-bold text-amber-700">{formatCurrency(invoiceOutstanding)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'project' && (
            <div>
              {!linkedProject ? (
                <div className="py-12 text-center">
                  <FolderKanban size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No project linked</p>
                  <p className="text-xs text-gray-300 mt-1">A project will appear here once created</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link href="/projects" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{linkedProject.company} — {linkedProject.serviceType}</p>
                      <p className="text-xs text-gray-500">{linkedProject.status} · Launch {formatDate(linkedProject.launchDate)}</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                  </Link>

                  {/* Progress */}
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Progress</span>
                      <span className="text-xs font-bold text-gray-800">{linkedProject.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${linkedProject.progress}%`, background: '#015035' }} />
                    </div>
                  </div>

                  {/* Milestones */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Milestones</p>
                    <div className="flex flex-col gap-1.5">
                      {linkedProject.milestones.map(m => (
                        <div key={m.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${m.completed ? '' : 'bg-gray-200'}`} style={m.completed ? { background: '#015035' } : {}}>
                            {m.completed && <CheckCircle size={10} className="text-white" />}
                          </div>
                          <span className={`text-xs flex-1 ${m.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.name}</span>
                          <span className="text-[10px] text-gray-400">{formatDate(m.dueDate)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Team</p>
                    <div className="flex flex-wrap gap-2">
                      {linkedProject.assignedTeam.map(name => (
                        <span key={name} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: '#015035' }}>
                            {name.split(' ').map(n => n[0]).join('')}
                          </div>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
          {contract.status === 'Countersign Needed' && (
            <button className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Countersign Now
            </button>
          )}
          {contract.status === 'Fully Executed' && (
            <button className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Generate Invoice
            </button>
          )}
          {contract.status === 'Draft' && (
            <button className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Send for Signature
            </button>
          )}
          <button className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Edit
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ContractsPage() {
  const [selected, setSelected] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? contracts : contracts.filter(c => c.status === statusFilter)

  const statusCounts = allStatuses.reduce((acc, s) => {
    acc[s] = contracts.filter(c => c.status === s).length
    return acc
  }, {} as Record<ContractStatus, number>)

  const activeValue = contracts.filter(c => c.status === 'Fully Executed').reduce((s, c) => s + c.value, 0)
  const pendingSig = contracts.filter(c => ['Sent', 'Viewed', 'Signed by Client', 'Countersign Needed'].includes(c.status)).length
  const mrr = invoices.filter(i => i.status !== 'Overdue').reduce((s, i) => s + (i.amount < 5000 ? i.amount : 0), 0)

  const metrics = [
    { label: 'Active Contracts', value: statusCounts['Fully Executed'].toString(), icon: <Shield size={16} />, color: '#22c55e', sub: 'Fully executed' },
    { label: 'Pending Signature', value: pendingSig.toString(), icon: <ScrollText size={16} />, color: '#f59e0b', sub: 'Awaiting sig' },
    { label: 'Total Contract Value', value: formatCurrency(contracts.reduce((s, c) => s + c.value, 0)), icon: <DollarSign size={16} />, color: '#015035', sub: 'All contracts' },
    { label: 'Executed Value', value: formatCurrency(activeValue), icon: <CheckCircle size={16} />, color: '#3b82f6', sub: 'Fully executed' },
  ]

  return (
    <>
      <Header title="Contracts" subtitle="Track agreements and e-signatures" action={{ label: 'New Contract' }} />
      <div className="p-6 flex-1">

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {metrics.map(m => (
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

        {/* Status summary tiles */}
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
          {allStatuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'All' : s)}
              className={`metric-card text-center p-3 transition-all ${statusFilter === s ? 'ring-2 ring-green-800' : ''}`}
            >
              <p className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                {statusCounts[s]}
              </p>
              <StatusBadge label={s} colorClass={contractStatusColors[s]} />
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setStatusFilter('All')} className={`tab-btn ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {allStatuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {filtered.length} contracts · {formatCurrency(filtered.reduce((s, c) => s + c.value, 0))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Value</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Billing</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Renewal</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Rep</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                    onClick={() => setSelected(c)}
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.company}</p>
                        <p className="text-xs text-gray-400">{c.id.toUpperCase()}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={c.serviceType} colorClass={serviceTypeColors[c.serviceType]} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                        {formatCurrency(c.value)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{c.billingStructure}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-500">{formatDate(c.renewalDate)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500">{c.assignedRep}</span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      {c.status === 'Countersign Needed' && (
                        <button className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100 transition-colors">
                          Sign Now
                        </button>
                      )}
                      {c.status === 'Fully Executed' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle size={12} /> Executed
                        </span>
                      )}
                      {c.status === 'Sent' && (
                        <span className="flex items-center gap-1 text-xs text-blue-500">
                          <Clock size={12} /> Awaiting
                        </span>
                      )}
                      {c.status === 'Draft' && (
                        <button className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
                          Send
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No contracts in this status</div>
          )}
        </div>
      </div>

      {selected && <ContractPanel contract={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
