'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { formatCurrency, projectStatusColors, serviceTypeColors, invoiceStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import {
  Globe, Lock, Eye, CheckCircle, Calendar, RefreshCw, FolderKanban,
  ChevronDown, X, AlertTriangle, FileText, MessageSquare, Bell,
  ArrowLeft, Settings, LogOut, ChevronRight, Upload, Download, Trash2,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// ─── Client data ──────────────────────────────────────────────────────────────

type PortalClient = { id: string; company: string; service: string; access: string; lastLogin: string; contact: string; email: string }

// ─── Add Client Panel ─────────────────────────────────────────────────────────

function AddClientPanel({ onClose, onSave, onInvite }: { onClose: () => void; onSave: (client: PortalClient) => void; onInvite: (client: PortalClient, tempPassword?: string) => Promise<void> }) {
  const [company, setCompany] = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState('Website')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const canSave = company.trim() !== '' && contact.trim() !== '' && email.trim() !== ''

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/portal-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          contact: contact.trim(),
          email: email.trim(),
          service,
          access: 'Not Setup',
          lastLogin: new Date().toISOString().split('T')[0],
        }),
      })
      if (!res.ok) {
        setError('Failed to add client. Please try again.')
        setSaving(false)
        return
      }
      const json = await res.json()
      const newClient: PortalClient = json
      onSave(newClient)
      await onInvite(newClient, json.tempPassword)
      setSaved(true)
      setSavedCount(n => n + 1)
      setSaving(false)
    } catch {
      setError('Failed to add client. Please try again.')
      setSaving(false)
    }
  }

  function handleAddAnother() {
    setCompany('')
    setContact('')
    setEmail('')
    setService('Website')
    setError('')
    setSaved(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-full max-w-md flex flex-col shadow-2xl pointer-events-auto" style={{ background: '#f8fafc' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: '#012b1e' }}>
          <h2 className="text-sm font-bold text-white">Add Client to Portal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Company Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Corp"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Primary Contact Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Jane Smith"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Contact Email <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@acme.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Service Type</label>
            <select
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option>Website</option>
              <option>SEO</option>
              <option>Social Media</option>
              <option>Branding</option>
              <option>Email Marketing</option>
              <option>Custom</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
          {saved ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle size={13} /> Client added &amp; invite sent{savedCount > 1 ? ` · ${savedCount} total added` : ''}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={handleAddAnother}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{ background: '#015035' }}
                >
                  Add Another Client
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: '#015035' }}
                >
                  {saving ? 'Adding…' : 'Add Client'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Client Portal View ───────────────────────────────────────────────────────

function ClientPortalView({ company, accountInfo, onExit }: { company: string; accountInfo: PortalClient | undefined; onExit: () => void }) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'overview' | 'project' | 'billing' | 'tickets' | 'files'>('overview')
  const [showWelcome, setShowWelcome] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [project, setProject]         = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract]       = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientInvoices, setClientInvoices] = useState<any[]>([])

  useEffect(() => {
    const q = encodeURIComponent(company)
    fetch(`/api/projects?company=${q}`).then(r => r.json()).then((d: unknown[]) => setProject(d[0] ?? null)).catch(() => toast('Failed to load project data', 'error'))
    fetch(`/api/contracts?company=${q}`).then(r => r.json()).then((d: unknown[]) => setContract(d[0] ?? null)).catch(() => toast('Failed to load contract data', 'error'))
    fetch(`/api/invoices?company=${q}`).then(r => r.json()).then(setClientInvoices).catch(() => toast('Failed to load invoices', 'error'))
  }, [company])
  const openInvoices = clientInvoices.filter(i => i.status !== 'Paid')
  const paidInvoices = clientInvoices.filter(i => i.status === 'Paid')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f8fafc' }}>

      {/* Admin preview banner */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100 border-b border-amber-300 flex-shrink-0">
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
      <div className="flex-shrink-0 px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-sm" style={{ background: '#012b1e' }}>
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
      <div className="flex-shrink-0 flex gap-1 px-3 sm:px-6 pt-3 pb-0 border-b border-gray-200 bg-white overflow-x-auto">
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

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">

            {/* Welcome banner */}
            {accountInfo && accountInfo.access === 'Active' && showWelcome && (
              <div className="flex items-start gap-3 p-4 rounded-xl border mb-2" style={{ background: '#012b1e', borderColor: '#015035' }}>
                <div>
                  <p className="text-white font-bold text-sm mb-1">Welcome to Graviss Marketing!</p>
                  <p className="text-white/70 text-xs leading-relaxed">We&apos;re thrilled to have you on board. This is your client portal where you can track your project progress, view invoices, submit support requests, and access shared files. If you have any questions, don&apos;t hesitate to reach out!</p>
                </div>
                <button onClick={() => setShowWelcome(false)} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 mt-0.5">
                  <X size={14} className="text-white/50" />
                </button>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome back, {accountInfo?.contact.split(' ')[0]}!</h2>
              <p className="text-sm text-gray-500">Here&apos;s a snapshot of your account with Graviss Marketing.</p>
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
                    {project.milestones.map((m: {id:string;name:string;dueDate:string;completed:boolean}, i: number) => (
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
                    {project.assignedTeam.map((name: string) => (
                      <div key={name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                          {name.split(' ').map((n: string) => n[0]).join('')}
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
                    <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{inv.id.toUpperCase()}</p>
                        <p className="text-xs text-gray-400">Issued {formatDate(inv.issuedDate)} · Due {formatDate(inv.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                        <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                        {inv.status !== 'Paid' && (
                          <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors">
                            Pay
                          </button>
                        )}
                        <button
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          title="Download invoice"
                          onClick={() => {
                            const w = window.open('', '_blank', 'width=600,height=700')
                            if (!w) return
                            w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.id.toUpperCase()}</title><style>body{font-family:'Montserrat',Arial,sans-serif;margin:40px;color:#1a1a1a}
.header{background:#012b1e;color:#fff;padding:28px 32px;border-radius:10px 10px 0 0}.header h1{margin:0 0 4px;font-size:20px}.header p{margin:0;font-size:12px;opacity:.6}
.body{border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:28px 32px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px}
.row:last-of-type{border-bottom:none}.label{color:#6b7280}.value{font-weight:600;color:#111827}.amount{font-size:28px;font-weight:800;color:#015035;text-align:center;padding:20px 0 10px}
.badge{text-align:center;margin:16px 0 0}.badge span{display:inline-block;border:4px solid ${inv.status === 'Paid' ? '#015035' : '#f59e0b'};color:${inv.status === 'Paid' ? '#015035' : '#f59e0b'};font-size:28px;font-weight:900;letter-spacing:.2em;padding:6px 24px;border-radius:6px;transform:rotate(-8deg);opacity:.85}
@media print{body{margin:0}}</style></head><body>
<div class="header"><h1>GravHub Invoice</h1><p>${inv.id.toUpperCase()}</p></div>
<div class="body"><div class="amount">$${Number(inv.amount).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
<div class="row"><span class="label">Company</span><span class="value">${company}</span></div>
<div class="row"><span class="label">Status</span><span class="value">${inv.status}</span></div>
<div class="row"><span class="label">Issued</span><span class="value">${inv.issuedDate ?? '—'}</span></div>
<div class="row"><span class="label">Due Date</span><span class="value">${inv.dueDate ?? '—'}</span></div>
${inv.paidDate ? `<div class="row"><span class="label">Paid Date</span><span class="value">${inv.paidDate}</span></div>` : ''}
<div class="badge"><span>${inv.status === 'Paid' ? 'PAID' : inv.status.toUpperCase()}</span></div></div>
<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`)
                            w.document.close()
                          }}
                        >
                          <Download size={13} />
                        </button>
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
                    <button
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                      onClick={() => toast(`Download for "${file.name}" is not yet available`, 'info')}
                    >
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
  const { toast } = useToast()
  const [viewAsClient, setViewAsClient] = useState(false)
  const [clients, setClients] = useState<PortalClient[]>([])
  const [previewCompany, setPreviewCompany] = useState('')
  const [inviteStatus, setInviteStatus] = useState<Record<string, string>>({})
  const [addingClient, setAddingClient] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showLoginList, setShowLoginList] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal-clients')
      .then(r => r.json())
      .then((data: PortalClient[]) => {
        setClients(data)
        if (data.length > 0) setPreviewCompany(data.find(c => c.access === 'Active')?.company ?? data[0].company)
      })
      .catch(() => toast('Failed to load portal clients', 'error'))
      .finally(() => setLoading(false))
  }, [])

  // Clients who logged in during the current calendar month
  const thisMonthPrefix = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const loggedInThisMonth = clients.filter(c => c.lastLogin && c.lastLogin.startsWith(thisMonthPrefix))

  async function sendPortalInvite(client: PortalClient, isResend = false) {
    setInviteStatus(prev => ({ ...prev, [client.company]: 'sending' }))
    try {
      const res = await fetch('/api/email/portal-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: client.company,
          contactName: client.contact,
          email: client.email,
          service: client.service,
          isResend,
        }),
      })
      if (res.ok) {
        setInviteStatus(prev => ({ ...prev, [client.company]: 'sent' }))
      } else {
        const json = await res.json().catch(() => ({}))
        const msg = (json.error as string) || 'Failed to send'
        setInviteStatus(prev => ({ ...prev, [client.company]: msg }))
      }
      if (res.ok && client.access === 'Not Setup') {
        setClients(prev => prev.map(c => c.company === client.company ? { ...c, access: 'Invited' } : c))
        await fetch(`/api/portal-clients/${client.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access: 'Invited' }),
        })
      }
      setTimeout(() => setInviteStatus(prev => { const n = { ...prev }; delete n[client.company]; return n }), 4000)
    } catch {
      setInviteStatus(prev => ({ ...prev, [client.company]: 'Send failed' }))
    }
  }

  async function deleteClient(id: string) {
    await fetch(`/api/portal-clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
    setDeleteConfirm(null)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  if (viewAsClient) {
    return <ClientPortalView company={previewCompany} accountInfo={clients.find(c => c.company === previewCompany)} onExit={() => setViewAsClient(false)} />
  }

  return (
    <>
      <Header title="Client Portal" subtitle="Client-facing view configuration and access" action={{ label: 'Add Client', onClick: () => setAddingClient(true) }} />
      <div className="p-3 sm:p-6 flex-1">

        {/* View as Client panel */}
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e6f0ec' }}>
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
              {clients.filter(c => c.access === 'Active').map(c => (
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
            { label: 'Active Client Accounts', value: clients.filter(c => c.access === 'Active').length.toString(), icon: <Globe size={16} />, color: '#015035', onClick: undefined },
            { label: 'Portal Logins This Month', value: loggedInThisMonth.length.toString(), icon: <Eye size={16} />, color: '#3b82f6', onClick: () => setShowLoginList(true) },
            { label: 'Invitations Pending', value: clients.filter(c => c.access === 'Invited').length.toString(), icon: <Lock size={16} />, color: '#f59e0b', onClick: undefined },
          ].map(m => (
            <div
              key={m.label}
              className={`metric-card flex items-center gap-4${m.onClick ? ' cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              onClick={m.onClick}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs font-medium" style={{ color: m.onClick ? m.color : '#6b7280' }}>{m.label}{m.onClick ? ' →' : ''}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Portal Logins modal */}
        {showLoginList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowLoginList(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
                <div>
                  <h2 className="text-white text-sm font-bold">Portal Logins This Month</h2>
                  <p className="text-white/50 text-[11px] mt-0.5">{loggedInThisMonth.length} client{loggedInThisMonth.length !== 1 ? 's' : ''} logged in · {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>
                <button onClick={() => setShowLoginList(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X size={16} className="text-white/60" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                {loggedInThisMonth.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <Eye size={28} className="text-gray-300 mb-3" />
                    <p className="text-sm font-semibold text-gray-500">No portal logins yet this month</p>
                    <p className="text-xs text-gray-400 mt-1">Logins will appear here as clients access their portals.</p>
                  </div>
                ) : loggedInThisMonth.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {c.company[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.company}</p>
                      <p className="text-xs text-gray-500">{c.contact} · {c.service}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-blue-600">Last login</p>
                      <p className="text-xs text-gray-500">{new Date(c.lastLogin + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-500">{clients.filter(c => c.access === 'Active').length - loggedInThisMonth.length} active client{clients.filter(c => c.access === 'Active').length - loggedInThisMonth.length !== 1 ? 's' : ''} have not logged in this month</p>
                <button onClick={() => setShowLoginList(false)} className="text-xs font-semibold text-gray-600 hover:text-gray-800">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Client List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Client Portal Accounts</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Contact</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Portal Access</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Last Login</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.company} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                        {client.company[0]}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{client.company}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    <p className="text-sm text-gray-600">{client.contact}</p>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
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
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-xs text-gray-500">{client.lastLogin}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {inviteStatus[client.company] === 'sending' && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" /> Sending…
                        </span>
                      )}
                      {inviteStatus[client.company] === 'sent' && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle size={11} /> Sent!
                        </span>
                      )}
                      {inviteStatus[client.company] && inviteStatus[client.company] !== 'sending' && inviteStatus[client.company] !== 'sent' && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <AlertTriangle size={11} /> {inviteStatus[client.company].slice(0, 40)}
                        </span>
                      )}
                      {!inviteStatus[client.company] && (
                        <>
                          {client.access === 'Active' && (
                            <button
                              onClick={() => { setPreviewCompany(client.company); setViewAsClient(true) }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                              <Eye size={11} /> Preview
                            </button>
                          )}
                          {client.access === 'Invited' && (
                            <button
                              onClick={() => sendPortalInvite(client, true)}
                              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                            >
                              Resend Invite
                            </button>
                          )}
                          {client.access === 'Not Setup' && (
                            <button
                              onClick={() => sendPortalInvite(client, false)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg text-white"
                              style={{ background: '#015035' }}
                            >
                              Send Invite
                            </button>
                          )}
                        </>
                      )}
                      {deleteConfirm === client.id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <span className="text-xs text-gray-500">Delete?</span>
                          <button
                            onClick={() => deleteClient(client.id)}
                            className="text-xs text-white px-2 py-0.5 rounded font-semibold bg-red-500 hover:bg-red-600"
                          >Yes</button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-1"
                          >No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(client.id)}
                          className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors ml-1"
                          title="Delete client"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {addingClient && (
        <AddClientPanel
          onClose={() => setAddingClient(false)}
          onSave={newClient => setClients(prev => [...prev, newClient])}
          onInvite={(client) => sendPortalInvite(client, false)}
        />
      )}
    </>
  )
}
