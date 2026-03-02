'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import {
  ShieldCheck, Users, Settings, BarChart3, FileKey, ScrollText,
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Plus, Pencil,
  Trash2, Eye, EyeOff, Lock, Globe, Zap, CreditCard, Database,
  Activity, Bell, Building, Download, Upload, Key, ToggleLeft,
  ToggleRight, Server, Wifi, Clock,
} from 'lucide-react'
import { teamMembers, deals, contracts, invoices, projects, dashboardMetrics } from '@/lib/data'
import { formatCurrency } from '@/lib/utils'

type AdminTab = 'overview' | 'users' | 'integrations' | 'permissions' | 'config' | 'audit'

const tabList: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
  { id: 'users', label: 'Users & Roles', icon: <Users size={14} /> },
  { id: 'integrations', label: 'Integrations', icon: <Zap size={14} /> },
  { id: 'permissions', label: 'Permissions', icon: <FileKey size={14} /> },
  { id: 'config', label: 'Platform Config', icon: <Settings size={14} /> },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText size={14} /> },
]

const membershipColors: Record<string, string> = {
  'Super Admin': 'bg-amber-100 text-amber-700',
  Leadership: 'bg-blue-100 text-blue-700',
  'Department Manager': 'bg-indigo-100 text-indigo-700',
  'Team Member': 'bg-gray-100 text-gray-600',
  Contractor: 'bg-yellow-100 text-yellow-700',
  Client: 'bg-green-100 text-green-700',
}

const auditLog = [
  { id: 'al1', user: 'Jonathan Graviss', action: 'Admin panel accessed', module: 'Admin', time: 'Just now', type: 'info' },
  { id: 'al2', user: 'Marcus Webb', action: 'Contract CON2 sent for signature', module: 'Contracts', time: '2 hours ago', type: 'action' },
  { id: 'al3', user: 'Tyler Ross', action: 'Invoice INV2 marked as paid — $22,500', module: 'Billing', time: '3 hours ago', type: 'success' },
  { id: 'al4', user: 'System', action: 'Automation triggered: Renewal alert for ProVenture LLC', module: 'Automation', time: '4 hours ago', type: 'warning' },
  { id: 'al5', user: 'Sarah Chen', action: 'New deal created: Summit Capital ($52,000)', module: 'CRM', time: '5 hours ago', type: 'action' },
  { id: 'al6', user: 'Jordan Ellis', action: 'Milestone completed: Discovery & Strategy', module: 'Projects', time: '1 day ago', type: 'success' },
  { id: 'al7', user: 'System', action: 'QuickBooks sync completed — 7 invoices synced', module: 'Integrations', time: '1 day ago', type: 'success' },
  { id: 'al8', user: 'Amanda Foster', action: 'User permissions updated for Marcus Webb', module: 'Admin', time: '2 days ago', type: 'warning' },
  { id: 'al9', user: 'Jonathan Graviss', action: 'DocuSign integration connected', module: 'Integrations', time: '3 days ago', type: 'success' },
  { id: 'al10', user: 'Priya Patel', action: 'Project PR1 status updated to In Progress', module: 'Projects', time: '3 days ago', type: 'action' },
]

const auditColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600',
  action: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
}

