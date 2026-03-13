'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, projectStatusColors, invoiceStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  Globe, CheckCircle, FolderKanban, FileText, MessageSquare,
  Download, Upload, Bell, ChevronDown, ChevronRight, X, AlertTriangle, LogOut,
} from 'lucide-react'

export default function ClientPortalPage() {
  const { user, logout } = useAuth()
  const company = user?.company ?? ''
  const contactName = user?.name ?? ''

  const [activeTab, setActiveTab] = useState<'overview' | 'project' | 'billing' | 'tickets' | 'files'>('overview')
  const [showWelcome, setShowWelcome] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [project, setProject] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientInvoices, setClientInvoices] = useState<any[]>([])
  const [accountInfo, setAccountInfo] = useState<{ service: string } | null>(null)
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState(false)

  useEffect(() => {
    if (!company) return
    const q = encodeURIComponent(company)
    fetch(`/api/projects?company=${q}`).then(r => r.json()).then((d: unknown[]) => setProject(d[0] ?? null)).catch(() => {})
    fetch(`/api/contracts?company=${q}`).then(r => r.json()).then((d: unknown[]) => setContract(d[0] ?? null)).catch(() => {})
    fetch(`/api/invoices?company=${q}`).then(r => r.json()).then(setClientInvoices).catch(() => {})
    fetch('/api/portal-clients').then(r => r.json()).then((clients: { company: string; service: string }[]) => {
      const match = clients.find(c => c.company === company)
      if (match) setAccountInfo({ service: match.service })
    }).catch(() => {})
  }, [company])

  const openInvoices = clientInvoices.filter(i => i.status !== 'Paid')
  const paidInvoices = clientInvoices.filter(i => i.status === 'Paid')

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f8fafc' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-sm" style={{ background: '#012b1e' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
            {company[0]}
          </div>
          <div>
            <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{company}</p>
            <p className="text-white/50 text-[11px]">{accountInfo?.service ?? 'Client Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
            <Bell size={16} className="text-white/60" />
            {openInvoices.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />
            )}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              {contactName.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-white/80 text-xs font-medium hidden sm:block">{contactName}</span>
            <ChevronDown size={12} className="text-white/40" />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white text-xs font-medium"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex-shrink-0 flex gap-1 px-3 sm:px-6 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto">
        {([
          { id: 'overview', label: 'Overview',    icon: <Globe size={13} /> },
          { id: 'project',  label: 'My Project',  icon: <FolderKanban size={13} /> },
          { id: 'billing',  label: `Billing${openInvoices.length > 0 ? ` (${openInvoices.length})` : ''}`, icon: <FileText size={13} /> },
          { id: 'tickets',  label: 'Support',     icon: <MessageSquare size={13} /> },
          { id: 'files',    label: 'Files',        icon: <Download size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 pb-2.5 text-xs font-semibold border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-green-800 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            {showWelcome && (
              <div className="flex items-start gap-3 p-4 rounded-xl border mb-2" style={{ background: '#012b1e', borderColor: '#015035' }}>
                <div>
                  <p className="text-white font-bold text-sm mb-1">Welcome to your client portal!</p>
                  <p className="text-white/70 text-xs leading-relaxed">Track your project progress, view invoices, submit support requests, and access shared files. Questions? Reply to any email from us or use the Support tab.</p>
                </div>
                <button onClick={() => setShowWelcome(false)} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 mt-0.5">
                  <X size={14} className="text-white/50" />
                </button>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome back, {contactName.split(' ')[0]}!</h2>
              <p className="text-sm text-gray-500">Here&apos;s a snapshot of your account with Graviss Marketing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {project && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban size={14} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Active Project</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">{project.serviceType}</p>
                  <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-bold" style={{ color: '#015035' }}>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#015035' }} />
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('project')} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    View details <ChevronRight size={11} />
                  </button>
                </div>
              )}

              {contract && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Contract</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">{contract.serviceType} Agreement</p>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Value</span><span className="font-bold text-gray-800">{formatCurrency(contract.value)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="text-gray-700">{contract.billingStructure}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Renewal</span><span className="text-gray-700">{formatDate(contract.renewalDate)}</span></div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={14} style={{ color: '#015035' }} />
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Billing</p>
                </div>
                {openInvoices.length > 0 ? (
                  <>
                    <p className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(openInvoices.reduce((s, i) => s + i.amount, 0))}
                    </p>
                    <p className="text-xs text-orange-600 font-medium mb-3">{openInvoices.length} invoice{openInvoices.length > 1 ? 's' : ''} outstanding</p>
                    <button onClick={() => setActiveTab('billing')} className="w-full py-2 rounded-xl text-white text-xs font-semibold" style={{ background: '#015035' }}>
                      View Invoices
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-emerald-600 mb-1">All paid up!</p>
                    <p className="text-xs text-gray-400">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''} on file</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Project */}
        {activeTab === 'project' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {project ? (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{project.serviceType} Project</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Launch: {formatDate(project.launchDate)}</p>
                    </div>
                    <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500 font-medium">Overall Progress</span>
                      <span className="font-bold" style={{ color: '#015035' }}>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${project.progress}%`, background: '#015035' }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Milestones</h3>
                  <div className="flex flex-col gap-2">
                    {project.milestones.map((m: { id: string; name: string; dueDate: string; completed: boolean }) => (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={m.completed ? { background: '#015035' } : { background: '#e5e7eb' }}>
                          {m.completed && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-semibold ${m.completed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.name}</p>
                          <p className="text-[11px] text-gray-400">{formatDate(m.dueDate)}</p>
                        </div>
                        {m.completed && <span className="text-[11px] text-emerald-600 font-semibold">Complete</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <FolderKanban size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No active project yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Billing */}
        {activeTab === 'billing' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {openInvoices.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">{formatCurrency(openInvoices.reduce((s, i) => s + i.amount, 0))} outstanding</p>
                  <p className="text-xs text-orange-600">{openInvoices.length} invoice{openInvoices.length > 1 ? 's' : ''} awaiting payment</p>
                </div>
                <span className="text-xs font-semibold text-orange-700">Payment due</span>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Invoice History</h3>
              </div>
              {clientInvoices.length > 0 ? (
                <div className="flex flex-col divide-y divide-gray-100">
                  {clientInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                        <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                        <button className="text-xs text-gray-400 hover:text-gray-600"><Download size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">No invoices yet</div>
              )}
            </div>
          </div>
        )}

        {/* Support */}
        {activeTab === 'tickets' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Submit a Request</h3>
              <p className="text-xs text-gray-400 mb-4">Have a question or need a change? Send us a message.</p>
              {ticketSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <CheckCircle size={24} className="mx-auto mb-2 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">Request submitted!</p>
                  <p className="text-xs text-emerald-600 mt-1">Our team will get back to you shortly.</p>
                  <button onClick={() => { setTicketSuccess(false); setTicketSubject(''); setTicketMessage('') }} className="mt-3 text-xs text-emerald-700 underline">Submit another</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    value={ticketSubject}
                    onChange={e => setTicketSubject(e.target.value)}
                    placeholder="Subject / brief description..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                  />
                  <textarea
                    value={ticketMessage}
                    onChange={e => setTicketMessage(e.target.value)}
                    placeholder="Describe your request in detail..."
                    rows={4}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      disabled={ticketSubmitting || !ticketSubject.trim()}
                      onClick={async () => {
                        setTicketSubmitting(true)
                        try {
                          const res = await fetch('/api/tickets', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              subject: ticketSubject.trim(),
                              company,
                              contactName,
                              contactEmail: user?.email ?? '',
                              source: 'Portal',
                              messages: ticketMessage.trim() ? [{ from: contactName, body: ticketMessage.trim(), date: new Date().toISOString() }] : [],
                            }),
                          })
                          if (res.ok) setTicketSuccess(true)
                        } finally {
                          setTicketSubmitting(false)
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                      style={{ background: '#015035' }}
                    >
                      {ticketSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files */}
        {activeTab === 'files' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Shared Files & Documents</h3>
                <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-lg">
                  <Upload size={12} /> Upload
                </button>
              </div>
              <div className="py-12 text-center text-gray-400 text-sm">No files shared yet</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
