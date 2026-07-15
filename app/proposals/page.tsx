'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Search, Copy, BarChart3, Percent, Inbox, Trash2, Download,
} from 'lucide-react'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}`
}
import { useToast } from '@/components/ui/Toast'
import { downloadCsv } from '@/lib/csv-export'

const statusOrder: ProposalStatus[] = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Viewed', 'Accepted', 'Declined']

const filterTabs: Array<ProposalStatus | 'All'> = ['All', 'Draft', 'Sent', 'Viewed', 'Accepted', 'Declined']

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
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white"
        style={{ width: 'min(440px, 100vw)', height: '100vh' }}
      >
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <X size={14} /> Back
          </button>
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
                  onClick={() => onDelete(proposal.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                  title="Delete proposal"
                >
                  <X size={14} className="text-red-400/60" />
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

        <div className="flex-shrink-0 grid grid-cols-3 border-b border-gray-100 divide-x divide-gray-100">
          {[
            { label: 'Total Value', value: formatCurrency(proposal.value) },
            { label: 'One-Time', value: formatCurrency(oneTimeTotal) },
            { label: 'MRR', value: recurring.length > 0 ? formatCurrency(recurring.reduce((s, i) => s + i.unitPrice, 0)) + '/mo' : '—' },
          ].map((stat, i) => (
            <div key={i} className="p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">{stat.label}</p>
              <p className="text-sm font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

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

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-4">
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

              {proposal.status === 'Viewed' && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Client has viewed this proposal</p>
                    <p className="text-[11px] text-amber-600">Send a follow-up to close this deal</p>
                  </div>
                </div>
              )}

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
                          <td className="p-2.5 text-sm font-bold text-gray-900 text-right">{formatCurrency(recurring.reduce((s, i) => s + i.unitPrice, 0))}/mo</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

function WinProbabilityIndicator({ status }: { status: ProposalStatus }) {
  const config: Record<ProposalStatus, { pct: number; color: string; label: string }> = {
    Draft: { pct: 10, color: '#9ca3af', label: '10%' },
    'Pending Approval': { pct: 20, color: '#f59e0b', label: '20%' },
    Approved: { pct: 35, color: '#3b82f6', label: '35%' },
    Sent: { pct: 50, color: '#3b82f6', label: '50%' },
    Viewed: { pct: 70, color: '#8b5cf6', label: '70%' },
    Accepted: { pct: 100, color: '#22c55e', label: 'Won' },
    Declined: { pct: 0, color: '#ef4444', label: 'Lost' },
  }
  const c = config[status]
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${c.pct}%`, background: c.color }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: c.color }}>{c.label}</span>
    </div>
  )
}