// Extended user list for admin
const allUsers = [
  { id: 'u0', name: 'Jonathan Graviss', email: 'jonathan@gravissmarketing.com', role: 'Super Admin', unit: 'Leadership/Admin', status: 'Active', lastLogin: 'Just now', initials: 'JG', isAdmin: true },
  { id: 'u6', name: 'Amanda Foster', email: 'amanda@gravissmarketing.com', role: 'Leadership', unit: 'Leadership/Admin', status: 'Active', lastLogin: '2 hours ago', initials: 'AF', isAdmin: false },
  { id: 'u1', name: 'Sarah Chen', email: 'sarah@gravissmarketing.com', role: 'Department Manager', unit: 'Sales', status: 'Active', lastLogin: '1 day ago', initials: 'SC', isAdmin: false },
  { id: 'u2', name: 'Marcus Webb', email: 'marcus@gravissmarketing.com', role: 'Team Member', unit: 'Sales', status: 'Active', lastLogin: '5 hours ago', initials: 'MW', isAdmin: false },
  { id: 'u3', name: 'Jordan Ellis', email: 'jordan@gravissmarketing.com', role: 'Team Member', unit: 'Delivery/Operations', status: 'Active', lastLogin: '3 days ago', initials: 'JE', isAdmin: false },
  { id: 'u4', name: 'Priya Patel', email: 'priya@gravissmarketing.com', role: 'Department Manager', unit: 'Delivery/Operations', status: 'Active', lastLogin: '1 day ago', initials: 'PP', isAdmin: false },
  { id: 'u5', name: 'Tyler Ross', email: 'tyler@gravissmarketing.com', role: 'Team Member', unit: 'Billing/Finance', status: 'Active', lastLogin: '2 days ago', initials: 'TR', isAdmin: false },
]

