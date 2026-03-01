'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { projects, contracts, renewals, invoices } from '@/lib/data'
import { formatCurrency, projectStatusColors, serviceTypeColors, invoiceStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  Globe, Lock, Eye, CheckCircle, Calendar, RefreshCw, FolderKanban,
  ChevronDown, X, AlertTriangle, FileText, MessageSquare, Bell,
  ArrowLeft, Settings, LogOut, ChevronRight, Upload, Download,
} from 'lucide-react'

// ─── Client data ──────────────────────────────────────────────────────────────

const CLIENT_ACCOUNTS = [
  { company: 'Coastal Realty',    service: 'Website',        access: 'Active',    lastLogin: '2 days ago',  contact: 'Dana Kim' },
  { company: 'BlueStar Logistics', service: 'SEO',            access: 'Active',    lastLogin: '1 week ago',  contact: 'Kelly Shaw' },
  { company: 'Harvest Foods',     service: 'Email Marketing', access: 'Active',    lastLogin: '3 days ago',  contact: 'Frank Lopez' },
  { company: 'Apex Solutions',    service: 'Website',         access: 'Invited',   lastLogin: 'Never',       contact: 'Marcus Rivera' },
  { company: 'Summit Capital',    service: 'Custom',          access: 'Not Setup', lastLogin: 'Never',       contact: 'Tanya Reeves' },
]

function getClientData(company: string) {
  const project  = projects.find(p => p.company === company)
  const contract = contracts.find(c => c.company === company)
  const renewal  = renewals.find(r => r.company === company)
  const clientInvoices = invoices.filter(i => i.company === company)
  return { project, contract, renewal, invoices: clientInvoices }
}

// ─── Client Portal View ───────────────────────────────────────────────────────