export default function ProposalsPage() {
  const { toast } = useToast()
  const [localProposals, setLocalProposals] = useState<Proposal[]>([])
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  useEffect(() => {
    fetch('/api/proposals')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalProposals(data) })
      .catch(() => toast('Failed to load proposals', 'error'))
      .finally(() => setLoading(false))
    fetchDeals().then(setDeals)
    fetchContracts().then(setContracts)
  }, [])

  async function updateProposalStatus(id: string, status: ProposalStatus) {
    const today = new Date().toISOString().split('T')[0]

    if (status === 'Sent') {
      try {
        const emailRes = await fetch('/api/email/send-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId: id }),
        })
        if (!emailRes.ok) {
          const err = await emailRes.json()
          toast(`Could not send proposal email: ${err.error ?? 'Unknown error'}`, 'error')
          return
        }
      } catch {
        toast('Failed to send proposal email. Please try again.', 'error')
        return
      }
    }

    const datePatch = {
      ...(status === 'Pending Approval' ? { submittedForApprovalDate: today } : {}),
      ...(status === 'Approved' ? { approvedDate: today, approvedBy: 'Jonathan Graviss' } : {}),
      ...(status === 'Sent' ? { sentDate: today } : {}),
      ...(status === 'Viewed' ? { viewedDate: today } : {}),
      ...(['Accepted', 'Declined'].includes(status) ? { respondedDate: today } : {}),
    }
    const patchData = { status, ...datePatch }

    setLocalProposals(prev => prev.map(p => {
      if (p.id !== id) return p
      return { ...p, ...patchData }
    }))
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, ...patchData }
    })

    try {
      const patchRes = await fetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        toast(err.error || 'Failed to update proposal status', 'error')
        setLocalProposals(prev => prev.map(p => {
          if (p.id !== id) return p
          const original = localProposals.find(op => op.id === id)
          return original ?? p
        }))
        return
      }
      toast(`Proposal ${status === 'Pending Approval' ? 'submitted for approval' : status.toLowerCase()}`, 'success')
    } catch (err) {
      console.error('Failed to PATCH proposal status:', err)
      toast('Network error — could not update proposal', 'error')
      return
    }

    if (status === 'Accepted') {
      const proposal = localProposals.find(p => p.id === id)
      if (proposal) {
        try {
          const contractPayload = {
            proposalId: proposal.id,
            company: proposal.company,
            status: 'Draft',
            value: proposal.value,
            billingStructure: 'Monthly',
            startDate: today,
            duration: 12,
            renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            assignedRep: proposal.assignedRep,
            serviceType: proposal.serviceType,
          }
          const res = await fetch('/api/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contractPayload),
          })
          if (res.ok) {
            const savedContract = await res.json()
            setContracts(prev => [savedContract, ...prev])
            toast('Draft contract created from accepted proposal', 'success')
          } else {
            toast('Proposal accepted, but contract auto-creation failed', 'error')
          }
        } catch (err) {
          console.error('Failed to create contract from accepted proposal:', err)
          toast('Proposal accepted, but contract auto-creation failed', 'error')
        }
      }
    }
  }

  async function handleNewProposal(data: Omit<Proposal, 'id' | 'dealId' | 'createdDate'>) {
    if (editingProposal) {
      setLocalProposals(prev => prev.map(p =>
        p.id === editingProposal.id
          ? { ...p, ...data }
          : p
      ))
      setEditingProposal(null)
      try {
        const res = await fetch(`/api/proposals/${editingProposal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          toast('Proposal updated', 'success')
        } else {
          const err = await res.json().catch(() => ({}))
          toast(err.error || 'Failed to save proposal changes', 'error')
        }
      } catch (err) {
        console.error('Failed to PATCH proposal:', err)
        toast('Network error — could not save proposal changes', 'error')
      }
    } else {
      const localProposal: Proposal = {
        id: generateId('prop'),
        dealId: '',
        createdDate: new Date().toISOString().split('T')[0],
        ...data,
      }
      setLocalProposals(prev => [localProposal, ...prev])
      setCreatingProposal(false)
      try {
        const res = await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealId: '',
            createdDate: localProposal.createdDate,
            ...data,
          }),
        })
        if (res.ok) {
          const savedProposal = await res.json()
          setLocalProposals(prev => prev.map(p =>
            p.id === localProposal.id ? savedProposal : p
          ))
          toast('Proposal created', 'success')
        } else {
          const err = await res.json().catch(() => ({}))
          toast(err.error || 'Failed to create proposal', 'error')
        }
      } catch (err) {
        console.error('Failed to POST proposal:', err)
        toast('Network error — could not create proposal', 'error')
      }
    }
  }

  async function handleDeleteProposal(id: string) {
    if (!confirm('Delete this proposal? This cannot be undone.')) return
    setLocalProposals(prev => prev.filter(p => p.id !== id))
    setSelected(prev => (prev?.id === id ? null : prev))
    try {
      const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast('Proposal deleted', 'success')
      } else {
        const err = await res.json().catch(() => ({}))
        toast(err.error || 'Failed to delete proposal', 'error')
      }
    } catch {
      toast('Network error — could not delete proposal', 'error')
    }
  }

  function handleDuplicate(proposal: Proposal) {
    const duplicate: Omit<Proposal, 'id' | 'dealId' | 'createdDate'> = {
      company: proposal.company,
      status: 'Draft',
      value: proposal.value,
      serviceType: proposal.serviceType,
      assignedRep: proposal.assignedRep,
      items: proposal.items.map(item => ({ ...item, id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
    }
    handleNewProposal(duplicate)
    toast('Proposal duplicated as draft', 'success')
  }

  const filtered = useMemo(() => {
    let list = statusFilter === 'All' ? localProposals : localProposals.filter(p => p.status === statusFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.company.toLowerCase().includes(q) ||
        p.serviceType.toLowerCase().includes(q) ||
        p.assignedRep.toLowerCase().includes(q)
      )
    }
    return list
  }, [localProposals, statusFilter, searchQuery])

  const allFilteredIds = filtered.map(p => p.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allFilteredIds))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    const removed = localProposals.filter(p => selectedIds.has(p.id))
    setLocalProposals(prev => prev.filter(p => !selectedIds.has(p.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      const res = await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'proposals', ids }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setLocalProposals(prev => [...removed, ...prev])
        toast(err.error || 'Failed to delete proposals', 'error')
        return
      }
      toast(`${ids.length} proposals deleted`, 'success')
    } catch {
      setLocalProposals(prev => [...removed, ...prev])
      toast('Failed to delete proposals', 'error')
    }
  }

  const tabCounts = useMemo(() => {
    const base = searchQuery.trim()
      ? localProposals.filter(p => {
          const q = searchQuery.toLowerCase()
          return p.company.toLowerCase().includes(q) || p.serviceType.toLowerCase().includes(q) || p.assignedRep.toLowerCase().includes(q)
        })
      : localProposals
    const counts: Record<string, number> = { All: base.length }
    for (const s of filterTabs) {
      if (s !== 'All') counts[s] = base.filter(p => p.status === s).length
    }
    return counts
  }, [localProposals, searchQuery])

  const totalProposals = localProposals.length
  const acceptedCount = localProposals.filter(p => p.status === 'Accepted').length
  const declinedCount = localProposals.filter(p => p.status === 'Declined').length
  const decidedCount = acceptedCount + declinedCount
  const acceptanceRate = decidedCount > 0 ? Math.round((acceptedCount / decidedCount) * 100) : 0
  const avgValue = totalProposals > 0 ? localProposals.reduce((s, p) => s + p.value, 0) / totalProposals : 0
  const pipelineValue = localProposals
    .filter(p => !['Accepted', 'Declined'].includes(p.status))
    .reduce((s, p) => s + p.value, 0)

  const kpis = [
    { label: 'Total Proposals', value: totalProposals.toString(), icon: <FileText size={18} />, color: '#015035', sub: `${acceptedCount} won, ${declinedCount} lost` },
    { label: 'Acceptance Rate', value: `${acceptanceRate}%`, icon: <Percent size={18} />, color: '#22c55e', sub: `${decidedCount} decided` },
    { label: 'Avg Value', value: formatCurrency(avgValue), icon: <BarChart3 size={18} />, color: '#3b82f6', sub: 'Per proposal' },
    { label: 'Pipeline Value', value: formatCurrency(pipelineValue), icon: <TrendingUp size={18} />, color: '#8b5cf6', sub: 'Open proposals' },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Proposals" subtitle="Manage quotes and scope of work" action={{ label: 'New Proposal', onClick: () => setCreatingProposal(true) }} />
      <div className="page-content">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${k.color}12` }}>
                  <span style={{ color: k.color }}>{k.icon}</span>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>{k.value}</p>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mt-1">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by company, service, or rep..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 outline-none focus:border-[#015035] focus:ring-1 focus:ring-[#015035]/20 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 transition-colors"
                  >
                    <X size={13} className="text-gray-400" />
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400 font-semibold tabular-nums flex-shrink-0">
                {filtered.length} proposal{filtered.length !== 1 ? 's' : ''} · {formatCurrency(filtered.reduce((s, p) => s + p.value, 0))}
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-0 -mb-px">
              {filterTabs.map(tab => {
                const isActive = statusFilter === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                      isActive
                        ? 'border-[#015035] text-[#015035]'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab}
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#015035]/10 text-[#015035]' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {tabCounts[tab] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="overflow-x-auto table-scroll">
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                      />
                    </th>
                    <th>Company</th>
                    <th>Status</th>
                    <th className="hidden sm:table-cell">Value</th>
                    <th className="hidden md:table-cell">Rep</th>
                    <th className="hidden lg:table-cell">Date</th>
                    <th className="hidden xl:table-cell">Win Probability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} onClick={() => setSelected(p)} className={`cursor-pointer group ${selectedIds.has(p.id) ? 'bg-emerald-50/50' : ''}`}>
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{ background: '#01503512', color: '#015035' }}
                          >
                            {p.company.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{p.company}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <StatusBadge label={p.serviceType} colorClass={serviceTypeColors[p.serviceType]} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge label={p.status} colorClass={proposalStatusColors[p.status]} />
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(p.value)}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                            {p.assignedRep.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-gray-600 text-xs">{p.assignedRep}</span>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell">
                        <div>
                          <p className="text-xs text-gray-600">{new Date(p.sentDate || p.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-[10px] text-gray-400">{p.sentDate ? 'Sent' : 'Created'}</p>
                        </div>
                      </td>
                      <td className="hidden xl:table-cell">
                        <WinProbabilityIndicator status={p.status} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelected(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#015035] hover:bg-[#015035]/5 transition-colors"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                          {['Draft', 'Pending Approval', 'Approved'].includes(p.status) && (
                            <button
                              onClick={() => setEditingProposal(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {p.status === 'Approved' && (
                            <button
                              onClick={() => updateProposalStatus(p.id, 'Sent')}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#015035] hover:bg-[#015035]/5 transition-colors"
                              title="Send"
                            >
                              <Send size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicate(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#01503510' }}>
                <Inbox size={28} style={{ color: '#015035' }} className="opacity-60" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No proposals found</p>
              <p className="text-xs text-gray-400 max-w-xs">
                {searchQuery
                  ? `No results for "${searchQuery}". Try adjusting your search or filters.`
                  : statusFilter !== 'All'
                    ? `No proposals with status "${statusFilter}". Try switching to a different tab.`
                    : 'Create your first proposal to get started.'}
              </p>
              {!searchQuery && statusFilter === 'All' && (
                <button
                  onClick={() => setCreatingProposal(true)}
                  className="mt-4 px-4 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ background: '#015035' }}
                >
                  Create Proposal
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ProposalPanel
          proposal={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateProposalStatus}
          onEdit={p => { setSelected(null); setEditingProposal(p) }}
          onDelete={handleDeleteProposal}
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
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {
              const rows = selectedIds.size === 0 ? localProposals : localProposals.filter(p => selectedIds.has(p.id))
              downloadCsv(rows as unknown as Record<string, unknown>[], [
                { key: 'company', label: 'Company' },
                { key: 'serviceType', label: 'Service Type' },
                { key: 'status', label: 'Status' },
                { key: 'value', label: 'Value', format: v => v ? `$${Number(v).toLocaleString()}` : '' },
                { key: 'assignedRep', label: 'Assigned Rep' },
                { key: 'sentDate', label: 'Sent Date', format: v => String(v ?? '') },
              ], 'proposals-export.csv')
            } },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} proposals?`}
          description="This action cannot be undone. Selected proposals will be permanently removed."
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
    </>
  )
}
