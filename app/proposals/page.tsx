'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchDeals, fetchContracts } from '@/lib/supabase'
import { formatCurrency, proposalStatusColors, serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import ProposalBuilderPanel from '@/components/crm/ProposalBuilderPanel'
import type { Deal, Contract, Proposal, ProposalStatus } from '@/lib/types'
import {
  Eye, Send, CheckCircle, XCircle, FileText, DollarSign, Calendar, User, X,
  Clock, ExternalLink, Mail, Phone, TrendingUp, AlertTriangle, Edit2, ShieldCheck,
  Trash2,
} from 'lucide-react'

const statusOrder: ProposalStatus[] = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Viewed', 'Accepted', 'Declined']

const statusIcons: Record<ProposalStatus, React.ReactNode> = {
  Draft: <FileText size={13} />,
  'Pending Approval': <Clock size={13} />,
  Approved: <ShieldCheck size={13} />,
  Sent: <Send size={13} />,
  Viewed: <Eye size={13} />,
  Accepted: <CheckCircle size={13} />,
  Declined: <XCircle size={13} />,
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border border-white/10 text-white text-sm font-medium" style={{ background: '#012b1e', maxWidth: '90vw' }}>
      <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── ProposalPanel ────────────────────────────────────────────────────────────

function ProposalPanel({
  proposal,
  onClose,
  onUpdateStatus,
  onEdit,
  onDelete,
  deals,
  contracts,
}: {
  proposal: Proposal
  onClose: () => void
  onUpdateStatus: (id: string, status: ProposalStatus) => void
  onEdit: (proposal: Proposal) => void
  onDelete: (id: string) => void
  deals: Deal[]
  contracts: Contract[]
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'scope' | 'activity'>('overview')

  const deal = deals.find(d => d.id === proposal.dealId)
  const linkedContract = contracts.find(c => c.proposalId === proposal.id)

  const oneTime = proposal.items.filter(i => i.type === 'one-time')
  const recurring = proposal.items.filter(i => i.type === 'recurring')
  const oneTimeTotal = oneTime.reduce((s, i) => s + i.total, 0)
  const statusIdx = statusOrder.indexOf(proposal.status)

  const timeline = [
    { label: 'Created', date: proposal.createdDate, done: true },
    { label: 'Submitted for Approval', date: proposal.submittedForApprovalDate, done: !!proposal.submittedForApprovalDate },
    { label: 'Approved', date: proposal.approvedDate, done: !!proposal.approvedDate },
    { label: 'Sent to Client', date: proposal.sentDate, done: !!proposal.sentDate },
    { label: 'Viewed by Client', date: proposal.viewedDate, done: !!proposal.viewedDate },
    { label: 'Response Received', date: proposal.respondedDate, done: !!proposal.respondedDate },
  ]

  const canEdit = ['Draft', 'Pending Approval', 'Approved'].includes(proposal.status)

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white w-full sm:w-auto"
        style={{ width: 'min(440px, 100vw)', height: '100vh' }}
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
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  onClick={() => { onClose(); onEdit(proposal) }}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Edit proposal"
                >
                  <Edit2 size={14} className="text-white/60" />
                </button>
              )}
              {proposal.status === 'Draft' && (
                <button
                  onClick={() => { onClose(); onDelete(proposal.id) }}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Delete proposal"
                >
                  <Trash2 size={14} className="text-red-400/80" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={16} className="text-white/60" />
              </button>
            </div>
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
                  }`}>{s === 'Pending Approval' ? 'Pending' : s === 'Approved' ? 'Approved' : s}</p>
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
        <div className="flex-shrink-0 flex border-b border-gray-100 px-4 pt-3 gap-5 overflow-x-auto">
          {(['overview', 'scope', 'activity'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex-shrink-0 ${
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
              {/* Approval workflow alert */}
              {proposal.status === 'Pending Approval' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Clock size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Awaiting Manager Approval</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">Submitted {proposal.submittedForApprovalDate ? new Date(proposal.submittedForApprovalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'recently'}. Approve to send to client.</p>
                  </div>
                </div>
              )}
              {proposal.status === 'Approved' && (
                <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <ShieldCheck size={14} className="text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-teal-800">Approved — Ready to Send</p>
                    <p className="text-[11px] text-teal-600 mt-0.5">Approved by {proposal.approvedBy || 'manager'}. Click Send to Client below.</p>
                  </div>
                </div>
              )}

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
            <>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'Pending Approval')}
                className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                Submit for Approval
              </button>
              <button
                onClick={() => { onClose(); onEdit(proposal) }}
                className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
              >
                <Edit2 size={13} />
              </button>
            </>
          )}
          {proposal.status === 'Pending Approval' && (
            <>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'Approved')}
                className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                Approve
              </button>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'Draft')}
                className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
              >
                Send Back
              </button>
            </>
          )}
          {proposal.status === 'Approved' && (
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const [localProposals, setLocalProposals] = useState<Proposal[]>([])
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'All'>('All')
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proposals')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setLocalProposals(data) })
      .catch(() => {})
    fetchDeals().then(setDeals)
    fetchContracts().then(setContracts)
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  function updateProposalStatus(id: string, status: ProposalStatus) {
    const today = new Date().toISOString().split('T')[0]

    const dateFields = {
      ...(status === 'Pending Approval' ? { submittedForApprovalDate: today } : {}),
      ...(status === 'Approved' ? { approvedDate: today, approvedBy: 'Jonathan Graviss' } : {}),
      ...(status === 'Sent' ? { sentDate: today } : {}),
      ...(status === 'Viewed' ? { viewedDate: today } : {}),
      ...(['Accepted', 'Declined'].includes(status) ? { respondedDate: today } : {}),
    }

    // Optimistic UI update
    setLocalProposals(prev => prev.map(p => {
      if (p.id !== id) return p
      return { ...p, status, ...dateFields }
    }))
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, status, ...dateFields }
    })

    // Persist to API
    fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...dateFields }),
    }).catch(() => {})

    // If accepted, auto-create contract + task
    if (status === 'Accepted') {
      const proposal = localProposals.find(p => p.id === id)
      if (proposal) {
        // Create contract
        fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company: proposal.company,
            value: proposal.value,
            serviceType: proposal.serviceType,
            status: 'Draft',
            assignedRep: proposal.assignedRep,
            proposalId: proposal.id,
          }),
        }).catch(() => {})

        // Create task (due 3 days from now)
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 3)
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Convert accepted proposal to contract',
            description: `Proposal for ${proposal.company} was accepted. Create the contract.`,
            assignedTo: proposal.assignedRep,
            category: 'Contract',
            priority: 'High',
            dueDate: dueDate.toISOString().split('T')[0],
            status: 'Pending',
          }),
        }).catch(() => {})

        setToast('Proposal accepted! Contract draft created and task assigned.')
      }
    }
  }

  function handleNewProposal(data: Omit<Proposal, 'id' | 'dealId' | 'createdDate'>) {
    if (editingProposal) {
      // Optimistic update
      setLocalProposals(prev => prev.map(p =>
        p.id === editingProposal.id ? { ...p, ...data } : p
      ))
      setEditingProposal(null)

      // Persist via PATCH
      fetch(`/api/proposals/${editingProposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {})
    } else {
      // POST to API and use returned proposal (real DB id)
      fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          status: data.status ?? 'Draft',
          createdDate: new Date().toISOString().split('T')[0],
        }),
      })
        .then(r => r.json())
        .then(saved => {
          if (saved && saved.id) {
            setLocalProposals(prev => [saved, ...prev])
          }
        })
        .catch(() => {
          // Fallback: add with temp id
          const newProposal: Proposal = {
            id: `prop-${Date.now()}`,
            dealId: '',
            createdDate: new Date().toISOString().split('T')[0],
            ...data,
          }
          setLocalProposals(prev => [newProposal, ...prev])
        })

      setCreatingProposal(false)
    }
  }

  function deleteProposal(id: string) {
    // Optimistic remove
    setLocalProposals(prev => prev.filter(p => p.id !== id))
    setSelected(null)

    // Persist via DELETE
    fetch(`/api/proposals/${id}`, { method: 'DELETE' }).catch(() => {})
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

  const pendingApprovalCount = counts['Pending Approval'] || 0

  const metrics = [
    { label: 'Total Proposals', value: localProposals.length.toString(), icon: <FileText size={16} />, color: '#6b7280', sub: 'All time' },
    { label: 'Open Pipeline', value: formatCurrency(pipelineValue), icon: <TrendingUp size={16} />, color: '#3b82f6', sub: 'Draft + Active' },
    { label: 'Accepted Value', value: formatCurrency(acceptedValue), icon: <CheckCircle size={16} />, color: '#22c55e', sub: 'Ready for contract' },
    { label: 'Needs Approval', value: pendingApprovalCount.toString(), icon: <ShieldCheck size={16} />, color: '#f59e0b', sub: 'Awaiting review' },
  ]

  return (
    <>
      <Header title="Proposals" subtitle="Manage quotes and scope of work" action={{ label: 'New Proposal', onClick: () => setCreatingProposal(true) }} />
      <div className="page-content">

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.map(m => (
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

        {/* Proposals list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 bg-white">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0">
              <button onClick={() => setStatusFilter('All')} className={`filter-pill flex-shrink-0 ${statusFilter === 'All' ? 'active' : ''}`}>All <span className="ml-1 opacity-60">{localProposals.length}</span></button>
              {statusOrder.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`filter-pill flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}>{s} <span className="ml-1 opacity-60">{counts[s]}</span></button>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-semibold flex-shrink-0">
              {formatCurrency(filtered.reduce((s, p) => s + p.value, 0))}
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto table-scroll">
            <table className="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Service</th>
                  <th>Value</th>
                  <th className="hidden md:table-cell">Rep</th>
                  <th className="hidden lg:table-cell">Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => setSelected(p)} className="cursor-pointer">
                    <td>
                      <p className="font-semibold text-gray-900">{p.company}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.id.toUpperCase()}</p>
                    </td>
                    <td><StatusBadge label={p.status} colorClass={proposalStatusColors[p.status]} /></td>
                    <td className="hidden sm:table-cell"><StatusBadge label={p.serviceType} colorClass={serviceTypeColors[p.serviceType]} /></td>
                    <td><span className="font-bold text-gray-900">{formatCurrency(p.value)}</span></td>
                    <td className="hidden md:table-cell"><span className="text-gray-600">{p.assignedRep}</span></td>
                    <td className="hidden lg:table-cell">
                      <span className="text-gray-400">{new Date(p.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {p.status === 'Draft' && (
                          <>
                            <button
                              onClick={() => updateProposalStatus(p.id, 'Pending Approval')}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => setEditingProposal(p)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProposal(p.id)}
                              className="text-xs font-medium text-red-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        {p.status === 'Pending Approval' && (
                          <button
                            onClick={() => updateProposalStatus(p.id, 'Approved')}
                            className="text-xs font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded-md hover:bg-amber-50 transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {p.status === 'Approved' && (
                          <button
                            onClick={() => updateProposalStatus(p.id, 'Sent')}
                            className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-md hover:bg-teal-50 transition-colors"
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
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden divide-y divide-gray-100">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{p.company}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{p.id.toUpperCase()}</p>
                  </div>
                  <StatusBadge label={p.status} colorClass={proposalStatusColors[p.status]} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge label={p.serviceType} colorClass={serviceTypeColors[p.serviceType]} />
                    <span className="text-[11px] text-gray-400">{p.assignedRep}</span>
                  </div>
                  <span className="font-bold text-gray-900 text-sm">{formatCurrency(p.value)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                  {p.status === 'Draft' && (
                    <>
                      <button
                        onClick={() => updateProposalStatus(p.id, 'Pending Approval')}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => { setEditingProposal(p) }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProposal(p.id)}
                        className="text-xs font-medium text-red-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  {p.status === 'Pending Approval' && (
                    <button
                      onClick={() => updateProposalStatus(p.id, 'Approved')}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 px-2 py-1 rounded-md hover:bg-amber-50 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {p.status === 'Approved' && (
                    <button
                      onClick={() => updateProposalStatus(p.id, 'Sent')}
                      className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2 py-1 rounded-md hover:bg-teal-50 transition-colors"
                    >
                      Send
                    </button>
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
                </div>
              </div>
            ))}
          </div>

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
          onEdit={p => { setSelected(null); setEditingProposal(p) }}
          onDelete={deleteProposal}
          deals={deals}
          contracts={contracts}
        />
      )}
      {(creatingProposal || editingProposal) && (
        <ProposalBuilderPanel
          initialData={editingProposal ?? undefined}
          onSave={handleNewProposal}
          onClose={() => { setCreatingProposal(false); setEditingProposal(null) }}
        />
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </>
  )
}
