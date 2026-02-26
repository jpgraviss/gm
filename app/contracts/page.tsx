'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { contracts } from '@/lib/data'
import { formatCurrency, contractStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Contract, ContractStatus } from '@/lib/types'
import { X, CheckCircle, Clock, AlertCircle, ScrollText, Calendar, DollarSign, User } from 'lucide-react'

const allStatuses: ContractStatus[] = [
  'Draft', 'Sent', 'Viewed', 'Signed by Client', 'Countersign Needed', 'Fully Executed', 'Expired',
]

const statusCounts = allStatuses.reduce((acc, s) => {
  acc[s] = contracts.filter(c => c.status === s).length
  return acc
}, {} as Record<ContractStatus, number>)

function ContractRow({ contract, onClick }: { contract: Contract; onClick: () => void }) {
  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
      onClick={onClick}
    >
      <td className="py-3 px-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{contract.company}</p>
          <p className="text-xs text-gray-400">{contract.id.toUpperCase()}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={contract.status} colorClass={contractStatusColors[contract.status]} />
      </td>
      <td className="py-3 px-4">
        <StatusBadge label={contract.serviceType} colorClass={serviceTypeColors[contract.serviceType]} />
      </td>
      <td className="py-3 px-4">
        <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
          {formatCurrency(contract.value)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-600">{contract.billingStructure}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-gray-500">{formatDate(contract.renewalDate)}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm text-gray-500">{contract.assignedRep}</span>
      </td>
      <td className="py-3 px-4">
        {contract.status === 'Countersign Needed' && (
          <button className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100 transition-colors">
            Sign Now
          </button>
        )}
        {contract.status === 'Fully Executed' && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle size={12} /> Executed
          </span>
        )}
        {contract.status === 'Sent' && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Clock size={12} /> Awaiting
          </span>
        )}
        {['Draft'].includes(contract.status) && (
          <button className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
            Send
          </button>
        )}
      </td>
    </tr>
  )
}

function ContractDetail({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const signedPercent = contract.status === 'Fully Executed' ? 100
    : contract.status === 'Countersign Needed' || contract.status === 'Signed by Client' ? 50
    : 0

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-6 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <p className="text-white/60 text-xs mb-1">{contract.id.toUpperCase()} · Contract</p>
            <h2
              className="text-white text-lg font-bold"
              style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
            >
              {contract.company}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge label={contract.status} colorClass={contractStatusColors[contract.status]} />
              <StatusBadge label={contract.serviceType} colorClass={serviceTypeColors[contract.serviceType]} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={18} className="text-white/60" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Key Terms */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <DollarSign size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Contract Value</span>
              </div>
              <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}>
                {formatCurrency(contract.value)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <ScrollText size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Billing Structure</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{contract.billingStructure}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Calendar size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Start Date</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{formatDate(contract.startDate)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                <Calendar size={13} />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Renewal Date</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{formatDate(contract.renewalDate)}</p>
            </div>
          </div>

          {/* Duration */}
          <div className="p-4 bg-gray-50 rounded-xl mb-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract Duration</p>
              <span className="text-sm font-bold text-gray-800">{contract.duration} months</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full" style={{ width: '20%', background: '#015035' }} />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Start</span>
              <span>20% complete</span>
              <span>Renewal</span>
            </div>
          </div>

          {/* Signature Flow */}
          <div className="p-4 bg-gray-50 rounded-xl mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">E-Signature Status</p>
            <div className="flex items-center gap-3">
              {/* Client Sig */}
              <div className={`flex-1 p-3 rounded-lg border-2 ${contract.clientSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {contract.clientSigned
                    ? <CheckCircle size={14} className="text-emerald-500" />
                    : <Clock size={14} className="text-gray-300" />}
                  <span className="text-xs font-semibold text-gray-600">Client Signature</span>
                </div>
                {contract.clientSigned
                  ? <p className="text-xs text-emerald-600">{formatDate(contract.clientSigned)}</p>
                  : <p className="text-xs text-gray-400">Pending</p>}
              </div>

              <div className="text-gray-300">→</div>

              {/* Internal Sig */}
              <div className={`flex-1 p-3 rounded-lg border-2 ${contract.internalSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {contract.internalSigned
                    ? <CheckCircle size={14} className="text-emerald-500" />
                    : <Clock size={14} className="text-gray-300" />}
                  <span className="text-xs font-semibold text-gray-600">Internal Signature</span>
                </div>
                {contract.internalSigned
                  ? <p className="text-xs text-emerald-600">{formatDate(contract.internalSigned)}</p>
                  : <p className="text-xs text-gray-400">Pending</p>}
              </div>

              <div className="text-gray-300">→</div>

              {/* Final Status */}
              <div className={`flex-1 p-3 rounded-lg border-2 ${contract.status === 'Fully Executed' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {contract.status === 'Fully Executed'
                    ? <CheckCircle size={14} className="text-emerald-500" />
                    : <AlertCircle size={14} className="text-gray-300" />}
                  <span className="text-xs font-semibold text-gray-600">Fully Executed</span>
                </div>
                {contract.status === 'Fully Executed'
                  ? <p className="text-xs text-emerald-600">Complete</p>
                  : <p className="text-xs text-gray-400">Awaiting</p>}
              </div>
            </div>
          </div>

          {/* Assigned */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <User size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">Assigned to</span>
            <span className="text-sm font-semibold text-gray-800">{contract.assignedRep}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {contract.status === 'Countersign Needed' && (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              Countersign Now
            </button>
          )}
          {contract.status === 'Fully Executed' && (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              Generate Invoice
            </button>
          )}
          {contract.status === 'Draft' && (
            <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
              Send for Signature
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

export default function ContractsPage() {
  const [selected, setSelected] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All')

  const filtered = statusFilter === 'All' ? contracts : contracts.filter(c => c.status === statusFilter)

  return (
    <>
      <Header title="Contracts" subtitle="Track agreements and e-signatures" action={{ label: 'New Contract' }} />
      <div className="p-6 flex-1">

        {/* Status summary */}
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
          {allStatuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`metric-card text-center p-3 transition-all ${statusFilter === s ? 'ring-2 ring-green-800' : ''}`}
            >
              <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
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
                <ContractRow key={c.id} contract={c} onClick={() => setSelected(c)} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No contracts in this status</div>
          )}
        </div>
      </div>

      {selected && <ContractDetail contract={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
