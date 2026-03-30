'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { fetchInvoices, fetchProjects, fetchProposals } from '@/lib/supabase'
import { formatCurrency, contractStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import NewContractPanel, { type NewContractFormData } from '@/components/crm/NewContractPanel'
import type { Contract, ContractStatus, Invoice, Project, Proposal, SignatureRequest } from '@/lib/types'
import {
  X, CheckCircle, Clock, AlertCircle, ScrollText, Calendar, DollarSign, User,
  ExternalLink, FileText, FolderKanban, Send, RefreshCw, Shield, Plus, FilePlus2,
  PenTool, Mail,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const allStatuses: ContractStatus[] = [
  'Draft', 'Sent', 'Viewed', 'Signed by Client', 'Countersign Needed', 'Fully Executed', 'Expired',
]

interface Addendum {
  id: string
  contractId: string
  title: string
  description: string
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined'
  createdDate: string
  sentDate?: string
}

function ContractPanel({
  contract, onClose, onUpdateStatus, addendums, onAddAddendum, onUpdateAddendumStatus,
  invoices, projects, proposals, signatures, onRequestSignature, onSignInternally,
}: {
  contract: Contract
  onClose: () => void
  onUpdateStatus: (id: string, status: ContractStatus) => void
  addendums: Addendum[]
  onAddAddendum: (contractId: string, title: string, description: string) => void
  onUpdateAddendumStatus: (id: string, status: Addendum['status']) => void
  invoices: Invoice[]
  projects: Project[]
  proposals: Proposal[]
  signatures: SignatureRequest[]
  onRequestSignature: (contractId: string, email: string, name: string, type: 'client' | 'internal') => void
  onSignInternally: (contractId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'project' | 'addendums'>('overview')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showSigModal, setShowSigModal] = useState(false)
  const [sigEmail, setSigEmail] = useState('')
  const [sigName, setSigName] = useState('')

  const contractAddendums = addendums.filter(a => a.contractId === contract.id)
  const contractSigs = signatures.filter(s => s.contractId === contract.id)
  const clientSig = contractSigs.find(s => s.type === 'client' && s.status === 'signed') || contractSigs.find(s => s.type === 'client')
  const internalSig = contractSigs.find(s => s.type === 'internal' && s.status === 'signed') || contractSigs.find(s => s.type === 'internal')

  const linkedInvoices = invoices.filter(i => i.contractId === contract.id)
  const linkedProject = projects.find(p => p.contractId === contract.id)
  const linkedProposal = contract.proposalId ? proposals.find(p => p.id === contract.proposalId) : null

  const signedPercent =
    contract.status === 'Fully Executed' ? 100
    : contract.status === 'Countersign Needed' || contract.status === 'Signed by Client' ? 50
    : 0

  // Duration progress
  const durationPct = useMemo(() => {
    const startMs = new Date(contract.startDate).getTime()
    const renewalMs = new Date(contract.renewalDate).getTime()
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now()
    return Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (renewalMs - startMs)) * 100)))
  }, [contract.startDate, contract.renewalDate])

  const invoicePaid = linkedInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const invoiceOutstanding = linkedInvoices.filter(i => ['Sent', 'Overdue', 'Pending'].includes(i.status)).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className="pointer-events-auto flex flex-col shadow-2xl border-l border-gray-200 bg-white"
        style={{ width: 'min(440px, 100vw)', height: '100vh' }}
      >
        {/* Dark green header */}
        <div className="flex-shrink-0 p-5 border-b border-white/10" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <X size={14} /> Back
          </button>
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
        <div className="flex-shrink-0 flex border-b border-gray-100 px-4 pt-3 gap-5 overflow-x-auto">
          {(['overview', 'invoices', 'project', 'addendums'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2.5 text-xs font-semibold capitalize border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab ? 'border-green-800 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'invoices' ? `Invoices (${linkedInvoices.length})`
               : tab === 'addendums' ? `Addendums${contractAddendums.length > 0 ? ` (${contractAddendums.length})` : ''}`
               : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                  <div className={`flex-1 p-3 rounded-xl border-2 ${clientSig?.status === 'signed' || contract.clientSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {clientSig?.status === 'signed' || contract.clientSigned
                        ? <CheckCircle size={13} className="text-emerald-500" />
                        : <Clock size={13} className="text-gray-300" />}
                      <span className="text-xs font-semibold text-gray-600">Client</span>
                    </div>
                    {clientSig?.status === 'signed'
                      ? <p className="text-[11px] text-emerald-600">{formatDate(clientSig.signedAt!)}</p>
                      : contract.clientSigned
                        ? <p className="text-[11px] text-emerald-600">{formatDate(contract.clientSigned)}</p>
                        : clientSig?.status === 'pending'
                          ? <p className="text-[11px] text-amber-500">Awaiting</p>
                          : <p className="text-[11px] text-gray-400">Not requested</p>}
                  </div>

                  <div className="flex items-center text-gray-300 text-sm">&rarr;</div>

                  {/* Internal sig */}
                  <div className={`flex-1 p-3 rounded-xl border-2 ${internalSig?.status === 'signed' || contract.internalSigned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {internalSig?.status === 'signed' || contract.internalSigned
                        ? <CheckCircle size={13} className="text-emerald-500" />
                        : <Clock size={13} className="text-gray-300" />}
                      <span className="text-xs font-semibold text-gray-600">Internal</span>
                    </div>
                    {internalSig?.status === 'signed'
                      ? <p className="text-[11px] text-emerald-600">{formatDate(internalSig.signedAt!)}</p>
                      : contract.internalSigned
                        ? <p className="text-[11px] text-emerald-600">{formatDate(contract.internalSigned)}</p>
                        : <p className="text-[11px] text-gray-400">Pending</p>}
                    {!internalSig && !contract.internalSigned && contract.status !== 'Fully Executed' && contract.status !== 'Draft' && (
                      <button
                        onClick={() => onSignInternally(contract.id)}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md text-white transition-opacity hover:opacity-90"
                        style={{ background: '#015035' }}
                      >
                        <PenTool size={9} /> Sign
                      </button>
                    )}
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

          {activeTab === 'addendums' && (
            <div className="flex flex-col gap-3">
              {/* New addendum button */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 text-xs font-semibold px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-green-700 hover:text-green-700 transition-colors w-full justify-center"
                >
                  <Plus size={13} /> New Addendum
                </button>
              )}

              {/* Inline creation form */}
              {showAddForm && (
                <div className="p-3 border border-gray-200 rounded-xl bg-gray-50 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
                    <input
                      placeholder="e.g. Scope Extension — Additional Landing Pages"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description of Changes</label>
                    <textarea
                      placeholder="Describe the changes being added to the original agreement..."
                      rows={4}
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (newTitle.trim() && newDesc.trim()) {
                          onAddAddendum(contract.id, newTitle.trim(), newDesc.trim())
                          setNewTitle('')
                          setNewDesc('')
                          setShowAddForm(false)
                        }
                      }}
                      disabled={!newTitle.trim() || !newDesc.trim()}
                      className="flex-1 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
                      style={{ background: '#015035' }}
                    >
                      Save as Draft
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setNewTitle(''); setNewDesc('') }}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Addendum list */}
              {contractAddendums.length === 0 && !showAddForm ? (
                <div className="py-10 text-center">
                  <FilePlus2 size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No addendums yet</p>
                  <p className="text-xs text-gray-300 mt-1">Add contract changes to send to the client</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {contractAddendums.map(a => (
                    <div key={a.id} className="p-3 rounded-xl border border-gray-200 bg-white">
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Created {formatDate(a.createdDate)}{a.sentDate ? ` · Sent ${formatDate(a.sentDate)}` : ''}</p>
                        </div>
                        <StatusBadge
                          label={a.status}
                          colorClass={
                            a.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700'
                            : a.status === 'Sent' ? 'bg-blue-100 text-blue-700'
                            : a.status === 'Declined' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                          }
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5 line-clamp-2">{a.description}</p>
                      <div className="flex gap-2 items-center">
                        {a.status === 'Draft' && (
                          <button
                            onClick={() => onUpdateAddendumStatus(a.id, 'Sent')}
                            className="flex items-center gap-1 text-[11px] font-semibold text-white px-2.5 py-1 rounded-lg transition-opacity hover:opacity-90"
                            style={{ background: '#015035' }}
                          >
                            <Send size={10} /> Send to Client
                          </button>
                        )}
                        {a.status === 'Sent' && (
                          <>
                            <button
                              onClick={() => onUpdateAddendumStatus(a.id, 'Accepted')}
                              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              Mark Accepted
                            </button>
                            <button
                              onClick={() => onUpdateAddendumStatus(a.id, 'Declined')}
                              className="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Mark Declined
                            </button>
                          </>
                        )}
                        {a.status === 'Accepted' && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                            <CheckCircle size={11} /> Client accepted
                          </span>
                        )}
                        {a.status === 'Declined' && (
                          <span className="text-[11px] text-red-500">Declined by client</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
          {contract.status === 'Draft' && (
            <button
              onClick={() => onUpdateStatus(contract.id, 'Sent')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Send for Signature
            </button>
          )}
          {(contract.status === 'Sent' || contract.status === 'Viewed') && !clientSig && (
            <button
              onClick={() => setShowSigModal(true)}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
              style={{ background: '#015035' }}
            >
              <PenTool size={12} /> Request Signature
            </button>
          )}
          {contract.status === 'Sent' && (
            <button
              onClick={() => onUpdateStatus(contract.id, 'Signed by Client')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#3b82f6' }}
            >
              Mark Client Signed
            </button>
          )}
          {(contract.status === 'Signed by Client' || contract.status === 'Countersign Needed') && (
            <button
              onClick={() => onUpdateStatus(contract.id, 'Fully Executed')}
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Countersign & Execute
            </button>
          )}
          {contract.status === 'Fully Executed' && (
            <Link
              href="/billing"
              className="flex-1 py-2 rounded-xl text-white text-xs font-semibold text-center transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Go to Billing →
            </Link>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>

      {/* Signature request modal */}
      {showSigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSigModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Request Client Signature</h3>
              <button onClick={() => setShowSigModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Signer Email</label>
                <input
                  type="email"
                  value={sigEmail}
                  onChange={e => setSigEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Signer Name (optional)</label>
                <input
                  type="text"
                  value={sigName}
                  onChange={e => setSigName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    if (sigEmail.trim()) {
                      onRequestSignature(contract.id, sigEmail.trim(), sigName.trim(), 'client')
                      setShowSigModal(false)
                      setSigEmail('')
                      setSigName('')
                    }
                  }}
                  disabled={!sigEmail.trim()}
                  className="flex-1 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                  style={{ background: '#015035' }}
                >
                  <Mail size={12} /> Send Request
                </button>
                <button
                  onClick={() => { setShowSigModal(false); setSigEmail(''); setSigName('') }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ContractsPage() {
  const { toast } = useToast()
  const [localContracts, setLocalContracts] = useState<Contract[]>([])
  const [selected, setSelected] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All')
  const [creatingContract, setCreatingContract] = useState(false)
  const [localAddendums, setLocalAddendums] = useState<Addendum[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [signatures, setSignatures] = useState<SignatureRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contracts')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalContracts(data) })
      .catch(() => toast('Failed to load contracts', 'error'))
      .finally(() => setLoading(false))
    fetchInvoices().then(setInvoices)
    fetchProjects().then(setProjects)
    fetchProposals().then(setProposals)
  }, [])

  // Fetch signatures and addendums when a contract is selected
  useEffect(() => {
    if (!selected) return
    fetch(`/api/signatures?contractId=${selected.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setSignatures(data) })
      .catch(() => {})
    fetch(`/api/contracts/${selected.id}/addendums`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalAddendums(data) })
      .catch(() => {})
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function requestSignature(contractId: string, email: string, name: string, type: 'client' | 'internal') {
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, signerEmail: email, signerName: name || undefined, type }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create signature request', 'error')
        return
      }
      setSignatures(prev => [data, ...prev])
      toast('Signature request sent', 'success')
    } catch {
      toast('Failed to send signature request', 'error')
    }
  }

  async function signInternally(contractId: string) {
    // Create an internal signature request and open it in a new tab
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, signerEmail: 'internal@gravissmarketing.com', signerName: 'Graviss Marketing', type: 'internal' }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create internal signature', 'error')
        return
      }
      setSignatures(prev => [data, ...prev])
      window.open(`/sign/${data.token}`, '_blank')
    } catch {
      toast('Failed to create internal signature', 'error')
    }
  }

  async function addAddendum(contractId: string, title: string, description: string) {
    try {
      const res = await fetch(`/api/contracts/${contractId}/addendums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create addendum', 'error')
        return
      }
      setLocalAddendums(prev => [data, ...prev])
      toast('Addendum created', 'success')
    } catch {
      toast('Failed to create addendum', 'error')
    }
  }

  async function updateAddendumStatus(id: string, status: Addendum['status']) {
    const contractId = localAddendums.find(a => a.id === id)?.contractId
    if (!contractId) return
    try {
      const res = await fetch(`/api/contracts/${contractId}/addendums`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addendumId: id, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to update addendum', 'error')
        return
      }
      setLocalAddendums(prev => prev.map(a => a.id === id ? data : a))
    } catch {
      toast('Failed to update addendum', 'error')
    }
  }

  async function updateContractStatus(id: string, status: ContractStatus) {
    const today = new Date().toISOString().split('T')[0]

    // If sending for signature, email the client first
    if (status === 'Sent') {
      try {
        const emailRes = await fetch('/api/email/send-contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractId: id }),
        })
        if (!emailRes.ok) {
          const err = await emailRes.json()
          alert(`Could not send contract email: ${err.error ?? 'Unknown error'}`)
          return
        }
      } catch {
        alert('Failed to send contract email. Please try again.')
        return
      }
    }

    const patchData = {
      status,
      ...(status === 'Signed by Client' ? { clientSigned: today } : {}),
      ...(status === 'Fully Executed' ? { internalSigned: today } : {}),
    }

    setLocalContracts(prev => prev.map(c => {
      if (c.id !== id) return c
      return { ...c, ...patchData }
    }))
    setSelected(prev => {
      if (!prev || prev.id !== id) return prev
      return { ...prev, ...patchData }
    })

    try {
      await fetch(`/api/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      })
    } catch (err) {
      console.error('Failed to PATCH contract status:', err)
    }
  }

  async function handleNewContract(data: NewContractFormData) {
    const startDate = data.startDate
    const renewalDate = (() => {
      const d = new Date(startDate)
      d.setMonth(d.getMonth() + Number(data.duration))
      return d.toISOString().split('T')[0]
    })()

    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: data.company,
          status: 'Draft',
          value: Number(data.value),
          serviceType: data.serviceType,
          assignedRep: data.assignedRep,
          billingStructure: data.billingStructure,
          duration: Number(data.duration),
          startDate,
          renewalDate,
        }),
      })
      const created = await res.json()
      if (!res.ok) {
        toast(created.error || 'Failed to create contract', 'error')
        return
      }
      setLocalContracts(prev => [created, ...prev])
      setCreatingContract(false)
      toast('Contract created', 'success')
    } catch {
      toast('Failed to create contract', 'error')
    }
  }

  const filtered = statusFilter === 'All' ? localContracts : localContracts.filter(c => c.status === statusFilter)

  const statusCounts = allStatuses.reduce((acc, s) => {
    acc[s] = localContracts.filter(c => c.status === s).length
    return acc
  }, {} as Record<ContractStatus, number>)

  const activeValue = localContracts.filter(c => c.status === 'Fully Executed').reduce((s, c) => s + c.value, 0)
  const pendingSig = localContracts.filter(c => ['Sent', 'Viewed', 'Signed by Client', 'Countersign Needed'].includes(c.status)).length

  const metrics = [
    { label: 'Active Contracts', value: statusCounts['Fully Executed'].toString(), icon: <Shield size={16} />, color: '#22c55e', sub: 'Fully executed' },
    { label: 'Pending Signature', value: pendingSig.toString(), icon: <ScrollText size={16} />, color: '#f59e0b', sub: 'Awaiting sig' },
    { label: 'Total Contract Value', value: formatCurrency(localContracts.reduce((s, c) => s + c.value, 0)), icon: <DollarSign size={16} />, color: '#015035', sub: 'All contracts' },
    { label: 'Executed Value', value: formatCurrency(activeValue), icon: <CheckCircle size={16} />, color: '#3b82f6', sub: 'Fully executed' },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Contracts" subtitle="Track agreements and e-signatures" action={{ label: 'New Contract', onClick: () => setCreatingContract(true) }} />
      <div className="page-content">

        {/* KPI cards */}
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

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0">
              <button onClick={() => setStatusFilter('All')} className={`filter-pill flex-shrink-0 ${statusFilter === 'All' ? 'active' : ''}`}>All</button>
              {allStatuses.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`filter-pill flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-semibold flex-shrink-0">
              {filtered.length} · {formatCurrency(filtered.reduce((s, c) => s + c.value, 0))}
            </span>
          </div>
          <div className="overflow-x-auto table-scroll">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Service</th>
                  <th>Value</th>
                  <th className="hidden md:table-cell">Billing</th>
                  <th className="hidden md:table-cell">Renewal</th>
                  <th className="hidden lg:table-cell">Rep</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelected(c)}>
                    <td>
                      <p className="font-semibold text-gray-900">{c.company}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.id.toUpperCase()}</p>
                    </td>
                    <td><StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} /></td>
                    <td className="hidden sm:table-cell"><StatusBadge label={c.serviceType} colorClass={serviceTypeColors[c.serviceType]} /></td>
                    <td><span className="font-bold text-gray-900">{formatCurrency(c.value)}</span></td>
                    <td className="hidden md:table-cell"><span className="text-gray-600">{c.billingStructure}</span></td>
                    <td className="hidden md:table-cell"><span className="text-gray-500">{formatDate(c.renewalDate)}</span></td>
                    <td className="hidden lg:table-cell"><span className="text-gray-500">{c.assignedRep}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {c.status === 'Draft' && (
                        <button
                          onClick={() => updateContractStatus(c.id, 'Sent')}
                          className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Send
                        </button>
                      )}
                      {c.status === 'Sent' && (
                        <button
                          onClick={() => updateContractStatus(c.id, 'Signed by Client')}
                          className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Client Signed
                        </button>
                      )}
                      {(c.status === 'Signed by Client' || c.status === 'Countersign Needed') && (
                        <button
                          onClick={() => updateContractStatus(c.id, 'Fully Executed')}
                          className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100 transition-colors"
                        >
                          Countersign
                        </button>
                      )}
                      {c.status === 'Fully Executed' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle size={12} /> Executed
                        </span>
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

      {selected && (
        <ContractPanel
          contract={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateContractStatus}
          addendums={localAddendums}
          onAddAddendum={addAddendum}
          onUpdateAddendumStatus={updateAddendumStatus}
          invoices={invoices}
          projects={projects}
          proposals={proposals}
          signatures={signatures}
          onRequestSignature={requestSignature}
          onSignInternally={signInternally}
        />
      )}
      {creatingContract && (
        <NewContractPanel onSave={handleNewContract} onClose={() => setCreatingContract(false)} />
      )}
    </>
  )
}
