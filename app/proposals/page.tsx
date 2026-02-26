'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { proposals } from '@/lib/data'
import { formatCurrency, proposalStatusColors, serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Proposal, ProposalStatus } from '@/lib/types'
import { Eye, Send, CheckCircle, XCircle, FileText, DollarSign, Calendar, User, X, Plus } from 'lucide-react'

const statusOrder: ProposalStatus[] = ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined']

const statusIcons: Record<ProposalStatus, React.ReactNode> = {
  Draft: <FileText size={13} />,
  Sent: <Send size={13} />,
  Viewed: <Eye size={13} />,
  Accepted: <CheckCircle size={13} />,
  Declined: <XCircle size={13} />,
}

function ProposalRow({ proposal, onClick }: { proposal: Proposal; onClick: () => void }) {
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
      onClick={onClick}
    >
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{proposal.company}</p>
          <p className="text-xs text-gray-400">{proposal.id.toUpperCase()}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={proposal.status} colorClass={proposalStatusColors[proposal.status]} />
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={proposal.serviceType} colorClass={serviceTypeColors[proposal.serviceType]} />
      </td>
      <td className="py-3 px-4">
        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
          {formatCurrency(proposal.value)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-600">{proposal.assignedRep}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-400">
          {new Date(proposal.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5">
          {proposal.status === 'Draft' && (
            <button className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors">
              Send
            </button>
          )}
          {proposal.status === 'Sent' && (
            <span className="text-xs text-gray-400">Awaiting view</span>
          )}
          {proposal.status === 'Viewed' && (
            <span className="text-xs text-orange-500 font-medium">Follow up!</span>
          )}
          {proposal.status === 'Accepted' && (
            <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-50 transition-colors">
              Create Contract
            </button>
          )}
          {proposal.status === 'Declined' && (
            <span className="text-xs text-gray-400">Closed</span>
          )}
        </div>
      </td>
    </tr>
  )
}

function ProposalDetail({ proposal, onClose }: { proposal: Proposal; onClose: () => void }) {
  const oneTime = proposal.items.filter(i => i.type === 'one-time')
  const recurring = proposal.items.filter(i => i.type === 'recurring')
  const oneTimeTotal = oneTime.reduce((s, i) => s + i.total, 0)
  const recurringTotal = recurring.reduce((s, i) => s + i.total, 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <p className="text-white/60 text-xs mb-1">{proposal.id.toUpperCase()} · {proposal.serviceType}</p>
            <h2
              className="text-white text-lg font-bold"
              style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
            >
              {proposal.company}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge label={proposal.status} colorClass={proposalStatusColors[proposal.status]} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: <DollarSign size={14} />, label: 'Total Value', value: formatCurrency(proposal.value) },
              { icon: <User size={14} />, label: 'Sales Rep', value: proposal.assignedRep },
              { icon: <Calendar size={14} />, label: 'Created', value: new Date(proposal.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                  {item.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{item.label}</span>
                </div>
                <p className="text-sm font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Line Items */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Scope of Work & Pricing</p>

            {oneTime.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-800 inline-block" />
                  One-Time Services
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left pb-2 font-semibold">Description</th>
                      <th className="text-right pb-2 font-semibold">Qty</th>
                      <th className="text-right pb-2 font-semibold">Unit</th>
                      <th className="text-right pb-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oneTime.map(item => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2 text-sm text-gray-800">{item.description}</td>
                        <td className="py-2 text-sm text-gray-600 text-right">{item.quantity}</td>
                        <td className="py-2 text-sm text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="py-2 text-xs font-semibold text-gray-500 text-right">Subtotal</td>
                      <td className="py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(oneTimeTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {recurring.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#015035' }} />
                  Recurring Services
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left pb-2 font-semibold">Description</th>
                      <th className="text-right pb-2 font-semibold">Months</th>
                      <th className="text-right pb-2 font-semibold">/mo</th>
                      <th className="text-right pb-2 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map(item => (
                      <tr key={item.id} className="border-b border-gray-50">
                        <td className="py-2 text-sm text-gray-800">{item.description}</td>
                        <td className="py-2 text-sm text-gray-600 text-right">{item.quantity}</td>
                        <td className="py-2 text-sm text-gray-600 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="py-2 text-xs font-semibold text-gray-500 text-right">Monthly Recurring</td>
                      <td className="py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(recurring[0]?.unitPrice || 0)}/mo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Total */}
            <div className="mt-4 pt-3 border-t-2 border-gray-200 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">Total Contract Value</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}>
                {formatCurrency(proposal.value)}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status Timeline</p>
            <div className="flex gap-2">
              {statusOrder.map((s, i) => {
                const idx = statusOrder.indexOf(proposal.status)
                const isPast = i <= idx
                return (
                  <div key={s} className="flex-1 text-center">
                    <div className={`h-1 rounded-full mb-1 ${isPast ? '' : 'bg-gray-200'}`}
                      style={{ background: isPast ? '#015035' : undefined }} />
                    <p className={`text-[9px] font-semibold ${isPast ? 'text-gray-700' : 'text-gray-300'}`}>{s}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {proposal.status === 'Draft' && (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Send to Client
            </button>
          )}
          {proposal.status === 'Accepted' && (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Generate Contract
            </button>
          )}
          <button className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Edit
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProposalsPage() {
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? proposals : proposals.filter(p => p.status === statusFilter)

  const counts = statusOrder.reduce((acc, s) => {
    acc[s] = proposals.filter(p => p.status === s).length
    return acc
  }, {} as Record<ProposalStatus, number>)

  return (
    <>
      <Header title="Proposals" subtitle="Manage quotes and scope of work" action={{ label: 'New Proposal' }} />
      <div className="p-6 flex-1">

        {/* Status Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {statusOrder.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`metric-card text-left transition-all ${statusFilter === s ? 'ring-2 ring-green-800 ring-offset-1' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: '#015035' }}>
                {statusIcons[s]}
                <span className="text-xs font-semibold text-gray-500">{s}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                {counts[s]}
              </p>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {(['All', ...statusOrder] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as typeof statusFilter)}
                  className={`tab-btn ${statusFilter === s ? 'active' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">{filtered.length} proposals · {formatCurrency(filtered.reduce((s, p) => s + p.value, 0))}</span>
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
                <ProposalRow key={p.id} proposal={p} onClick={() => setSelected(p)} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No proposals in this status</div>
          )}
        </div>
      </div>

      {selected && <ProposalDetail proposal={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
