'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  Users, Shield, Bell, Palette, Building, Plus, Pencil, Link2,
  CheckCircle, AlertCircle, RefreshCw, Plug, Globe, Tag,
  FolderKanban, MessageSquare, DollarSign, ChevronRight, ExternalLink,
  Trash2, X, Eye, EyeOff, AlertTriangle,
} from 'lucide-react'

const membershipColors: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-700',
  Leadership: 'bg-blue-100 text-blue-700',
  'Department Manager': 'bg-indigo-100 text-indigo-700',
  'Team Member': 'bg-gray-100 text-gray-600',
  Contractor: 'bg-yellow-100 text-yellow-700',
  Client: 'bg-green-100 text-green-700',
}

const tabs = ['Company', 'Team', 'Permissions', 'Branding', 'Notifications', 'Integrations', 'CRM Setup', 'Billing'] as const
type Tab = typeof tabs[number]

const tabIcons: Record<Tab, React.ReactNode> = {
  Company: <Building size={15} />,
  Team: <Users size={15} />,
  Permissions: <Shield size={15} />,
  Branding: <Palette size={15} />,
  Notifications: <Bell size={15} />,
  Integrations: <Plug size={15} />,
  'CRM Setup': <Tag size={15} />,
  Billing: <DollarSign size={15} />,
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange?: () => void }) {
  return (
    <button
      onClick={onChange}
      className="rounded-full relative flex items-center px-0.5 transition-colors flex-shrink-0"
      style={{ background: enabled ? '#015035' : '#d1d5db', width: '40px', height: '22px' }}
    >
      <div
        className="w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
        style={{ transform: enabled ? 'translateX(18px)' : 'translateX(0px)' }}
      />
    </button>
  )
}

function EditableField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
      />
    </div>
  )
}

const COMPANY_DEFAULTS = {
  name: 'Graviss Marketing, LLC',
  industry: 'Marketing Agency',
  email: 'info@gravissmarketing.com',
  phone: '+1 (830) 326-0320',
  website: 'www.gravissmarketing.com',
  timezone: 'America/New_York (ET)',
  fiscalYear: 'January 1',
  currency: 'USD ($)',
  street: '',
  city: 'Kerrville',
  state: 'Texas',
  zip: '78028',
}

const NOTIF_DEFAULTS = [
  { label: 'Contract requires signature', enabled: true, category: 'Contracts' },
  { label: 'Contract fully executed', enabled: true, category: 'Contracts' },
  { label: 'Invoice overdue by 3+ days', enabled: true, category: 'Billing' },
  { label: 'Payment received', enabled: true, category: 'Billing' },
  { label: 'Renewal within 90 days', enabled: true, category: 'Renewals' },
  { label: 'Renewal within 30 days', enabled: true, category: 'Renewals' },
  { label: 'New deal created', enabled: false, category: 'CRM' },
  { label: 'Proposal viewed by client', enabled: true, category: 'Proposals' },
  { label: 'Proposal accepted / declined', enabled: true, category: 'Proposals' },
  { label: 'Project milestone completed', enabled: true, category: 'Projects' },
  { label: 'New client ticket submitted', enabled: true, category: 'Tickets' },
  { label: 'Ticket unresponded for 24h', enabled: true, category: 'Tickets' },
  { label: 'Client portal login', enabled: false, category: 'Portal' },
]

const BRANDING_DEFAULTS = {
  primaryColor: '#015035',
  secondaryColor: '#FFF3EA',
}

const QB_SYNC_DEFAULTS = [
  { label: 'Sync new invoices to QuickBooks automatically', enabled: true },
  { label: 'Pull payment updates from QuickBooks', enabled: true },
  { label: 'Match QB customers to GravHub companies', enabled: true },
  { label: 'Sync overdue flags from QuickBooks', enabled: true },
  { label: 'Create QB invoice when GravHub invoice is sent', enabled: false },
]

const INVOICE_DEFAULTS = {
  paymentTerms: 'Net 7',
  dueDays: '7',
  prefix: 'INV-',
  nextNumber: '00010',
  lateFee: '1.5% / month',
  reminders: '3 days before due',
}

const PIPELINE_STAGES_DEFAULT = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']