function ClientPortalView({ company, onExit }: { company: string; onExit: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'project' | 'billing' | 'tickets' | 'files'>('overview')
  const { project, contract, renewal, invoices: clientInvoices } = getClientData(company)
  const accountInfo = CLIENT_ACCOUNTS.find(c => c.company === company)
  const openInvoices = clientInvoices.filter(i => i.status !== 'Paid')
  const paidInvoices = clientInvoices.filter(i => i.status === 'Paid')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f8fafc' }}>

      {/* Admin preview banner */}
      <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100 border-b border-amber-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-amber-600" />
          <span>Previewing client portal as <strong>{company}</strong> — this is what your client sees</span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 transition-colors text-amber-900"
        >
          <ArrowLeft size={12} /> Exit Preview
        </button>
      </div>

      {/* Client portal header */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between shadow-sm" style={{ background: '#012b1e' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: '#015035' }}>
            {company[0]}
          </div>
          <div>
            <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{company}</p>
            <p className="text-white/50 text-[11px]">{accountInfo?.service} · Active Client</p>
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
              {accountInfo?.contact.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-white/80 text-xs font-medium">{accountInfo?.contact}</span>
            <ChevronDown size={12} className="text-white/40" />
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex-shrink-0 flex gap-1 px-6 pt-3 pb-0 border-b border-gray-200 bg-white">
        {([
          { id: 'overview', label: 'Overview', icon: <Globe size={13} /> },
          { id: 'project',  label: 'My Project', icon: <FolderKanban size={13} /> },
          { id: 'billing',  label: `Billing${openInvoices.length > 0 ? ` (${openInvoices.length})` : ''}`, icon: <FileText size={13} /> },
          { id: 'tickets',  label: 'Support', icon: <MessageSquare size={13} /> },
          { id: 'files',    label: 'Files', icon: <Download size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
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
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome back, {accountInfo?.contact.split(' ')[0]}!</h2>
              <p className="text-sm text-gray-500">Here's a snapshot of your account with Graviss Marketing.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project card */}
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
                  <button
                    onClick={() => setActiveTab('project')}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    View details <ChevronRight size={11} />
                  </button>
                </div>
              )}

              {/* Contract card */}
              {contract && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={14} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Contract</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">{contract.serviceType} Agreement</p>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Value</span>
                      <span className="font-bold text-gray-800">{formatCurrency(contract.value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Billing</span>
                      <span className="text-gray-700">{contract.billingStructure}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Renewal</span>
                      <span className="text-gray-700">{formatDate(contract.renewalDate)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance card */}
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
                    <button
                      onClick={() => setActiveTab('billing')}
                      className="w-full py-2 rounded-xl text-white text-xs font-semibold"
                      style={{ background: '#015035' }}
                    >
                      Pay Now
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

            {/* Recent activity */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Updates</h3>
              <div className="flex flex-col gap-3">
                {[
                  { msg: 'Your project is 75% complete — on track for launch', time: '2 days ago', type: 'project' },
                  { msg: 'Invoice #INV-2024-007 was generated for March', time: '5 days ago', type: 'billing' },
                  { msg: 'Milestone "Content Revisions" marked complete', time: '1 week ago', type: 'project' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#e6f0ec' }}>
                      {item.type === 'project'
                        ? <FolderKanban size={11} style={{ color: '#015035' }} />
                        : <FileText size={11} style={{ color: '#015035' }} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-700">{item.msg}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Project ── */}
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
                    {project.milestones.map((m, i) => (
                      <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl ${m.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${m.completed ? '' : 'bg-gray-200'}`}
                          style={m.completed ? { background: '#015035' } : {}}>
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

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Your Team</h3>
                  <div className="flex flex-wrap gap-2">
                    {project.assignedTeam.map(name => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                          {name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs font-medium text-gray-700">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <FolderKanban size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No active project for this client.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === 'billing' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {openInvoices.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">
                    {formatCurrency(openInvoices.reduce((s, i) => s + i.amount, 0))} outstanding
                  </p>
                  <p className="text-xs text-orange-600">{openInvoices.length} invoice{openInvoices.length > 1 ? 's' : ''} awaiting payment</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: '#015035' }}>
                  Pay Now
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Invoice History</h3>
              </div>
              {clientInvoices.length > 0 ? (
                <div className="flex flex-col divide-y divide-gray-100">
                  {clientInvoices.map(inv => (
                    <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                      <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                      {inv.status !== 'Paid' && (
                        <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors">
                          Pay
                        </button>
                      )}
                      <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        <Download size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">No invoices yet</div>
              )}
            </div>
          </div>
        )}

        {/* ── Tickets / Support ── */}
        {activeTab === 'tickets' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Submit a Request</h3>
              <p className="text-xs text-gray-400 mb-4">Have a question or need a change? Send us a message.</p>
              <div className="flex flex-col gap-3">
                <input
                  placeholder="Subject / brief description..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                />
                <textarea
                  placeholder="Describe your request in detail..."
                  rows={4}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
                />
                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                    <Upload size={12} /> Attach file
                  </button>
                  <button className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
                    Submit Request
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Recent Requests</h3>
              </div>
              <div className="flex flex-col divide-y divide-gray-100">
                {[
                  { subject: 'Homepage hero image needs to be updated', status: 'Open', date: 'Feb 25' },
                  { subject: 'Email campaign — wrong link in footer CTA', status: 'Resolved', date: 'Feb 20' },
                ].filter(t => t.status !== 'Closed').map((t, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{t.subject}</p>
                      <p className="text-xs text-gray-400">{t.date}</p>
                    </div>
                    <StatusBadge
                      label={t.status}
                      colorClass={t.status === 'Open' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}
                    />
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Files ── */}
        {activeTab === 'files' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Shared Files & Documents</h3>
                <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors border border-gray-200 px-2.5 py-1.5 rounded-lg">
                  <Upload size={12} /> Upload
                </button>
              </div>
              <div className="flex flex-col divide-y divide-gray-100">
                {[
                  { name: 'Website_Design_Mockups_v3.pdf', size: '4.2 MB', date: 'Feb 20', type: 'Design' },
                  { name: 'Project_Scope_Agreement.pdf', size: '1.1 MB', date: 'Jan 15', type: 'Contract' },
                  { name: 'Brand_Assets_Package.zip', size: '18.4 MB', date: 'Jan 10', type: 'Assets' },
                  { name: 'Q1_Analytics_Report.pdf', size: '2.8 MB', date: 'Mar 1', type: 'Report' },
                ].map((file, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{file.size} · {file.date}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{file.type}</span>
                    <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100">
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

export default function PortalPage() {
  const [viewAsClient, setViewAsClient] = useState(false)
  const [previewCompany, setPreviewCompany] = useState(CLIENT_ACCOUNTS[0].company)

  if (viewAsClient) {
    return <ClientPortalView company={previewCompany} onExit={() => setViewAsClient(false)} />
  }

  return (
    <>
      <Header title="Client Portal" subtitle="Client-facing view configuration and access" action={{ label: 'Invite Client' }} />
      <div className="p-6 flex-1">

        {/* View as Client panel */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#e6f0ec' }}>
              <Eye size={16} style={{ color: '#015035' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">View as Client</p>
              <p className="text-xs text-gray-500">Preview the exact experience your client sees in their portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={previewCompany}
              onChange={e => setPreviewCompany(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {CLIENT_ACCOUNTS.filter(c => c.access === 'Active').map(c => (
                <option key={c.company} value={c.company}>{c.company}</option>
              ))}
            </select>
            <button
              onClick={() => setViewAsClient(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              <Eye size={14} /> Enter Client View
            </button>
          </div>
        </div>

        {/* Portal Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Client Accounts', value: CLIENT_ACCOUNTS.filter(c => c.access === 'Active').length.toString(), icon: <Globe size={16} />, color: '#015035' },
            { label: 'Portal Logins This Month', value: '12', icon: <Eye size={16} />, color: '#3b82f6' },
            { label: 'Invitations Pending', value: CLIENT_ACCOUNTS.filter(c => c.access === 'Invited').length.toString(), icon: <Lock size={16} />, color: '#f59e0b' },
          ].map(m => (
            <div key={m.label} className="metric-card flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs text-gray-500 font-medium">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Client List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Client Portal Accounts</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Contact</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Portal Access</th>
                <th className="text-left py-2.5 px-4 font-semibold">Last Login</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {CLIENT_ACCOUNTS.map(client => (
                <tr key={client.company} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                        {client.company[0]}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{client.company}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-600">{client.contact}</p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={client.service} colorClass={serviceTypeColors[client.service as keyof typeof serviceTypeColors] ?? 'bg-gray-100 text-gray-600'} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      label={client.access}
                      colorClass={
                        client.access === 'Active' ? 'bg-green-100 text-green-700' :
                        client.access === 'Invited' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{client.lastLogin}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {client.access === 'Active' && (
                        <button
                          onClick={() => { setPreviewCompany(client.company); setViewAsClient(true) }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Eye size={11} /> Preview
                        </button>
                      )}
                      {client.access === 'Invited' && (
                        <button className="text-xs text-orange-600 hover:text-orange-700 font-medium">Resend Invite</button>
                      )}
                      {client.access === 'Not Setup' && (
                        <button className="text-xs text-gray-600 hover:text-gray-700 font-medium">Setup Access</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
