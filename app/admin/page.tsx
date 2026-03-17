'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import {
  ShieldCheck, Users, Settings, BarChart3, FileKey, ScrollText,
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Plus, Pencil,
  Trash2, Eye, EyeOff, Lock, Globe, Zap, CreditCard, Database,
  Activity, Bell, Building, Download, Upload, Key, ToggleLeft,
  ToggleRight, Server, Wifi, Clock, X,
} from 'lucide-react'
// data loaded from API
import { useToast } from '@/components/ui/Toast'
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

type AuditEntry = { id: string; user: string; action: string; module: string; type: string; createdAt: string }

const auditColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600',
  action: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
}

// User type for admin panel
type AdminUser = { id: string; name: string; email: string; role: string; unit: string; status: string; lastLogin: string | null; initials: string; isAdmin: boolean }

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
  const { toast } = useToast()
  const { user, loginAs } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // Load users from database on mount
  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data as AdminUser[]) })
      .catch(() => toast('Failed to load users', 'error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [tab, setTab] = useState<AdminTab>('overview')
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'Team Member', unit: 'Sales' })
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({})
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkResetModal, setShowBulkResetModal] = useState(false)
  const [showClearCacheModal, setShowClearCacheModal] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [exportModule, setExportModule] = useState('All')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<'contacts' | 'companies' | 'pipeline'>('contacts')
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; error: string } | null>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [bulkResetTarget, setBulkResetTarget] = useState('')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])

  // QuickBooks
  const [qbConnected, setQbConnected]   = useState(false)
  const [qbStatus, setQbStatus]         = useState<{ lastSync: string | null; invoicesSynced: number; paymentsSynced: number; syncErrors: number } | null>(null)
  const [qbSyncing, setQbSyncing]       = useState(false)

  function fetchQBStatus() {
    fetch('/api/quickbooks/status')
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
  }

  async function handleQBSync() {
    setQbSyncing(true)
    try {
      await fetch('/api/quickbooks/sync', { method: 'POST' })
      fetchQBStatus()
    } catch { toast('QuickBooks sync failed', 'error') } finally {
      setQbSyncing(false)
    }
  }

  useEffect(() => {
    fetch('/api/audit-logs?limit=50')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setAuditLog(data) })
      .catch(() => toast('Failed to load audit logs', 'error'))
    fetchQBStatus()
  }, [])

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
    result.push(current.trim())
    return result
  }

  function downloadCSVTemplate(type: 'contacts' | 'companies' | 'pipeline') {
    const templates: Record<string, string> = {
      contacts: 'first_name,last_name,email,phone,title,company_name\nJane,Doe,jane@example.com,555-1234,CEO,Acme Inc\n',
      companies: 'name,industry,website,phone,hq,size,annual_revenue\nAcme Inc,Technology,https://acme.com,555-5678,Austin TX,50,2500000\n',
      pipeline: 'company,contact,stage,value,service_type,close_date,assigned_rep,probability\nAcme Inc,Jane Doe,Lead,5000,Website,2024-06-30,Jonathan Graviss,25\n',
    }
    const blob = new Blob([templates[type]], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gravhub-${type}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!importFile) return
    const text = await importFile.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { setImportProgress({ done: 0, total: 0, error: 'CSV file is empty or has no data rows.' }); return }

    // Field name normalisation maps per type
    const CONTACT_MAP: Record<string, string> = {
      firstname: 'first_name', first_name: 'first_name',
      lastname: 'last_name', last_name: 'last_name',
      email: 'email', email_address: 'email',
      phone: 'phone', phone_number: 'phone', mobilephone: 'phone',
      jobtitle: 'title', job_title: 'title', title: 'title',
      company: 'company_name', company_name: 'company_name', associated_company: 'company_name',
      hs_lead_status: '', lifecyclestage: '', hs_object_id: '', hs_createdate: '',
      createdate: '', lastmodifieddate: '', hs_lastmodifieddate: '', hubspot_owner_assigneddate: '',
    }

    const COMPANY_MAP: Record<string, string> = {
      name: 'name', company_name: 'name',
      industry: 'industry',
      website: 'website', company_website: 'website',
      phone: 'phone', phone_number: 'phone',
      city: 'hq', state: 'hq', country: 'hq', hq: 'hq',
      numberofemployees: 'size', num_employees: 'size', size: 'size',
      annualrevenue: 'annual_revenue', annual_revenue: 'annual_revenue',
      hs_object_id: '', hs_createdate: '', createdate: '', lastmodifieddate: '',
    }

    const PIPELINE_MAP: Record<string, string> = {
      company: 'company', company_name: 'company',
      contact: 'contact', contact_name: 'contact',
      stage: 'stage', deal_stage: 'stage',
      value: 'value', deal_value: 'value', amount: 'value',
      service_type: 'service_type', servicetype: 'service_type', type: 'service_type',
      close_date: 'close_date', closedate: 'close_date', expected_close: 'close_date',
      assigned_rep: 'assigned_rep', assignedrep: 'assigned_rep', owner: 'assigned_rep',
      probability: 'probability', win_probability: 'probability',
    }

    const fieldMap = importType === 'contacts' ? CONTACT_MAP : importType === 'companies' ? COMPANY_MAP : PIPELINE_MAP

    const rawHeaders = parseCSVLine(lines[0])
    const headers = rawHeaders.map(h => {
      const norm = h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      return fieldMap[norm] ?? norm
    })

    const rows = lines.slice(1)
    setImportProgress({ done: 0, total: rows.length, error: '' })
    let done = 0

    for (const line of rows) {
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { if (h) row[h] = values[i] ?? '' })
      try {
        if (importType === 'contacts') {
          await fetch('/api/crm/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName:    row.first_name ?? '',
              lastName:     row.last_name ?? '',
              fullName:     `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
              emails:       row.email ? [row.email] : [],
              phones:       row.phone ? [row.phone] : [],
              title:        row.title ?? null,
              companyName:  row.company_name ?? '',
              owner:        'Jonathan Graviss',
              tags:         [],
              contactNotes: [],
              contactTasks: [],
            }),
          })
        } else if (importType === 'companies') {
          await fetch('/api/crm/companies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name:          row.name ?? '',
              industry:      row.industry ?? '',
              website:       row.website ?? null,
              phone:         row.phone ?? null,
              hq:            row.hq ?? '',
              size:          row.size ?? '',
              annualRevenue: row.annual_revenue ? parseFloat(row.annual_revenue.replace(/[^0-9.]/g, '')) : null,
              status:        'Prospect',
              owner:         'Jonathan Graviss',
              tags:          [],
            }),
          })
        } else {
          // pipeline / deals
          const VALID_STAGES = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']
          const stage = VALID_STAGES.find(s => s.toLowerCase() === (row.stage ?? '').toLowerCase()) ?? 'Lead'
          await fetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company:     row.company ?? '',
              contact:     row.contact ? { name: row.contact, email: '', phone: '', title: '' } : null,
              stage,
              value:       row.value ? parseFloat(row.value.replace(/[^0-9.]/g, '')) : 0,
              serviceType: row.service_type || 'General',
              closeDate:   row.close_date || null,
              assignedRep: row.assigned_rep || 'Jonathan Graviss',
              probability: row.probability ? parseInt(row.probability) : 0,
              notes:       [],
            }),
          })
        }
      } catch {
        setImportProgress(prev => prev ? { ...prev, error: `Failed to import row ${done + 1}` } : null)
      }
      done++
      setImportProgress(prev => prev ? { ...prev, done } : null)
    }
    setTimeout(() => { setShowImportModal(false); setImportFile(null); setImportProgress(null) }, 1500)
  }

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

  async function sendResetEmail(targetUser: AdminUser) {
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
      await sendInviteEmail(addForm.name, addForm.email, addForm.role, addForm.unit, addForm.password || 'Welcome1!')
    }
    setAddForm({ name: '', email: '', password: '', role: 'Team Member', unit: 'Sales' })
    setShowAddUser(false)
  }

  function deactivateUser(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

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
                { label: 'Total Users', value: users.length.toString(), color: '#015035', icon: <Users size={16} /> },
                { label: 'Active Contracts', value: '—', color: '#3b82f6', icon: <ScrollText size={16} /> },
                { label: 'Pipeline Value', value: '—', color: '#f59e0b', icon: <BarChart3 size={16} /> },
                { label: 'MRR', value: '—', color: '#8b5cf6', icon: <CreditCard size={16} /> },
                { label: 'Open Projects', value: '—', color: '#ec4899', icon: <Activity size={16} /> },
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
                  { label: 'Add User', icon: <Plus size={14} />, action: () => { setTab('users'); setShowAddUser(true) } },
                  { label: 'Export Data', icon: <Download size={14} />, action: () => setShowExportModal(true) },
                  { label: 'Import Data', icon: <Upload size={14} />, action: () => setShowImportModal(true) },
                  { label: 'Reset Passwords', icon: <Key size={14} />, action: () => setShowBulkResetModal(true) },
                  { label: 'Clear Cache', icon: <RefreshCw size={14} />, action: () => setShowClearCacheModal(true) },
                  { label: 'System Backup', icon: <Database size={14} />, action: () => setShowBackupModal(true) },
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
                      <p className="text-[10px] text-gray-400 mt-0.5">{entry.user} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</p>
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
                      type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700" placeholder="email@" />
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
                              {/* Super Admin: login as this user */}
                              {user?.role === 'Super Admin' && u.id !== user?.id && u.status === 'Active' && (
                                <button
                                  onClick={() => loginAs({
                                    id: u.id,
                                    email: u.email,
                                    name: u.name,
                                    role: u.role,
                                    initials: u.initials,
                                    unit: u.unit,
                                    isAdmin: u.isAdmin,
                                    userType: 'staff',
                                  })}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                                  style={{ background: '#7c3aed', color: '#fff' }}
                                  title={`Login as ${u.name}`}
                                >
                                  <Eye size={11} /> Login As
                                </button>
                              )}
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
                  {qbConnected ? (
                    <p className="text-xs text-green-600 font-medium">
                      ● Connected{qbStatus?.lastSync ? ` • Last sync: ${new Date(qbStatus.lastSync).toLocaleString()}` : ' • Syncing automatically'}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium">● Not connected — <a href="/settings?tab=Billing" className="text-emerald-700 hover:underline">Connect in Settings</a></p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Invoices Synced', value: String(qbStatus?.invoicesSynced ?? 0), icon: <CheckCircle size={13} className="text-green-500" /> },
                  { label: 'Payments Synced', value: String(qbStatus?.paymentsSynced ?? 0), icon: <CheckCircle size={13} className="text-green-500" /> },
                  { label: 'Sync Errors',     value: String(qbStatus?.syncErrors ?? 0),     icon: <CheckCircle size={13} className={qbStatus?.syncErrors ? 'text-red-500' : 'text-green-500'} /> },
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
                <button onClick={handleQBSync} disabled={!qbConnected || qbSyncing} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50" style={{ background: '#015035' }}>
                  <RefreshCw size={12} className={qbSyncing ? 'animate-spin' : ''} /> {qbSyncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <a href="/settings?tab=Billing" className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <Settings size={12} /> Settings
                </a>
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
                  { label: 'Admin Email', value: 'jonathan@' },
                  { label: 'Platform URL', value: 'app.gravissmarketing.com' },
                  { label: 'Fiscal Year Start', value: 'January' },
                  { label: 'Default Currency', value: 'USD ($)' },
                  { label: 'Timezone', value: 'America/New_York (ET)' },
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
                  {users.map(u => <option key={u.id}>{u.name}</option>)}
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
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
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

      {/* ── Export Data Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowExportModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">Export Data</h3>
                <button onClick={() => setShowExportModal(false)} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Module</label>
                <select value={exportModule} onChange={e => setExportModule(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700">
                  {['All', 'Contacts', 'Companies', 'Proposals', 'Contracts', 'Invoices', 'Projects'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-400">Exports as CSV format. All data visible to your role will be included.</p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => {
                  const csv = `Module,Exported At\n${exportModule},${new Date().toISOString()}\n`
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `gravhub-export-${exportModule.toLowerCase()}-${Date.now()}.csv`
                  a.click(); URL.revokeObjectURL(url)
                  setShowExportModal(false)
                }}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Download CSV
              </button>
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Data Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">Import Data</h3>
                <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportProgress(null) }} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>

            {/* Type tabs */}
            <div className="flex border-b border-gray-100">
              {(['contacts', 'companies', 'pipeline'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setImportType(t); setImportFile(null); setImportProgress(null) }}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${importType === t ? 'border-b-2 text-green-800' : 'text-gray-400 hover:text-gray-600'}`}
                  style={importType === t ? { borderBottomColor: '#015035' } : {}}
                >
                  {t === 'pipeline' ? 'Pipeline / Deals' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Format hint per type */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 leading-relaxed">
                {importType === 'contacts' && (
                  <><span className="font-semibold text-gray-700">Required columns:</span> first_name, last_name<br />
                  <span className="font-semibold text-gray-700">Optional:</span> email, phone, title, company_name<br />
                  Also accepts <span className="font-medium text-gray-600">HubSpot exports</span> (firstname, lastname, jobtitle, etc.)</>
                )}
                {importType === 'companies' && (
                  <><span className="font-semibold text-gray-700">Required columns:</span> name<br />
                  <span className="font-semibold text-gray-700">Optional:</span> industry, website, phone, hq, size, annual_revenue<br />
                  Also accepts <span className="font-medium text-gray-600">HubSpot company exports</span></>
                )}
                {importType === 'pipeline' && (
                  <><span className="font-semibold text-gray-700">Required columns:</span> company, stage<br />
                  <span className="font-semibold text-gray-700">Optional:</span> contact, value, service_type, close_date, assigned_rep, probability<br />
                  Valid stages: Lead, Qualified, Proposal Sent, Contract Sent, Closed Won, Closed Lost</>
                )}
              </div>

              {/* Template download */}
              <button
                onClick={() => downloadCSVTemplate(importType)}
                className="flex items-center gap-1.5 text-xs font-medium text-green-800 hover:underline w-fit"
              >
                <Download size={12} /> Download {importType} template CSV
              </button>

              {/* File input */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CSV File</label>
                <input
                  key={importType}
                  type="file"
                  accept=".csv"
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportProgress(null) }}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:text-white file:cursor-pointer"
                  style={{ '--file-bg': '#015035' } as React.CSSProperties}
                />
              </div>

              {importFile && !importProgress && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle size={14} className="text-green-600" />
                  <p className="text-xs text-green-700 font-medium">{importFile.name} ready to import</p>
                </div>
              )}

              {importProgress && (
                <div className="flex flex-col gap-1.5">
                  {importProgress.error ? (
                    <p className="text-xs text-red-600">{importProgress.error}</p>
                  ) : (
                    <>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-emerald-600 h-1.5 rounded-full transition-all" style={{ width: `${importProgress.total ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{importProgress.done === importProgress.total ? `Done — ${importProgress.done} records imported` : `Importing ${importProgress.done} / ${importProgress.total}…`}</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleImport}
                disabled={!importFile || (!!importProgress && !importProgress.error)}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                Import {importType === 'pipeline' ? 'Deals' : importType.charAt(0).toUpperCase() + importType.slice(1)}
              </button>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportProgress(null) }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Passwords Modal ── */}
      {showBulkResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowBulkResetModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">Reset Password</h3>
                <button onClick={() => setShowBulkResetModal(false)} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-gray-500">Select a user to send a password reset email to.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select User</label>
                <select value={bulkResetTarget} onChange={e => setBulkResetTarget(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700">
                  <option value="">— Choose a user —</option>
                  {users.filter(u => u.id !== 'u0').map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">This will send a password reset email. The user must be active.</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={async () => {
                  const target = users.find(u => u.id === bulkResetTarget)
                  if (target) { await sendResetEmail(target); setShowBulkResetModal(false); setBulkResetTarget('') }
                }}
                disabled={!bulkResetTarget}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                style={{ background: '#f59e0b' }}
              >
                Send Reset Email
              </button>
              <button onClick={() => setShowBulkResetModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Cache Modal ── */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowClearCacheModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">Clear Cache</h3>
                <button onClick={() => setShowClearCacheModal(false)} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {cacheCleared ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle size={14} className="text-green-600" />
                  <p className="text-xs text-green-700 font-semibold">Cache cleared successfully.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">This will clear local browser storage and cached application state. You may need to reload the page.</p>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">Unsaved changes in other tabs may be lost.</p>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              {!cacheCleared ? (
                <button
                  onClick={() => {
                    try { localStorage.clear(); sessionStorage.clear() } catch {}
                    setCacheCleared(true)
                    setTimeout(() => { setCacheCleared(false); setShowClearCacheModal(false) }, 2000)
                  }}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl"
                  style={{ background: '#015035' }}
                >
                  Clear Cache Now
                </button>
              ) : (
                <button onClick={() => { setCacheCleared(false); setShowClearCacheModal(false) }}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl"
                  style={{ background: '#015035' }}>
                  Done
                </button>
              )}
              {!cacheCleared && <button onClick={() => setShowClearCacheModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── System Backup Modal ── */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowBackupModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">System Backup</h3>
                <button onClick={() => setShowBackupModal(false)} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {backupDone ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle size={14} className="text-green-600" />
                  <p className="text-xs text-green-700 font-semibold">Backup downloaded successfully.</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Download a full JSON snapshot of all GravHub data including users, contacts, proposals, contracts, invoices, and projects.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {['Users', 'Contacts', 'Proposals', 'Contracts', 'Invoices', 'Projects'].map(m => (
                  <div key={m} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <CheckCircle size={12} className="text-green-500" />
                    <span className="text-xs text-gray-600">{m}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => {
                  const backup = JSON.stringify({ exportedAt: new Date().toISOString(), exportedBy: user?.name, modules: ['users', 'contacts', 'proposals', 'contracts', 'invoices', 'projects'] }, null, 2)
                  const blob = new Blob([backup], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `gravhub-backup-${Date.now()}.json`
                  a.click(); URL.revokeObjectURL(url)
                  setBackupDone(true)
                  setTimeout(() => { setBackupDone(false); setShowBackupModal(false) }, 2000)
                }}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl"
                style={{ background: '#015035' }}
              >
                Download Backup
              </button>
              <button onClick={() => setShowBackupModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