type PipelineStageConf = { id: string; name: string; color: string }
type PipelineConf = { id: string; name: string; stages: PipelineStageConf[] }
const STAGE_COLORS_CYCLE = ['#9ca3af', '#3b82f6', '#f59e0b', '#f97316', '#22c55e', '#ef4444', '#8b5cf6']
const PIPELINES_DEFAULT: PipelineConf[] = [{
  id: 'sales',
  name: 'Sales Pipeline',
  stages: PIPELINE_STAGES_DEFAULT.map((name, i) => ({ id: `s${i}`, name, color: STAGE_COLORS_CYCLE[i % STAGE_COLORS_CYCLE.length] })),
}]
const SERVICE_TYPES_DEFAULT = ['Website', 'SEO', 'Social Media', 'Email Marketing', 'Branding', 'Custom']
const CONTACT_TAGS_DEFAULT = ['Decision Maker', 'Executive', 'Signed Client', 'Warm Lead', 'Marketing', 'Healthcare', 'Partner']

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { gmailToken, gmailEmail, connectGmail, disconnectGmail, addUser, members: authMembers } = useAuth()
  const searchParams   = useSearchParams()
  const router         = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined' && searchParams.get('tab') === 'integrations') return 'Integrations'
    return 'Company'
  })
  const [saved, setSaved] = useState<string | null>(null)

  // QuickBooks status
  const [qbConnected, setQbConnected]   = useState(false)
  const [qbStatus, setQbStatus]         = useState<{ lastSync: string | null; invoicesSynced: number; paymentsSynced: number; syncErrors: number } | null>(null)
  const [qbSyncing, setQbSyncing]       = useState(false)
  const [qbMessage, setQbMessage]       = useState<string | null>(null)

  const fetchQBStatus = useCallback(() => {
    return fetch('/api/quickbooks/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.connected) {
          setQbConnected(true)
          setQbStatus({ lastSync: d.lastSync, invoicesSynced: d.invoicesSynced, paymentsSynced: d.paymentsSynced, syncErrors: d.syncErrors })
        } else {
          setQbConnected(false)
          setQbStatus(null)
        }
      })
      .catch(() => toast('Failed to load QuickBooks status', 'error'))
  }, [])

  useEffect(() => { fetchQBStatus().finally(() => setLoading(false)) }, [fetchQBStatus])

  // Handle OAuth callback params
  useEffect(() => {
    if (searchParams.get('qb_connected') === 'true') {
      setQbConnected(true)
      fetchQBStatus()
      setQbMessage('QuickBooks connected successfully!')
      setTimeout(() => setQbMessage(null), 4000)
      router.replace('/settings?tab=integrations')
    } else if (searchParams.get('qb_error')) {
      setQbMessage(`Connection failed: ${searchParams.get('qb_error')}`)
      setTimeout(() => setQbMessage(null), 6000)
      router.replace('/settings?tab=integrations')
    }
  }, [searchParams, fetchQBStatus, router])

  function connectQB() {
    window.location.href = '/api/quickbooks/connect'
  }

  async function disconnectQB() {
    await fetch('/api/quickbooks/disconnect', { method: 'POST' })
    setQbConnected(false)
    setQbStatus(null)
  }

  async function syncQB() {
    setQbSyncing(true)
    try {
      const res = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setQbMessage(`Synced ${data.invoicesSynced} invoices, ${data.paymentsSynced} payments`)
        fetchQBStatus()
      } else {
        setQbMessage(`Sync failed: ${data.error}`)
      }
    } catch {
      setQbMessage('Sync failed')
    } finally {
      setQbSyncing(false)
      setTimeout(() => setQbMessage(null), 4000)
    }
  }

  // Company
  const [company, setCompany] = useState(COMPANY_DEFAULTS)

  // Team
  const [members, setMembers] = useState(authMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [showTempPw, setShowTempPw] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Notifications
  const [notifications, setNotifications] = useState(NOTIF_DEFAULTS)

  // Branding
  const [branding, setBranding] = useState(BRANDING_DEFAULTS)

  // QB Sync
  const [qbSync, setQbSync] = useState(QB_SYNC_DEFAULTS)

  // Invoice defaults
  const [invoiceDefaults, setInvoiceDefaults] = useState(INVOICE_DEFAULTS)

  // CRM Setup
  const [pipelines, setPipelines] = useState<PipelineConf[]>(PIPELINES_DEFAULT)
  const [expandedPipelineId, setExpandedPipelineId] = useState<string | null>('sales')
  const [newStageNames, setNewStageNames] = useState<Record<string, string>>({})
  const [newPipelineName, setNewPipelineName] = useState('')
  const [serviceTypes, setServiceTypes] = useState(SERVICE_TYPES_DEFAULT)
  const [contactTags, setContactTags] = useState(CONTACT_TAGS_DEFAULT)
  const [newService, setNewService] = useState('')
  const [newTag, setNewTag] = useState('')

  // Load from API on mount (fall back to localStorage for backwards-compat, then defaults)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.id) {
          setCompany(loadLS('gravhub_company', COMPANY_DEFAULTS))
          setNotifications(loadLS('gravhub_notifications', NOTIF_DEFAULTS))
          setInvoiceDefaults(loadLS('gravhub_invoice_defaults', INVOICE_DEFAULTS))
          setServiceTypes(loadLS('gravhub_service_types', SERVICE_TYPES_DEFAULT))
          setContactTags(loadLS('gravhub_contact_tags', CONTACT_TAGS_DEFAULT))
          setBranding(loadLS('gravhub_branding', BRANDING_DEFAULTS))
          setQbSync(loadLS('gravhub_qb_sync', QB_SYNC_DEFAULTS))
          return
        }
        if (d.company          && Object.keys(d.company).length)           setCompany(d.company)
        if (Array.isArray(d.notifications)   && d.notifications.length)    setNotifications(d.notifications)
        if (d.invoice_defaults && Object.keys(d.invoice_defaults).length)  setInvoiceDefaults(d.invoice_defaults)
        if (Array.isArray(d.pipelines) && d.pipelines.length) setPipelines(d.pipelines)
        else if (Array.isArray(d.pipeline_stages) && d.pipeline_stages.length) setPipelines([{ id: 'sales', name: 'Sales Pipeline', stages: d.pipeline_stages.map((name: string, i: number) => ({ id: `s${i}`, name, color: STAGE_COLORS_CYCLE[i % STAGE_COLORS_CYCLE.length] })) }])
        if (Array.isArray(d.service_types)   && d.service_types.length)    setServiceTypes(d.service_types)
        if (Array.isArray(d.contact_tags)    && d.contact_tags.length)     setContactTags(d.contact_tags)
        if (d.branding         && Object.keys(d.branding).length)          setBranding(d.branding)
        if (Array.isArray(d.qb_sync)         && d.qb_sync.length)          setQbSync(d.qb_sync)
      })
      .catch(() => {
        setCompany(loadLS('gravhub_company', COMPANY_DEFAULTS))
        setNotifications(loadLS('gravhub_notifications', NOTIF_DEFAULTS))
        setInvoiceDefaults(loadLS('gravhub_invoice_defaults', INVOICE_DEFAULTS))
        setServiceTypes(loadLS('gravhub_service_types', SERVICE_TYPES_DEFAULT))
        setContactTags(loadLS('gravhub_contact_tags', CONTACT_TAGS_DEFAULT))
        setBranding(loadLS('gravhub_branding', BRANDING_DEFAULTS))
        setQbSync(loadLS('gravhub_qb_sync', QB_SYNC_DEFAULTS))
      })
  }, [])

  // Keep members in sync with auth
  useEffect(() => { setMembers(authMembers) }, [authMembers])

  function flash(label: string) {
    setSaved(label)
    setTimeout(() => setSaved(null), 2500)
  }

  function patchSettings(payload: Record<string, unknown>, label: string) {
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => toast('Failed to save settings', 'error'))
    flash(label)
  }

  function saveCompany() {
    patchSettings({ company }, 'Company')
  }

  function saveNotifications() {
    patchSettings({ notifications }, 'Notifications')
  }

  function saveInvoiceDefaults() {
    patchSettings({ invoiceDefaults }, 'Billing')
  }

  function saveCRM() {
    const firstPipelineStages = pipelines[0]?.stages.map(s => s.name) ?? []
    patchSettings({ pipelineStages: firstPipelineStages, pipelines, serviceTypes, contactTags }, 'CRM Setup')
  }

  function saveBranding() {
    patchSettings({ branding }, 'Branding')
    // Apply immediately so the change reflects across the app without a reload
    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor)
    document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor)
  }

  function saveQbSync() {
    patchSettings({ qbSync }, 'QB Sync')
  }

  async function submitInvite() {
    if (!inviteForm.name || !inviteForm.email) { setInviteError('Name and email are required.'); return }
    // No password needed — users sign in via magic link
    setInviteError('')
    setInviteSending(true)

    // Add user to auth system
    addUser({
      name: inviteForm.name,
      email: inviteForm.email.toLowerCase().trim(),
      role: inviteForm.role as 'Super Admin' | 'Leadership' | 'Department Manager' | 'Team Member' | 'Contractor' | 'Client',
      unit: inviteForm.unit as 'Sales' | 'Billing/Finance' | 'Delivery/Operations' | 'Leadership/Admin' | 'Contractors' | 'Client',
    })

    // Send invite email
    try {
      await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteForm.name,
          email: inviteForm.email,
          role: inviteForm.role,
          unit: inviteForm.unit,
          invitedBy: 'Jonathan Graviss',
        }),
      })
    } catch { console.warn('Invitation email failed to send') }

    setInviteSending(false)
    setInviteForm({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
    setInviteOpen(false)
    flash('Team')
  }

  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [reassignTo, setReassignTo] = useState('')

  async function confirmRemoveMember() {
    if (!removeTarget) return
    const target = members.find(m => m.id === removeTarget)
    if (!target) return

    try {
      const res = await fetch(`/api/team-members/${removeTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()

      // Reassign deals if a target rep was selected
      if (reassignTo && target.name) {
        await fetch('/api/deals/reassign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromRep: target.name, toRep: reassignTo }),
        }).catch(() => {/* best effort */})
      }

      setMembers(prev => prev.filter(m => m.id !== removeTarget))
      setRemoveTarget(null)
      setReassignTo('')
      toast('Team member removed and deals reassigned', 'success')
    } catch {
      toast('Failed to remove team member', 'error')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Settings" subtitle="Administration and configuration" />
      <div className="p-3 sm:p-6 flex-1">

        {/* Top tab bar */}
        <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab
                    ? 'border-green-800 text-gray-900 bg-green-50/60'
                    : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={activeTab === tab ? 'text-green-800' : 'text-gray-400'}>
                  {tabIcons[tab]}
                </span>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── Company ── */}
        {activeTab === 'Company' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Company Information</h3>
              {saved === 'Company' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <EditableField label="Company Name"     value={company.name}       onChange={v => setCompany(p => ({ ...p, name: v }))} />
              <EditableField label="Industry"          value={company.industry}   onChange={v => setCompany(p => ({ ...p, industry: v }))} />
              <EditableField label="Primary Email"     value={company.email}      onChange={v => setCompany(p => ({ ...p, email: v }))} type="email" />
              <EditableField label="Phone"             value={company.phone}      onChange={v => setCompany(p => ({ ...p, phone: v }))} />
              <EditableField label="Website"           value={company.website}    onChange={v => setCompany(p => ({ ...p, website: v }))} />
              <EditableField label="Timezone"          value={company.timezone}   onChange={v => setCompany(p => ({ ...p, timezone: v }))} />
              <EditableField label="Fiscal Year Start" value={company.fiscalYear} onChange={v => setCompany(p => ({ ...p, fiscalYear: v }))} />
              <EditableField label="Default Currency"  value={company.currency}   onChange={v => setCompany(p => ({ ...p, currency: v }))} />
            </div>
            <h4 className="text-xs font-bold text-gray-600 mb-3 uppercase tracking-wide">Address</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <EditableField label="Street" value={company.street} onChange={v => setCompany(p => ({ ...p, street: v }))} />
              <EditableField label="City"   value={company.city}   onChange={v => setCompany(p => ({ ...p, city: v }))} />
              <EditableField label="State"  value={company.state}  onChange={v => setCompany(p => ({ ...p, state: v }))} />
              <EditableField label="ZIP"    value={company.zip}    onChange={v => setCompany(p => ({ ...p, zip: v }))} />
            </div>
            <button onClick={saveCompany} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Company' ? <><CheckCircle size={14} /> Saved!</> : 'Save Changes'}
            </button>
          </div>
        )}

        {/* ── Team ── */}
        {activeTab === 'Team' && (
          <div className="flex flex-col gap-4">
            {/* Invite form */}
            {inviteOpen && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-800">Add New Member</h4>
                  <button onClick={() => { setInviteOpen(false); setInviteError('') }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                    <input value={inviteForm.name} onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="First Last" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                    <input value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                      type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="email@gravissmarketing.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700">
                      <option>Team Member</option>
                      <option>Department Manager</option>
                      <option>Leadership</option>
                      <option>Contractor</option>
                      <option>Client</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
                    <select value={inviteForm.unit} onChange={e => setInviteForm(p => ({ ...p, unit: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700">
                      <option>Sales</option>
                      <option>Delivery/Operations</option>
                      <option>Billing/Finance</option>
                      <option>Leadership/Admin</option>
                      <option>Contractors</option>
                      <option>Client</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] text-gray-400 mt-1">No password needed — the user will receive a sign-in link via email.</p>
                  </div>
                </div>
                {inviteError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg mb-3">
                    <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                    <span className="text-xs text-red-700">{inviteError}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={submitInvite} disabled={inviteSending} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: '#015035' }}>
                    {inviteSending ? 'Sending…' : 'Add & Send Invite'}
                  </button>
                  <button onClick={() => { setInviteOpen(false); setInviteError('') }} className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Team Members ({members.length})</h3>
                  {saved === 'Team' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Invite sent!</span>}
                </div>
                <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={13} /> Add Member
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-2.5 px-5 font-semibold">Member</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Role</th>
                      <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Unit</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => (
                      <>
                        <tr key={member.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                                {member.initials}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                                <p className="text-xs text-gray-400">{member.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`status-badge ${membershipColors[member.role] ?? 'bg-gray-100 text-gray-600'}`}>{member.role}</span>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell"><span className="text-sm text-gray-600">{member.unit}</span></td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle size={11} /> Active
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button onClick={() => setEditingMember(editingMember === member.id ? null : member.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                                {editingMember === member.id ? 'Done' : 'Edit'}
                              </button>
                              <button onClick={() => setRemoveTarget(member.id)} className="text-xs text-gray-400 hover:text-red-500 font-medium">Remove</button>
                            </div>
                          </td>
                        </tr>
                        {editingMember === member.id && (
                          <tr key={`edit-${member.id}`} className="bg-blue-50/40 border-b border-blue-100">
                            <td colSpan={5} className="px-5 py-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                                  <select
                                    defaultValue={member.role}
                                    onChange={e => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: e.target.value as typeof member.role } : m))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700"
                                  >
                                    <option>Team Member</option>
                                    <option>Department Manager</option>
                                    <option>Leadership</option>
                                    <option>Super Admin</option>
                                    <option>Contractor</option>
                                    <option>Client</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
                                  <select
                                    defaultValue={member.unit}
                                    onChange={e => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, unit: e.target.value as typeof member.unit } : m))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700"
                                  >
                                    <option>Sales</option>
                                    <option>Delivery/Operations</option>
                                    <option>Billing/Finance</option>
                                    <option>Leadership/Admin</option>
                                    <option>Contractors</option>
                                    <option>Client</option>
                                  </select>
                                </div>
                                <button onClick={() => setEditingMember(null)} className="mt-4 px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ background: '#015035' }}>Save</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Permissions ── */}
        {activeTab === 'Permissions' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Permission Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                    {['Super Admin', 'Leadership', 'Dept Mgr', 'Team Member', 'Contractor', 'Client'].map(role => (
                      <th key={role} className="py-2 px-2 font-semibold text-gray-500 text-center uppercase tracking-wide">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { module: 'Dashboard', perms: ['Full', 'Full', 'Full', 'Limited', 'None', 'None'] },
                    { module: 'CRM & Pipeline', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'None'] },
                    { module: 'Proposals', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'None'] },
                    { module: 'Contracts', perms: ['Full', 'Full', 'Summary', 'Summary', 'None', 'Executed'] },
                    { module: 'Billing', perms: ['Full', 'Full', 'Read', 'None', 'None', 'Own'] },
                    { module: 'Projects', perms: ['Full', 'Full', 'Full', 'Assigned', 'Assigned', 'Portal'] },
                    { module: 'Tickets', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'Own'] },
                    { module: 'Reports', perms: ['Full', 'Full', 'Unit', 'None', 'None', 'None'] },
                    { module: 'Settings', perms: ['Full', 'Read', 'Limited', 'None', 'None', 'None'] },
                  ].map(row => (
                    <tr key={row.module} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-semibold text-gray-700">{row.module}</td>
                      {row.perms.map((perm, i) => (
                        <td key={i} className="py-2.5 px-2 text-center">
                          <span className={`status-badge ${
                            perm === 'Full' ? 'bg-green-100 text-green-700'
                            : perm === 'None' ? 'bg-gray-100 text-gray-400'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}>{perm}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Branding ── */}
        {activeTab === 'Branding' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Brand Configuration</h3>
              {saved === 'Branding' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
            </div>
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.primaryColor }} />
                  <input
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                    value={branding.primaryColor}
                    onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))}
                  />
                  <input type="color" value={branding.primaryColor} onChange={e => setBranding(p => ({ ...p, primaryColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.secondaryColor }} />
                  <input
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                    value={branding.secondaryColor}
                    onChange={e => setBranding(p => ({ ...p, secondaryColor: e.target.value }))}
                  />
                  <input type="color" value={branding.secondaryColor} onChange={e => setBranding(p => ({ ...p, secondaryColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Heading Font</label>
                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800" style={{ fontFamily: 'var(--font-syncopate), sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Syncopate — GRAVHUB
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Body Font</label>
                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
                  Montserrat — The unified internal operating system for Graviss Marketing
                </div>
              </div>
              <button onClick={saveBranding} className="w-fit flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                {saved === 'Branding' ? <><CheckCircle size={14} /> Saved!</> : 'Save Branding'}
              </button>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'Notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Notification Preferences</h3>
              {saved === 'Notifications' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
            </div>
            <div className="flex flex-col gap-1">
              {notifications.map(n => (
                <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{n.category}</span>
                  </div>
                  <Toggle enabled={n.enabled} onChange={() => setNotifications(prev => prev.map(x => x.label === n.label ? { ...x, enabled: !x.enabled } : x))} />
                </div>
              ))}
            </div>
            <button onClick={saveNotifications} className="flex items-center gap-2 mt-5 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Notifications' ? <><CheckCircle size={14} /> Saved!</> : 'Save Preferences'}
            </button>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'Integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Connected Integrations</h3>
            <div className="flex flex-col gap-3">
              {/* Gmail — live connect/disconnect */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="text-2xl flex-shrink-0">✉️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">Gmail</p>
                  <p className="text-xs text-gray-500">Read your inbox and log emails directly as CRM activities</p>
                  {gmailEmail && <p className="text-[11px] text-gray-400 mt-0.5">Connected as: {gmailEmail}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[11px] font-semibold hidden sm:flex items-center gap-0.5 ${gmailToken ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {gmailToken ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                    {gmailToken ? 'Connected' : 'Not Connected'}
                  </span>
                  {gmailToken ? (
                    <button onClick={disconnectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors">Disconnect</button>
                  ) : (
                    <button onClick={connectGmail} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors" style={{ background: '#015035' }}>Connect</button>
                  )}
                </div>
              </div>

              {/* QuickBooks row */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="text-2xl flex-shrink-0">{qbConnected ? '🟢' : '⚪'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">QuickBooks Online</p>
                  <p className="text-xs text-gray-500">Sync invoices, payments, and client accounts</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[11px] font-semibold hidden sm:flex items-center gap-0.5 ${qbConnected ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {qbConnected ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                    {qbConnected ? 'Connected' : 'Not Connected'}
                  </span>
                  {qbConnected ? (
                    <button onClick={disconnectQB} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-200 transition-colors">
                      Disconnect
                    </button>
                  ) : (
                    <button onClick={connectQB} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors" style={{ background: '#015035' }}>
                      Connect
                    </button>
                  )}
                </div>
              </div>

              {[
                { name: 'Google Workspace', description: 'Single sign-on and calendar integration', status: 'connected', statusLabel: 'Active', icon: '🔵', action: 'Manage' },
                { name: 'DocuSign', description: 'E-signature workflow for proposals and contracts', status: 'not_connected', statusLabel: 'Not Connected', icon: '⚪', action: 'Connect' },
                { name: 'Slack', description: 'Team notifications for deals and project updates', status: 'not_connected', statusLabel: 'Not Connected', icon: '⚪', action: 'Connect' },
                { name: 'Stripe', description: 'Accept online invoice payments from clients', status: 'not_connected', statusLabel: 'Not Connected', icon: '⚪', action: 'Connect' },
                { name: 'Zapier', description: 'Connect GravHub to 5,000+ apps with automations', status: 'not_connected', statusLabel: 'Not Connected', icon: '⚪', action: 'Connect' },
              ].map(integration => (
                <div key={integration.name} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="text-2xl flex-shrink-0">{integration.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{integration.name}</p>
                    <p className="text-xs text-gray-500">{integration.description}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[11px] font-semibold hidden sm:flex items-center gap-0.5 ${integration.status === 'connected' ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {integration.status === 'connected' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {integration.statusLabel}
                    </span>
                    <button
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        integration.status === 'connected'
                          ? 'border border-gray-200 text-gray-600 hover:bg-gray-200'
                          : 'text-white'
                      }`}
                      style={integration.status !== 'connected' ? { background: '#015035' } : undefined}
                    >
                      {integration.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CRM Setup ── */}
        {activeTab === 'CRM Setup' && (
          <div className="flex flex-col gap-4">
            {/* Pipelines (multi-pipeline) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Pipelines</h3>
                <span className="text-xs text-gray-400">{pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''}</span>
              </div>

              {pipelines.map(pipeline => (
                <div key={pipeline.id} className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
                  <button
                    onClick={() => setExpandedPipelineId(expandedPipelineId === pipeline.id ? null : pipeline.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FolderKanban size={13} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-800">{pipeline.name}</span>
                      <span className="text-xs text-gray-400">({pipeline.stages.length} stages)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {pipelines.length > 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); setPipelines(prev => prev.filter(p => p.id !== pipeline.id)) }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <ChevronRight size={13} className={`text-gray-400 transition-transform ${expandedPipelineId === pipeline.id ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expandedPipelineId === pipeline.id && (
                    <div className="p-4 border-t border-gray-100">
                      <div className="flex flex-col gap-1.5 mb-3">
                        {pipeline.stages.map((stage, i) => (
                          <div key={stage.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                            <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                            <span className="text-sm text-gray-800 flex-1 font-medium">{stage.name}</span>
                            <button
                              onClick={() => setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, stages: p.stages.filter(s => s.id !== stage.id) } : p))}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={newStageNames[pipeline.id] ?? ''}
                          onChange={e => setNewStageNames(prev => ({ ...prev, [pipeline.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const name = (newStageNames[pipeline.id] ?? '').trim()
                              if (!name) return
                              setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, stages: [...p.stages, { id: `s_${Date.now()}`, name, color: STAGE_COLORS_CYCLE[p.stages.length % STAGE_COLORS_CYCLE.length] }] } : p))
                              setNewStageNames(prev => ({ ...prev, [pipeline.id]: '' }))
                            }
                          }}
                          placeholder="New stage name…"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                        />
                        <button
                          onClick={() => {
                            const name = (newStageNames[pipeline.id] ?? '').trim()
                            if (!name) return
                            setPipelines(prev => prev.map(p => p.id === pipeline.id ? { ...p, stages: [...p.stages, { id: `s_${Date.now()}`, name, color: STAGE_COLORS_CYCLE[p.stages.length % STAGE_COLORS_CYCLE.length] }] } : p))
                            setNewStageNames(prev => ({ ...prev, [pipeline.id]: '' }))
                          }}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-medium"
                          style={{ background: '#015035' }}
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <input
                  value={newPipelineName}
                  onChange={e => setNewPipelineName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newPipelineName.trim()) {
                      const id = `pipeline_${Date.now()}`
                      setPipelines(prev => [...prev, { id, name: newPipelineName.trim(), stages: [] }])
                      setExpandedPipelineId(id)
                      setNewPipelineName('')
                    }
                  }}
                  placeholder="New pipeline name…"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                />
                <button
                  onClick={() => {
                    if (!newPipelineName.trim()) return
                    const id = `pipeline_${Date.now()}`
                    setPipelines(prev => [...prev, { id, name: newPipelineName.trim(), stages: [] }])
                    setExpandedPipelineId(id)
                    setNewPipelineName('')
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-medium"
                  style={{ background: '#015035' }}
                >
                  <Plus size={12} /> Add Pipeline
                </button>
              </div>
            </div>

            {/* Service Types */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Service Types</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {serviceTypes.map(s => (
                  <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full">
                    <span className="text-xs font-medium text-gray-700">{s}</span>
                    <button onClick={() => setServiceTypes(prev => prev.filter(x => x !== s))} className="text-gray-400 hover:text-red-500"><X size={10} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newService} onChange={e => setNewService(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newService.trim()) { setServiceTypes(p => [...p, newService.trim()]); setNewService('') }}}
                  placeholder="New service type…" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" />
                <button onClick={() => { if (newService.trim()) { setServiceTypes(p => [...p, newService.trim()]); setNewService('') }}} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Contact Tags */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Contact Tags</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {contactTags.map(tag => (
                  <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                    <Tag size={10} className="text-blue-400" />
                    <span className="text-xs font-medium text-blue-700">{tag}</span>
                    <button onClick={() => setContactTags(prev => prev.filter(x => x !== tag))} className="text-blue-300 hover:text-red-500"><X size={10} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setContactTags(p => [...p, newTag.trim()]); setNewTag('') }}}
                  placeholder="New tag…" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" />
                <button onClick={() => { if (newTag.trim()) { setContactTags(p => [...p, newTag.trim()]); setNewTag('') }}} className="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            <button onClick={saveCRM} className="w-fit flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'CRM Setup' ? <><CheckCircle size={14} /> Saved!</> : 'Save CRM Settings'}
            </button>
          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === 'Billing' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              {qbMessage && (
                <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs font-medium ${qbMessage.includes('failed') || qbMessage.includes('Failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {qbMessage}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: qbConnected ? '#e8f5e9' : '#f3f4f6' }}>
                  <span className="text-xl">{qbConnected ? '🟢' : '⚪'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">QuickBooks Online</p>
                  {qbConnected ? (
                    <>
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">Connected · Syncing automatically</p>
                      {qbStatus?.lastSync && (
                        <p className="text-[11px] text-gray-400 mt-0.5">Last sync: {new Date(qbStatus.lastSync).toLocaleString()}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mt-0.5">Not connected</p>
                      <p className="flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                        <AlertCircle size={11} /> Connect QuickBooks to sync invoices and payments
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {qbConnected ? (
                    <>
                      <button onClick={syncQB} disabled={qbSyncing} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-60" style={{ background: '#015035' }}>
                        <RefreshCw size={12} className={qbSyncing ? 'animate-spin' : ''} /> {qbSyncing ? 'Syncing…' : 'Sync Now'}
                      </button>
                      <button onClick={disconnectQB} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button onClick={connectQB} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ background: '#015035' }}>
                      Connect QuickBooks
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Invoice Defaults</h3>
                {saved === 'Billing' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Payment Terms"    value={invoiceDefaults.paymentTerms} onChange={v => setInvoiceDefaults(p => ({ ...p, paymentTerms: v }))} />
                <EditableField label="Default Due Days" value={invoiceDefaults.dueDays}      onChange={v => setInvoiceDefaults(p => ({ ...p, dueDays: v }))} />
                <EditableField label="Invoice Prefix"   value={invoiceDefaults.prefix}       onChange={v => setInvoiceDefaults(p => ({ ...p, prefix: v }))} />
                <EditableField label="Next Invoice #"   value={invoiceDefaults.nextNumber}   onChange={v => setInvoiceDefaults(p => ({ ...p, nextNumber: v }))} />
                <EditableField label="Late Fee %"       value={invoiceDefaults.lateFee}      onChange={v => setInvoiceDefaults(p => ({ ...p, lateFee: v }))} />
                <EditableField label="Send Reminders"   value={invoiceDefaults.reminders}    onChange={v => setInvoiceDefaults(p => ({ ...p, reminders: v }))} />
              </div>
              <button onClick={saveInvoiceDefaults} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                {saved === 'Billing' ? <><CheckCircle size={14} /> Saved!</> : 'Save Invoice Settings'}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>QB Sync Settings</h3>
                {saved === 'QB Sync' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
              </div>
              <div className="flex flex-col gap-1">
                {qbSync.map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-3">
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <Toggle enabled={item.enabled} onChange={() => setQbSync(prev => prev.map(x => x.label === item.label ? { ...x, enabled: !x.enabled } : x))} />
                  </div>
                ))}
              </div>
              <button onClick={saveQbSync} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                {saved === 'QB Sync' ? <><CheckCircle size={14} /> Saved!</> : 'Save QB Sync Settings'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Remove team member modal with deal reassignment */}
      {removeTarget && (() => {
        const target = members.find(m => m.id === removeTarget)
        if (!target) return null
        const otherReps = members.filter(m => m.id !== removeTarget).map(m => m.name)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={18} className="text-red-500" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Remove {target.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2 ml-12">
                  This will remove their account and reassign all of their deals to the rep you choose below.
                </p>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Reassign deals to
                  </label>
                  <select
                    value={reassignTo}
                    onChange={e => setReassignTo(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select a team member...</option>
                    {otherReps.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <p className="text-xs font-semibold text-red-600">This change cannot be undone.</p>
              </div>

              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={confirmRemoveMember}
                  disabled={!reassignTo}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  Remove & Reassign Deals
                </button>
                <button
                  onClick={() => { setRemoveTarget(null); setReassignTo('') }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </>
  )
}
