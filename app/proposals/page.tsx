'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { proposals as seedProposals, deals, contracts } from '@/lib/data'
import { formatCurrency, proposalStatusColors, serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import type { Proposal, ProposalStatus } from '@/lib/types'
import {
  Eye, Send, CheckCircle, XCircle, FileText, DollarSign, Calendar, User, X,
  Clock, ExternalLink, Mail, Phone, TrendingUp, AlertTriangle,
} from 'lucide-react'

const statusOrder: ProposalStatus[] = ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined']

const statusIcons: Record<ProposalStatus, React.ReactNode> = {
  Draft: <FileText size={13} />,
  Sent: <Send size={13} />,
  Viewed: <Eye size={13} />,
  Accepted: <CheckCircle size={13} />,
  Declined: <XCircle size={13} />,
}

function ProposalPanel({ proposal, onClose, onUpdateStatus }: { proposal: Proposal; onClose: () => void; onUpdateStatus: (id: string, status: ProposalStatus) => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'scope' | 'activity'>('overview')

  const deal = deals.find(d => d.id === proposal.dealId)
  const linkedContract = contracts.find(c => c.proposalId === proposal.id)

  const oneTime = proposal.items.filter(i => i.type === 'one-time')
  const recurring = proposal.items.filter(i => i.type === 'recurring')
  const oneTimeTotal = oneTime.reduce((s, i) => s + i.total, 0)
  const statusIdx = statusOrder.indexOf(proposal.status)

  const timeline = [
    { label: 'Created', date: proposal.createdDate, done: true },
    { label: 'Sent to Client', date: proposal.sentDate, done: !!proposal.sentDate },
    { label: 'Viewed by Client', date: proposal.viewedDate, done: !!proposal.viewedDate },
    { label: 'Response Received', date: proposal.respondedDate, done: !!proposal.respondedDate },
  ]

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
              <p className="text-white/50 text-[11px] mb-0.5">{proposal.id.toUpperCase()} · {proposal.serviceType}</p>
              <h2 className="text-white text-base font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {proposal.company}
              </h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={16} className="text-white/60" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge label={proposal.status} colorClass={proposalStatusColors[proposal.status]} />
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white/60 text-xs font-semibold">{formatCurrency(proposal.value)}</span>
          </div>
          {/* Status pipeline bar */}
          <div className="flex items-center gap-1">
            {statusOrder.map((s, i) => {
              const isCurrent = i === statusIdx
              const isPast = i < statusIdx
              const isDeclined = proposal.status === 'Declined' && s === 'Declined'
              return (
                <div key={s} className="flex-1 text-center">
                  <div className={`h-1 rounded-full ${
                    isDeclined ? 'bg-red-400'
                    : isPast || isCurrent ? 'bg-emerald-400'
                    : 'bg-white/15'
                  }`} />
                  <p className={`text-[8px] mt-0.5 font-semibold ${
                    isCurrent ? 'text-white' : isPast ? 'text-white/50' : 'text-white/25'
                  }`}>{s}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex-shrink-0 grid grid-cols-3 border-b border-gray-100 divide-x divide-gray-100">
          {[
            { label: 'Total Value', value: formatCurrency(proposal.value) },
            { label: 'One-Time', value: formatCurrency(oneTimeTotal) },
            { label: 'MRR', value: recurring.length > 0 ? formatCurrency(recurring[0].unitPrice) + '/mo' : '—' },
          ].map((stat, i) => (
            <div key={i} className="p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">{stat.label}</p>
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-gray-100 px-4 pt-3 gap-5">
          {(['overview', 'scope', 'activity'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab ? 'border-green-800 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'scope' ? 'Scope & Pricing' : 'Activity'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Sales Rep', value: proposal.assignedRep, icon: <User size={11} /> },
                  { label: 'Created', value: new Date(proposal.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), icon: <Calendar size={11} /> },
                  { label: 'Sent Date', value: proposal.sentDate ? new Date(proposal.sentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not sent yet', icon: <Send size={11} /> },
                  { label: 'Viewed Date', value: proposal.viewedDate ? new Date(proposal.viewedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—', icon: <Eye size={11} /> },
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

              {/* Viewed alert */}
              {proposal.status === 'Viewed' && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Client has viewed this proposal</p>
                    <p className="text-[11px] text-amber-600">Send a follow-up to close this deal</p>
                  </div>
                </div>
              )}

              {/* Linked deal */}
              {deal && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Deal</p>
                  <Link href="/crm/pipeline" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{deal.company}</p>
                      <p className="text-xs text-gray-500">{deal.stage} · {deal.assignedRep} · {deal.probability}% probability</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                  </Link>
                </div>
              )}

              {/* Primary contact */}
              {deal?.contact && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Contact</p>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{deal.contact.name}</p>
                    <p className="text-xs text-gray-500 mb-2">{deal.contact.title}</p>
                    <div className="flex flex-col gap-1">
                      <a href={`mailto:${deal.contact.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                        <Mail size={11} /> {deal.contact.email}
                      </a>
                      <a href={`tel:${deal.contact.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
                        <Phone size={11} /> {deal.contact.phone}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked contract */}
              {linkedContract && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Contract</p>
                  <Link href="/contracts" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{linkedContract.company}</p>
                      <p className="text-xs text-gray-500">{linkedContract.status} · {formatCurrency(linkedContract.value)}</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scope' && (
            <div className="flex flex-col gap-4">
              {oneTime.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">One-Time Services</p>
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
                          <th className="text-left p-2.5 font-semibold">Description</th>
                          <th className="text-right p-2.5 font-semibold">Qty</th>
                          <th className="text-right p-2.5 font-semibold">Unit</th>
                          <th className="text-right p-2.5 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oneTime.map(item => (
                          <tr key={item.id} className="border-t border-gray-50">
                            <td className="p-2.5 text-xs text-gray-800">{item.description}</td>
                            <td className="p-2.5 text-xs text-gray-600 text-right">{item.quantity}</td>
                            <td className="p-2.5 text-xs text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2.5 text-xs font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-200 bg-gray-50">
                          <td colSpan={3} className="p-2.5 text-[10px] font-semibold text-gray-500 text-right uppercase tracking-wide">Subtotal</td>
                          <td className="p-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(oneTimeTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {recurring.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Recurring Services</p>
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr className="text-[10px] text-gray-400 uppercase tracking-wide">
                          <th className="text-left p-2.5 font-semibold">Description</th>
                          <th className="text-right p-2.5 font-semibold">Months</th>
                          <th className="text-right p-2.5 font-semibold">/mo</th>
                          <th className="text-right p-2.5 font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurring.map(item => (
                          <tr key={item.id} className="border-t border-gray-50">
                            <td className="p-2.5 text-xs text-gray-800">{item.description}</td>
                            <td className="p-2.5 text-xs text-gray-600 text-right">{item.quantity}</td>
                            <td className="p-2.5 text-xs text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2.5 text-xs font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-200 bg-gray-50">
                          <td colSpan={3} className="p-2.5 text-[10px] font-semibold text-gray-500 text-right uppercase tracking-wide">MRR</td>
                          <td className="p-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(recurring[0]?.unitPrice || 0)}/mo</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Grand total */}
              <div className="p-4 rounded-xl flex items-center justify-between" style={{ background: '#012b1e' }}>
                <span className="text-white/70 text-xs font-semibold uppercase tracking-wide">Total Contract Value</span>
                <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-heading)' }}>
                  {formatCurrency(proposal.value)}
                </span>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Status Timeline</p>
              <div className="flex flex-col">
                {timeline.map((step, i) => (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: step.done ? '#015035' : '#f3f4f6' }}
                      >
                        {step.done
                          ? <CheckCircle size={11} className="text-white" />
                          : <Clock size={11} className="text-gray-400" />}
                      </div>
                      {i < timeline.length - 1 && (
                        <div
                          className="w-px flex-1 mt-1"
                          style={{ background: step.done ? '#015035' : '#e5e7eb', minHeight: 20 }}
                        />
                      )}
                    </div>
                    <div className="pb-1">
                      <p className={`text-xs font-semibold ${step.done ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</p>
                      {step.date
                        ? <p className="text-[11px] text-gray-500">{new Date(step.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        : <p className="text-[11px] text-gray-300">Pending</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
          {proposal.status === 'Draft' && (
            <button
              onClick={() => onUpdateStatus(proposal.id, 'Sent')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Send to Client
            </button>
          )}
          {proposal.status === 'Sent' && (
            <button
              onClick={() => onUpdateStatus(proposal.id, 'Viewed')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#3b82f6' }}
            >
              Mark as Viewed
            </button>
          )}
          {proposal.status === 'Viewed' && (
            <>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'Accepted')}
                className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                Mark Accepted
              </button>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'Declined')}
                className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#ef4444' }}
              >
                Mark Declined
              </button>
            </>
          )}
          {proposal.status === 'Accepted' && !linkedContract && (
            <Link
              href="/contracts"
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold text-center transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Go to Contracts →
            </Link>
          )}
          {proposal.status === 'Accepted' && linkedContract && (
            <Link href="/contracts" className="flex-1 py-2 rounded-xl text-white text-xs font-semibold text-center transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              View Contract
            </Link>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProposalsPage() {
  const [localProposals, setLocalProposals] = useState<Proposal[]>(seedProposals)
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'All'>('All')
  const [creatingProposal, setCreatingProposal] = useState(false)

  function updateProposalStatus(id: string, status: ProposalStatus) {
    const today = new Date().toISOString().split('T')[0]
    setLocalProposals(prev => prev.map(p => {
      if (p.id !== id) return p
      return {
        ...p,
        status,
        ...(status === 'Sent' ? { sentDate: today } : {}),
        ...(status === 'Viewed' ? { viewedDate: today } : {}),
        ...(['Accepted', 'Declined'].includes(status) ? { respondedDate: today } : {}),
      }
    }))
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev
      return {
        ...prev,
        status,
        ...(status === 'Sent' ? { sentDate: today } : {}),
        ...(status === 'Viewed' ? { viewedDate: today } : {}),
        ...(['Accepted', 'Declined'].includes(status) ? { respondedDate: today } : {}),
      }
    })
  }

  function handleNewProposal(data: NewProposalFormData) {
    const newProposal: Proposal = {
      id: `prop-${Date.now()}`,
      dealId: '',
      company: data.company,
      status: 'Draft',
      value: Number(data.value),
      serviceType: data.serviceType,
      assignedRep: data.assignedRep,
      createdDate: new Date().toISOString().split('T')[0],
      items: [],
    }
    setLocalProposals(prev => [newProposal, ...prev])
    setCreatingProposal(false)
  }

  const filtered = statusFilter === 'All' ? localProposals : localProposals.filter(p => p.status === statusFilter)

  const counts = statusOrder.reduce((acc, s) => {
    acc[s] = localProposals.filter(p => p.status === s).length
    return acc
  }, {} as Record<ProposalStatus, number>)

  const pipelineValue = localProposals
    .filter(p => !['Accepted', 'Declined'].includes(p.status))
    .reduce((s, p) => s + p.value, 0)

  const acceptedValue = localProposals
    .filter(p => p.status === 'Accepted')
    .reduce((s, p) => s + p.value, 0)

  const metrics = [
    { label: 'Total Proposals', value: localProposals.length.toString(), icon: <FileText size={16} />, color: '#6b7280', sub: 'All time' },
    { label: 'Open Pipeline', value: formatCurrency(pipelineValue), icon: <TrendingUp size={16} />, color: '#3b82f6', sub: 'Draft + Sent + Viewed' },
    { label: 'Accepted Value', value: formatCurrency(acceptedValue), icon: <CheckCircle size={16} />, color: '#22c55e', sub: 'Ready for contract' },
    { label: 'Needs Follow-Up', value: counts['Viewed'].toString(), icon: <AlertTriangle size={16} />, color: '#f59e0b', sub: 'Client has viewed' },
  ]

  return (
    <>
      <Header title="Proposals" subtitle="Manage quotes and scope of work" action={{ label: 'New Proposal', onClick: () => setCreatingProposal(true) }} />
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <button onClick={() => setStatusFilter('All')} className={`tab-btn ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {statusOrder.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`tab-btn ${statusFilter === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {filtered.length} proposals · {formatCurrency(filtered.reduce((s, p) => s + p.value, 0))}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Value</th>
                <th className="text-left py-2.5 px-4 font-semibold">Rep</th>
                <th className="text-left py-2.5 px-4 font-semibold">Created</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                  onClick={() => setSelected(p)}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.company}</p>
                      <p className="text-xs text-gray-400">{p.id.toUpperCase()}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={p.status} colorClass={proposalStatusColors[p.status]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={p.serviceType} colorClass={serviceTypeColors[p.serviceType]} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(p.value)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">{p.assignedRep}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-400">
                      {new Date(p.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {p.status === 'Draft' && (
                        <button
                          onClick={() => updateProposalStatus(p.id, 'Sent')}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                        >
                          Send
                        </button>
                      )}
                      {p.status === 'Sent' && (
                        <span className="text-xs text-gray-400">Awaiting view</span>
                      )}
                      {p.status === 'Viewed' && (
                        <button
                          onClick={() => updateProposalStatus(p.id, 'Accepted')}
                          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors"
                        >
                          Accept
                        </button>
                      )}
                      {p.status === 'Accepted' && (
                        <Link href="/contracts" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors">
                          Contract →
                        </Link>
                      )}
                      {p.status === 'Declined' && (
                        <span className="text-xs text-gray-400">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No proposals in this status</div>
          )}
        </div>
      </div>

      {selected && (
        <ProposalPanel
          proposal={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateProposalStatus}
        />
      )}
      {creatingProposal && (
        <NewProposalPanel onSave={handleNewProposal} onClose={() => setCreatingProposal(false)} />
      )}
    </>
  )
}