function SystemHealthRow({ label, status, detail }: { label: string; status: 'ok' | 'warn' | 'error'; detail: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2.5">
        {status === 'ok' && <CheckCircle size={14} className="text-emerald-500" />}
        {status === 'warn' && <AlertTriangle size={14} className="text-amber-500" />}
        {status === 'error' && <XCircle size={14} className="text-red-500" />}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className={`text-xs font-medium ${status === 'ok' ? 'text-emerald-600' : status === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
        {detail}
      </span>
    </div>
  )
}

function IntegrationCard({
  name, description, status, logo, lastSync, actions,
}: {
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
  logo: string
  lastSync?: string
  actions: string[]
}) {
  const [enabled, setEnabled] = useState(status === 'connected')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gray-50 border border-gray-100 font-bold text-gray-700">
            {logo}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{name}</p>
            <span className={`status-badge text-[10px] ${
              status === 'connected' ? 'bg-green-100 text-green-700' :
              status === 'error' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {status === 'connected' ? '● Connected' : status === 'error' ? '● Error' : '○ Not Connected'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-11 h-6 rounded-full relative transition-colors flex items-center px-0.5 flex-shrink-0`}
          style={{ background: enabled ? '#015035' : '#d1d5db', width: '42px', height: '24px' }}
        >
          <div
            className="w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
            style={{ transform: enabled ? 'translateX(18px)' : 'translateX(0px)' }}
          />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{description}</p>

      {lastSync && status === 'connected' && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <RefreshCw size={11} />
          <span>Last sync: {lastSync}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {actions.map((action) => (
          <span key={action} className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            {action}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        {status === 'connected' ? (
          <>
            <button className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
              Configure
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw size={12} />
            </button>
          </>
        ) : (
          <button className="flex-1 py-1.5 text-xs font-semibold text-white rounded-lg" style={{ background: '#015035' }}>
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [users, setUsers] = useState(allUsers)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'Team Member', unit: 'Sales' })
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({})

  async function sendInviteEmail(name: string, email: string, role: string, unit: string, tempPassword: string) {
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, unit, invitedBy: user?.name, tempPassword }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async function sendResetEmail(targetUser: typeof allUsers[0]) {
    setEmailStatus(prev => ({ ...prev, [targetUser.id]: 'sending' }))
    try {
      const res = await fetch('/api/email/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetUser.name, email: targetUser.email, resetBy: user?.name }),
      })
      setEmailStatus(prev => ({ ...prev, [targetUser.id]: res.ok ? 'sent' : 'error' }))
      setTimeout(() => setEmailStatus(prev => { const n = { ...prev }; delete n[targetUser.id]; return n }), 4000)
    } catch {
      setEmailStatus(prev => ({ ...prev, [targetUser.id]: 'error' }))
    }
    setResetConfirm(null)
  }

  async function submitAddUser() {
    if (!addForm.name || !addForm.email) return
    const initials = addForm.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    const newUser = {
      id: `u${Date.now()}`,
      name: addForm.name,
      email: addForm.email,
      role: addForm.role,
      unit: addForm.unit,
      status: 'Active',
      lastLogin: 'Never',
      initials,
      isAdmin: false,
    }
    setUsers(prev => [...prev, newUser])
    // Send invite email in background
    if (addForm.email) {
      sendInviteEmail(addForm.name, addForm.email, addForm.role, addForm.unit, addForm.password || 'Welcome1!')
    }
    setAddForm({ name: '', email: '', password: '', role: 'Team Member', unit: 'Sales' })
    setShowAddUser(false)
  }

  function deactivateUser(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u))
  }

  // Guard: only Super Admin
  if (!user?.isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldCheck size={40} className="text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-700 mb-1">Access Denied</h2>
          <p className="text-gray-500 text-sm mb-4">You need Super Admin privileges to access this page.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: '#015035' }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header title="Admin Panel" subtitle={`Super Admin • ${user.name}`} />
      <div className="p-4 md:p-6 flex-1">

        {/* Admin Banner */}
        <div className="flex items-center gap-3 p-4 rounded-xl mb-5 border border-amber-200" style={{ background: '#fffbeb' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b' }}>
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900">Super Admin Mode</p>
            <p className="text-xs text-amber-700">You have full control over GravHub. All actions are logged.</p>
          </div>
          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg flex-shrink-0">
            {user.email}
          </span>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {tabList.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                tab === t.id
                  ? 'text-white border-transparent'
                  : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'
              }`}
              style={{ background: tab === t.id ? '#015035' : undefined }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* KPIs */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Users', value: allUsers.length.toString(), color: '#015035', icon: <Users size={16} /> },
                { label: 'Active Contracts', value: contracts.filter(c => c.status === 'Fully Executed').length.toString(), color: '#3b82f6', icon: <ScrollText size={16} /> },
                { label: 'Pipeline Value', value: formatCurrency(dashboardMetrics.pipelineValue), color: '#f59e0b', icon: <BarChart3 size={16} /> },
                { label: 'MRR', value: formatCurrency(dashboardMetrics.mrr), color: '#8b5cf6', icon: <CreditCard size={16} /> },
                { label: 'Open Projects', value: dashboardMetrics.activeProjects.toString(), color: '#ec4899', icon: <Activity size={16} /> },
                { label: 'Integrations', value: '2 Active', color: '#14b8a6', icon: <Zap size={16} /> },
              ].map(m => (
                <div key={m.label} className="metric-card">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${m.color}18` }}>
                    <span style={{ color: m.color }}>{m.icon}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{m.value}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">{m.label}</p>
                </div>
              ))}
            </div>

            {/* System Health */}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-3">
                <Server size={15} style={{ color: '#015035' }} />
                <h3 className="text-sm font-bold text-gray-800">System Health</h3>
                <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">ALL SYSTEMS GO</span>
              </div>
              <SystemHealthRow label="Authentication" status="ok" detail="Operational" />
              <SystemHealthRow label="Database" status="ok" detail="Healthy" />
              <SystemHealthRow label="QuickBooks Sync" status="ok" detail="Synced 1h ago" />
              <SystemHealthRow label="DocuSign API" status="ok" detail="Connected" />
              <SystemHealthRow label="Email Delivery" status="ok" detail="Active" />
              <SystemHealthRow label="Automation Engine" status="ok" detail="7 flows active" />
              <SystemHealthRow label="Overdue Invoices" status="warn" detail="1 overdue" />
              <SystemHealthRow label="Expiring Contracts" status="warn" detail="2 in 30 days" />
            </div>

            {/* Quick Actions */}
            <div className="metric-card">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Admin Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Add User', icon: <Plus size={14} />, action: () => setShowAddUser(true) },
                  { label: 'Export Data', icon: <Download size={14} />, action: () => {} },
                  { label: 'Import Data', icon: <Upload size={14} />, action: () => {} },
                  { label: 'Reset Passwords', icon: <Key size={14} />, action: () => {} },
                  { label: 'Clear Cache', icon: <RefreshCw size={14} />, action: () => {} },
                  { label: 'System Backup', icon: <Database size={14} />, action: () => {} },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 hover:border-green-700 hover:bg-green-50 transition-all text-sm text-gray-700"
                  >
                    <span style={{ color: '#015035' }}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Audit */}
            <div className="metric-card lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800">Recent Activity</h3>
                <button onClick={() => setTab('audit')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</button>
              </div>
              <div className="flex flex-col gap-2">
                {auditLog.slice(0, 5).map(entry => (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <span className={`status-badge flex-shrink-0 mt-0.5 ${auditColors[entry.type]}`}>{entry.module}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800">{entry.action}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{entry.user} · {entry.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div>
            {/* Add user form */}
            {showAddUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800">Invite New User</h3>
                  <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
                    <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="First Last" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                    <input value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                      type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="email@gravissmarketing.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temp Password</label>
                    <input value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                      type="password" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="Temporary password" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                    <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700">
                      <option>Team Member</option>
                      <option>Department Manager</option>
                      <option>Leadership</option>
                      <option>Contractor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
                    <select value={addForm.unit} onChange={e => setAddForm(p => ({ ...p, unit: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700">
                      <option>Sales</option>
                      <option>Delivery/Operations</option>
                      <option>Billing/Finance</option>
                      <option>Leadership/Admin</option>
                      <option>Contractors</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => submitAddUser()} className="px-4 py-2 text-white text-sm font-medium rounded-lg" style={{ background: '#015035' }}>
                    Add User &amp; Send Invite Email
                  </button>
                  <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-gray-600 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">All Platform Users ({users.length})</h3>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg"
                  style={{ background: '#015035' }}
                >
                  <Plus size={13} /> Invite User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-2.5 px-5 font-semibold">User</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Role</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Unit</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Last Login</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <>
                        <tr key={u.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${u.status === 'Inactive' ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: u.isAdmin ? '#f59e0b' : '#015035' }}
                              >
                                {u.initials}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                                <p className="text-xs text-gray-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`status-badge ${membershipColors[u.role] || 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">{u.unit}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`status-badge ${u.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.status}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={11} />
                              {u.lastLogin}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {u.id !== 'u0' && (
                                <>
                                  <button
                                    onClick={() => setEditingUser(editingUser === u.id ? null : u.id)}
                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"
                                    title="Edit user"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setResetConfirm(resetConfirm === u.id ? null : u.id)}
                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"
                                    title="Reset password"
                                  >
                                    <Key size={13} />
                                  </button>
                                  <button
                                    onClick={() => deactivateUser(u.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${u.status === 'Active' ? 'hover:bg-red-50 text-red-400' : 'hover:bg-green-50 text-green-500'}`}
                                    title={u.status === 'Active' ? 'Deactivate user' : 'Reactivate user'}
                                  >
                                    {u.status === 'Active' ? <Trash2 size={13} /> : <CheckCircle size={13} />}
                                  </button>
                                </>
                              )}
                              {u.id === 'u0' && (
                                <span className="text-xs text-amber-600 font-semibold">Owner</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editingUser === u.id && (
                          <tr key={`edit-${u.id}`} className="bg-blue-50/40 border-b border-blue-100">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="flex flex-wrap items-end gap-3">
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                                  <select
                                    defaultValue={u.role}
                                    onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: e.target.value } : x))}
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
                                    defaultValue={u.unit}
                                    onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, unit: e.target.value } : x))}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700"
                                  >
                                    <option>Sales</option>
                                    <option>Delivery/Operations</option>
                                    <option>Billing/Finance</option>
                                    <option>Leadership/Admin</option>
                                    <option>Contractors</option>
                                  </select>
                                </div>
                                <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ background: '#015035' }}>
                                  Save Changes
                                </button>
                                <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {resetConfirm === u.id && (
                          <tr key={`reset-${u.id}`} className="bg-amber-50/40 border-b border-amber-100">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                                <span className="text-xs text-gray-700">Send password reset email to <strong>{u.email}</strong>?</span>
                                <button
                                  onClick={() => sendResetEmail(u)}
                                  disabled={emailStatus[u.id] === 'sending'}
                                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60"
                                  style={{ background: '#f59e0b' }}
                                >
                                  {emailStatus[u.id] === 'sending' ? 'Sending…' : 'Send Reset Email'}
                                </button>
                                <button onClick={() => setResetConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {emailStatus[u.id] === 'sent' && (
                          <tr key={`sent-${u.id}`} className="bg-green-50/40 border-b border-green-100">
                            <td colSpan={6} className="px-5 py-2">
                              <span className="flex items-center gap-2 text-xs text-green-700 font-medium">
                                <CheckCircle size={12} /> Reset email sent to {u.email}
                              </span>
                            </td>
                          </tr>
                        )}
                        {emailStatus[u.id] === 'error' && (
                          <tr key={`err-${u.id}`} className="bg-red-50/40 border-b border-red-100">
                            <td colSpan={6} className="px-5 py-2">
                              <span className="flex items-center gap-2 text-xs text-red-600 font-medium">
                                <AlertTriangle size={12} /> Failed to send email — check RESEND_API_KEY in .env.local
                              </span>
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

        {/* ── INTEGRATIONS ── */}
        {tab === 'integrations' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Platform Integrations</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect GravHub to your external tools</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  2 Connected
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <IntegrationCard
                name="QuickBooks Online"
                description="Sync invoices, payments, and revenue data with QuickBooks. Automatic two-way sync for billing records, client accounts, and revenue reporting."
                status="connected"
                logo="QB"
                lastSync="1 hour ago"
                actions={['Invoice Sync', 'Payment Sync', 'Client Sync', 'Revenue Reports']}
              />
              <IntegrationCard
                name="DocuSign"
                description="Send contracts for legally binding e-signatures directly from GravHub. Track signature status, get completion notifications, and auto-archive signed documents."
                status="connected"
                logo="DS"
                lastSync="3 hours ago"
                actions={['E-Signatures', 'Contract Sending', 'Status Tracking', 'Auto-Archive']}
              />
              <IntegrationCard
                name="Stripe"
                description="Accept online payments and automate billing collections. Sync payment status back to GravHub invoice records in real time."
                status="disconnected"
                logo="ST"
                actions={['Online Payments', 'Auto-Billing', 'Payment Links', 'Refunds']}
              />
              <IntegrationCard
                name="HubSpot"
                description="Bi-directional CRM sync between GravHub and HubSpot. Import contacts, export deals, and keep both systems in sync."
                status="disconnected"
                logo="HS"
                actions={['Contact Sync', 'Deal Sync', 'Email Tracking', 'Lead Import']}
              />
              <IntegrationCard
                name="Slack"
                description="Get real-time notifications in Slack for key events — new deals, signed contracts, paid invoices, and project milestones."
                status="disconnected"
                logo="SL"
                actions={['Deal Alerts', 'Contract Alerts', 'Invoice Alerts', 'Project Updates']}
              />
              <IntegrationCard
                name="Google Workspace"
                description="SSO login via Google, Gmail integration for logged communications, and Google Drive for file attachments on deals and projects."
                status="disconnected"
                logo="GW"
                actions={['SSO Login', 'Gmail Sync', 'Drive Storage', 'Calendar Sync']}
              />
            </div>

            {/* QuickBooks Config Detail */}
            <div className="mt-5 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">QB</div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">QuickBooks Configuration</h3>
                  <p className="text-xs text-green-600 font-medium">● Connected • Syncing automatically</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Invoices Synced', value: '7', icon: <CheckCircle size={13} className="text-green-500" /> },
                  { label: 'Payments Synced', value: '5', icon: <CheckCircle size={13} className="text-green-500" /> },
                  { label: 'Sync Errors', value: '0', icon: <CheckCircle size={13} className="text-green-500" /> },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl">
                    {s.icon}
                    <div>
                      <p className="text-base font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg" style={{ background: '#015035' }}>
                  <RefreshCw size={12} /> Sync Now
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Settings size={12} /> Settings
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Activity size={12} /> Sync Log
                </button>
              </div>
            </div>

            {/* DocuSign Config Detail */}
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-yellow-50 border border-yellow-100 flex items-center justify-center font-bold text-yellow-700 text-sm">DS</div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">DocuSign Configuration</h3>
                  <p className="text-xs text-green-600 font-medium">● Connected • eSignature API active</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Envelopes Sent', value: '6', sub: 'This month', color: 'text-blue-500' },
                  { label: 'Completed', value: '3', sub: 'Fully signed', color: 'text-green-500' },
                  { label: 'Pending', value: '3', sub: 'Awaiting signature', color: 'text-amber-500' },
                ].map(s => (
                  <div key={s.label} className="p-3 bg-gray-50 rounded-xl">
                    <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs font-medium text-gray-700">{s.label}</p>
                    <p className="text-[11px] text-gray-400">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">Signature Workflow</p>
                <p className="text-xs text-blue-700">
                  When a contract is sent from GravHub, DocuSign automatically creates an envelope, sends to the client, and updates the contract status when signed. Internal countersign notification is sent automatically.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg" style={{ background: '#015035' }}>
                  <ScrollText size={12} /> Send Test Envelope
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Settings size={12} /> Configure Templates
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PERMISSIONS ── */}
        {tab === 'permissions' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Role-Based Permission Matrix</h3>
              <p className="text-xs text-gray-500 mt-0.5">Control module access by role. Super Admin always has full access.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                    {['Super Admin', 'Leadership', 'Dept Manager', 'Team Member', 'Contractor', 'Client'].map(role => (
                      <th key={role} className="py-3 px-3 text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">{role}</th>
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
                    { module: 'Maintenance', perms: ['Full', 'Full', 'Full', 'Read', 'None', 'None'] },
                    { module: 'Renewals', perms: ['Full', 'Full', 'Unit', 'Assigned', 'None', 'None'] },
                    { module: 'Client Portal', perms: ['Full', 'Full', 'Limited', 'None', 'None', 'Own'] },
                    { module: 'Reports', perms: ['Full', 'Full', 'Unit', 'None', 'None', 'None'] },
                    { module: 'Automation', perms: ['Full', 'Read', 'None', 'None', 'None', 'None'] },
                    { module: 'Admin Panel', perms: ['Full', 'None', 'None', 'None', 'None', 'None'] },
                    { module: 'Settings', perms: ['Full', 'Read', 'Limited', 'Profile', 'None', 'None'] },
                  ].map(row => (
                    <tr key={row.module} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-5 text-sm font-semibold text-gray-700">{row.module}</td>
                      {row.perms.map((perm, i) => (
                        <td key={i} className="py-3 px-3 text-center">
                          <span className={`status-badge text-[10px] ${
                            perm === 'Full' ? 'bg-green-100 text-green-700' :
                            perm === 'None' ? 'bg-gray-100 text-gray-400' :
                            'bg-yellow-100 text-yellow-700'
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

        {/* ── CONFIG ── */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Company */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building size={15} style={{ color: '#015035' }} />
                <h3 className="text-sm font-bold text-gray-800">Company Information</h3>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Company Name', value: 'Graviss Marketing' },
                  { label: 'Admin Email', value: 'jonathan@gravissmarketing.com' },
                  { label: 'Platform URL', value: 'gravhub.gravissmarketing.com' },
                  { label: 'Fiscal Year Start', value: 'January' },
                  { label: 'Default Currency', value: 'USD ($)' },
                  { label: 'Timezone', value: 'America/New_York (EST)' },
                ].map(f => (
                  <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-800">{f.value}</span>
                      <button className="text-gray-300 hover:text-blue-500 transition-colors">
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} style={{ color: '#015035' }} />
                <h3 className="text-sm font-bold text-gray-800">Service Lines</h3>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { name: 'Website', enabled: true, deals: 3 },
                  { name: 'SEO', enabled: true, deals: 2 },
                  { name: 'Social Media', enabled: true, deals: 1 },
                  { name: 'Branding', enabled: true, deals: 1 },
                  { name: 'Email Marketing', enabled: true, deals: 1 },
                  { name: 'Custom', enabled: true, deals: 1 },
                  { name: 'PPC / Paid Ads', enabled: false, deals: 0 },
                  { name: 'Content Marketing', enabled: false, deals: 0 },
                ].map(s => (
                  <div key={s.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm text-gray-700 font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{s.deals} deals</span>
                      <div
                        className="w-9 h-5 rounded-full relative cursor-pointer transition-colors"
                        style={{ background: s.enabled ? '#015035' : '#d1d5db', width: '36px', height: '20px' }}
                      >
                        <div
                          className="w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform"
                          style={{ transform: s.enabled ? 'translateX(16px)' : 'translateX(2px)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline Stages */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={15} style={{ color: '#015035' }} />
                  <h3 className="text-sm font-bold text-gray-800">Pipeline Stages</h3>
                </div>
                <button className="text-xs font-medium px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                  + Add Stage
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { name: 'Lead', color: '#9ca3af', order: 1 },
                  { name: 'Qualified', color: '#3b82f6', order: 2 },
                  { name: 'Proposal Sent', color: '#f59e0b', order: 3 },
                  { name: 'Contract Sent', color: '#f97316', order: 4 },
                  { name: 'Closed Won', color: '#22c55e', order: 5 },
                  { name: 'Closed Lost', color: '#ef4444', order: 6 },
                ].map(stage => (
                  <div key={stage.name} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200">
                    <span className="text-xs text-gray-400 w-4 font-mono">{stage.order}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-sm text-gray-700 flex-1">{stage.name}</span>
                    <Pencil size={12} className="text-gray-300 hover:text-blue-500 cursor-pointer" />
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock size={15} style={{ color: '#015035' }} />
                <h3 className="text-sm font-bold text-gray-800">Security Settings</h3>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Session Timeout', value: '8 hours', desc: 'Auto-logout after inactivity' },
                  { label: 'Password Policy', value: 'Strong (8+ chars)', desc: 'Min complexity requirements' },
                  { label: 'Two-Factor Auth', value: 'Optional', desc: 'Per-user 2FA setting' },
                  { label: 'Login Attempts', value: '5 before lockout', desc: 'Brute force protection' },
                  { label: 'Audit Logging', value: 'Enabled (all events)', desc: 'Full action history' },
                  { label: 'IP Restriction', value: 'Disabled', desc: 'Restrict to office IPs' },
                ].map(s => (
                  <div key={s.label} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{s.label}</p>
                      <p className="text-[11px] text-gray-400">{s.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-4">
                      <span className="text-xs text-gray-600 font-medium">{s.value}</span>
                      <Pencil size={11} className="text-gray-300 hover:text-blue-500 cursor-pointer flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {tab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Full Audit Log</h3>
              <div className="flex items-center gap-2">
                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600">
                  <option>All Users</option>
                  {allUsers.map(u => <option key={u.id}>{u.name}</option>)}
                </select>
                <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600">
                  <option>All Modules</option>
                  <option>CRM</option>
                  <option>Contracts</option>
                  <option>Billing</option>
                  <option>Admin</option>
                  <option>Integrations</option>
                </select>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Download size={12} /> Export
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2.5 px-5 font-semibold">Time</th>
                    <th className="text-left py-2.5 px-4 font-semibold">User</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Module</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                    <th className="text-left py-2.5 px-4 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={11} />
                          {entry.time}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-800">{entry.user}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="status-badge bg-gray-100 text-gray-600">{entry.module}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-700">{entry.action}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`status-badge ${auditColors[entry.type]}`}>{entry.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
