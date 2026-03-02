'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { teamMembers } from '@/lib/data'
import {
  Users, Shield, Bell, Palette, Building, Plus, Pencil, Link2,
  CheckCircle, AlertCircle, RefreshCw, Plug, Globe, Tag,
  FolderKanban, MessageSquare, DollarSign, ChevronRight, ExternalLink,
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

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
        <span className="text-sm text-gray-800 flex-1">{value}</span>
        <Pencil size={12} className="text-gray-300" />
      </div>
    </div>
  )
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

const QB_SYNC_DEFAULTS = [
  { label: 'Sync new invoices to QuickBooks automatically', enabled: true },
  { label: 'Pull payment updates from QuickBooks', enabled: true },
  { label: 'Match QB customers to GravHub companies', enabled: true },
  { label: 'Sync overdue flags from QuickBooks', enabled: true },
  { label: 'Create QB invoice when GravHub invoice is sent', enabled: false },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Company')
  const [notifications, setNotifications] = useState(NOTIF_DEFAULTS)
  const [qbSync, setQbSync] = useState(QB_SYNC_DEFAULTS)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [savedTab, setSavedTab] = useState<Tab | null>(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
  const [members, setMembers] = useState(teamMembers)

  function showSaved(tab: Tab) {
    setSavedTab(tab)
    setTimeout(() => setSavedTab(null), 2000)
  }

  function toggleNotif(label: string) {
    setNotifications(prev => prev.map(n => n.label === label ? { ...n, enabled: !n.enabled } : n))
  }

  function toggleQb(label: string) {
    setQbSync(prev => prev.map(n => n.label === label ? { ...n, enabled: !n.enabled } : n))
  }

  async function submitInvite() {
    if (!inviteForm.name || !inviteForm.email) return
    const initials = inviteForm.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    setMembers(prev => [...prev, {
      id: `tm${Date.now()}`,
      name: inviteForm.name,
      email: inviteForm.email,
      role: inviteForm.role as typeof teamMembers[0]['role'],
      unit: inviteForm.unit as typeof teamMembers[0]['unit'],
      initials,
    }])
    // Send invite email
    fetch('/api/email/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        unit: inviteForm.unit,
        invitedBy: 'the GravHub admin',
      }),
    }).catch(() => {/* non-blocking */})
    setInviteForm({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
    setInviteOpen(false)
  }

  function removeMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
  }

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
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Company Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <FieldRow label="Company Name" value="Graviss Marketing" />
              <FieldRow label="Industry" value="Marketing Agency" />
              <FieldRow label="Primary Email" value="info@gravissmarketing.com" />
              <FieldRow label="Phone" value="+1 (830) 326-0320" />
              <FieldRow label="Website" value="www.gravissmarketing.com" />
              <FieldRow label="Timezone" value="America/Chicago (CT)" />
              <FieldRow label="Fiscal Year Start" value="January 1" />
              <FieldRow label="Default Currency" value="USD ($)" />
            </div>
            <h4 className="text-xs font-bold text-gray-600 mb-3 uppercase tracking-wide">Address</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <FieldRow label="Street" value="123 Main St" />
              <FieldRow label="City" value="Kerrville" />
              <FieldRow label="State" value="Texas" />
              <FieldRow label="ZIP" value="78028" />
            </div>
            <button onClick={() => showSaved('Company')} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {savedTab === 'Company' ? <><CheckCircle size={14} /> Saved!</> : 'Save Changes'}
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
                  <h4 className="text-sm font-bold text-gray-800">Invite New Member</h4>
                  <button onClick={() => setInviteOpen(false)} className="text-gray-400 hover:text-gray-600"><AlertCircle size={14} /></button>
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
                </div>
                <div className="flex gap-2">
                  <button onClick={submitInvite} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                    Add Member
                  </button>
                  <button onClick={() => setInviteOpen(false)} className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Team Members ({members.length})</h3>
                <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={13} /> Invite Member
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
                              <button onClick={() => removeMember(member.id)} className="text-xs text-gray-400 hover:text-red-500 font-medium">Remove</button>
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
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Brand Configuration</h3>
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: '#015035' }} />
                  <input className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50" defaultValue="#015035" />
                  <span className="text-xs text-gray-500 hidden sm:inline">Deep Green</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: '#FFF3EA' }} />
                  <input className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50" defaultValue="#FFF3EA" />
                  <span className="text-xs text-gray-500 hidden sm:inline">Soft Tan</span>
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
              <button className="w-fit px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>Save Branding</button>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'Notifications' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Notification Preferences</h3>
              {savedTab === 'Notifications' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
            </div>
            <div className="flex flex-col gap-1">
              {notifications.map(n => (
                <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{n.category}</span>
                  </div>
                  <Toggle enabled={n.enabled} onChange={() => toggleNotif(n.label)} />
                </div>
              ))}
            </div>
            <button onClick={() => showSaved('Notifications')} className="flex items-center gap-2 mt-5 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {savedTab === 'Notifications' ? <><CheckCircle size={14} /> Saved!</> : 'Save Preferences'}
            </button>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'Integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Connected Integrations</h3>
            <div className="flex flex-col gap-3">
              {[
                { name: 'QuickBooks Online', description: 'Sync invoices, payments, and client accounts', status: 'connected', statusLabel: 'Connected', lastSync: '2 hours ago', icon: '🟢', action: 'Manage' },
                { name: 'Google Workspace', description: 'Single sign-on and calendar integration', status: 'connected', statusLabel: 'Active', lastSync: 'Continuous', icon: '🔵', action: 'Manage' },
                { name: 'DocuSign', description: 'E-signature workflow for proposals and contracts', status: 'not_connected', statusLabel: 'Not Connected', lastSync: null, icon: '⚪', action: 'Connect' },
                { name: 'Slack', description: 'Team notifications for deals and project updates', status: 'not_connected', statusLabel: 'Not Connected', lastSync: null, icon: '⚪', action: 'Connect' },
                { name: 'Stripe', description: 'Accept online invoice payments from clients', status: 'not_connected', statusLabel: 'Not Connected', lastSync: null, icon: '⚪', action: 'Connect' },
                { name: 'Zapier', description: 'Connect GravHub to 5,000+ apps with automations', status: 'not_connected', statusLabel: 'Not Connected', lastSync: null, icon: '⚪', action: 'Connect' },
              ].map(integration => (
                <div key={integration.name} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="text-2xl flex-shrink-0">{integration.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{integration.name}</p>
                    <p className="text-xs text-gray-500">{integration.description}</p>
                    {integration.lastSync && (
                      <p className="text-[11px] text-gray-400 mt-0.5">Last sync: {integration.lastSync}</p>
                    )}
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
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Pipeline Stages</h3>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={12} /> Add Stage
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost'].map((stage, i) => (
                  <div key={stage} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                    <span className="text-sm text-gray-800 flex-1 font-medium">{stage}</span>
                    <div className="flex gap-1.5">
                      <button className="text-xs text-gray-400 hover:text-blue-500 transition-colors">Edit</button>
                      <button className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Service Types</h3>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Website', 'SEO', 'Social Media', 'Email Marketing', 'Branding', 'Custom'].map(s => (
                  <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full">
                    <span className="text-xs font-medium text-gray-700">{s}</span>
                    <button className="text-gray-400 hover:text-gray-600"><ChevronRight size={10} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Contact Tags</h3>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: '#015035' }}>
                  <Plus size={12} /> Add Tag
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Decision Maker', 'Executive', 'Signed Client', 'Warm Lead', 'Marketing', 'Healthcare', 'Partner'].map(tag => (
                  <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                    <Tag size={10} className="text-blue-400" />
                    <span className="text-xs font-medium text-blue-700">{tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === 'Billing' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f5e9' }}>
                  <span className="text-xl">🟢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">QuickBooks Online</p>
                  <p className="text-xs text-gray-500 mt-0.5">Graviss Marketing — Connected</p>
                  <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                    <CheckCircle size={11} /> Last synced 2 hours ago · Auto-sync every 15 min
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    <RefreshCw size={11} /> Sync Now
                  </button>
                  <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                    Disconnect
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Clients Synced', value: '12', sub: 'QB customers' },
                  { label: 'Invoices Synced', value: '7', sub: 'All statuses' },
                  { label: 'Payments Synced', value: '5', sub: 'Paid invoices' },
                ].map(stat => (
                  <div key={stat.label} className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{stat.value}</p>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">{stat.label}</p>
                    <p className="text-[11px] text-gray-400">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Sync Settings</h3>
              <div className="flex flex-col gap-1">
                {qbSync.map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 gap-3">
                    <span className="text-sm text-gray-700">{item.label}</span>
                    <Toggle enabled={item.enabled} onChange={() => toggleQb(item.label)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Invoice Defaults</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="Payment Terms" value="Net 7" />
                <FieldRow label="Default Due Days" value="7" />
                <FieldRow label="Invoice Prefix" value="INV-" />
                <FieldRow label="Next Invoice #" value="00008" />
                <FieldRow label="Late Fee %" value="1.5% / month" />
                <FieldRow label="Send Reminders" value="3 days before due" />
              </div>
              <button onClick={() => showSaved('Billing')} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                {savedTab === 'Billing' ? <><CheckCircle size={14} /> Saved!</> : 'Save Invoice Settings'}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
