'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import {
  ShieldCheck, Users, Settings, BarChart3, FileKey, ScrollText,
  CheckCircle, AlertTriangle, XCircle, RefreshCw, Plus, Pencil,
  Trash2, Eye, EyeOff, Lock, Globe, Zap, CreditCard, Database,
  Activity, Bell, Building, Download, Upload, Key, ToggleLeft,
  ToggleRight, Server, Wifi, Clock, X, Mail, Ban, RotateCcw,
  Calendar, UserX,
} from 'lucide-react'
// data loaded from API
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { formatCurrency } from '@/lib/utils'
import { SERVICE_NAMES } from '@/lib/services'
import { computeMRR } from '@/lib/metrics'
import NewClientModal from '@/components/admin/NewClientModal'

type AdminTab = 'overview' | 'users' | 'integrations' | 'permissions' | 'config' | 'audit' | 'data-audit'

const tabList: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
  { id: 'users', label: 'Users & Roles', icon: <Users size={14} /> },
  { id: 'integrations', label: 'Integrations', icon: <Zap size={14} /> },
  { id: 'permissions', label: 'Permissions', icon: <FileKey size={14} /> },
  { id: 'config', label: 'Platform Config', icon: <Settings size={14} /> },
  { id: 'audit', label: 'Audit Log', icon: <ScrollText size={14} /> },
  { id: 'data-audit', label: 'Data Audit', icon: <Database size={14} /> },
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

type AdminUser = {
  id: string; name: string; email: string; role: string; unit: string; status: string
  lastLogin: string | null; initials: string; isAdmin: boolean
  suspendedAt?: string | null; suspendedUntil?: string | null; suspendedReason?: string | null
  accessSchedule?: { removeAccessOn?: string; reinstateOn?: string } | null; deletedAt?: string | null
}

type UserSubTab = 'active' | 'inactive'

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'active') return <span className="status-badge bg-green-100 text-green-700">Active</span>
  if (s === 'suspended') return <span className="status-badge bg-amber-100 text-amber-700">Suspended</span>
  if (s === 'deleted') return <span className="status-badge bg-red-100 text-red-600">Deleted</span>
  return <span className="status-badge bg-gray-100 text-gray-500">{status}</span>
}

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
  name, description, status, logo, lastSync, actions, onConnect, onConfigure, onRefresh,
}: {
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
  logo: string
  lastSync?: string
  actions: string[]
  onConnect?: () => void
  onConfigure?: () => void
  onRefresh?: () => void
}) {
  const [enabled, setEnabled] = useState(status === 'connected')

  function handleToggle() {
    if (!enabled && onConnect) {
      onConnect()
    }
    setEnabled(!enabled)
  }

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
          onClick={handleToggle}
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
            <button
              onClick={onConfigure}
              className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              Configure
            </button>
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw size={12} />
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            className="flex-1 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#015035' }}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

interface AuditData {
  totals: Record<string, number>
  issues: {
    contactsMissingEmail: { id: string; name: string }[]
    contactsMissingCompany: { id: string; name: string; companyName: string }[]
    companiesNoContacts: { id: string; name: string }[]
    dealsMissingCompanyId: { id: string; company: string }[]
    contractsMissingCompanyId: { id: string; company: string }[]
    invoicesMissingCompanyId: { id: string; company: string }[]
    projectsMissingCompanyId: { id: string; company: string }[]
    orphanCompanyNames: string[]
  }
  scores: Record<string, number>
}

function DataAuditPanel() {
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fixing, setFixing] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/data-audit')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const fixOrphans = async () => {
    if (!data?.issues.orphanCompanyNames.length) return
    setFixing(true)
    const res = await fetch('/api/admin/data-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_missing_companies', names: data.issues.orphanCompanyNames }),
    })
    if (res.ok) { const r = await res.json(); toast(`Created ${r.created} companies`); load() }
    setFixing(false)
  }

  const backfill = async () => {
    setFixing(true)
    const res = await fetch('/api/admin/data-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backfill_company_ids' }),
    })
    if (res.ok) { const r = await res.json(); toast(`Linked records: ${JSON.stringify(r.updated)}`); load() }
    setFixing(false)
  }

  const scoreColor = (s: number) => s >= 90 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = (s: number) => s >= 90 ? 'bg-green-50 border-green-200' : s >= 70 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  if (loading) return <div className="text-center py-12 text-gray-400">Loading audit data...</div>
  if (!data) return <div className="text-center py-12 text-red-500">Failed to load audit data</div>

  return (
    <div className="space-y-5">
      {/* Scores */}
      <div className="grid grid-cols-4 gap-4">
        {['overall', 'contacts', 'deals', 'contracts'].map(key => (
          <div key={key} className={`rounded-xl border p-4 text-center ${scoreBg(data.scores[key] ?? 0)}`}>
            <div className={`text-2xl font-bold ${scoreColor(data.scores[key] ?? 0)}`}>{data.scores[key] ?? 0}%</div>
            <div className="text-xs text-gray-500 mt-1 capitalize">{key} Quality</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Record Totals</h3>
        <div className="grid grid-cols-6 gap-3">
          {Object.entries(data.totals).map(([k, v]) => (
            <div key={k} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-800">{v}</div>
              <div className="text-xs text-gray-500 capitalize">{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">Data Issues</h3>
          <div className="flex gap-2">
            {data.issues.orphanCompanyNames.length > 0 && (
              <button onClick={fixOrphans} disabled={fixing} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ background: '#015035', opacity: fixing ? 0.5 : 1 }}>
                Create {data.issues.orphanCompanyNames.length} Missing Companies
              </button>
            )}
            <button onClick={backfill} disabled={fixing} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ background: '#015035', opacity: fixing ? 0.5 : 1 }}>
              Backfill Company IDs
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {([
            ['Contacts Missing Email', data.issues.contactsMissingEmail],
            ['Contacts Missing Company Link', data.issues.contactsMissingCompany],
            ['Companies With No Contacts', data.issues.companiesNoContacts],
            ['Deals Missing Company ID', data.issues.dealsMissingCompanyId],
            ['Contracts Missing Company ID', data.issues.contractsMissingCompanyId],
            ['Invoices Missing Company ID', data.issues.invoicesMissingCompanyId],
            ['Projects Missing Company ID', data.issues.projectsMissingCompanyId],
            ['Orphan Company Names', data.issues.orphanCompanyNames],
          ] as [string, unknown[]][]).map(([label, items]) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{label}</span>
              <span className={`text-sm font-semibold ${items.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {items.length === 0 ? '✓ None' : items.length}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
        <RefreshCw size={12} /> Refresh Audit
      </button>
    </div>
  )
}

export default function AdminPage() {
  const { toast } = useToast()
  const { user, loginAs } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // Load users from database on mount
  const fetchUsers = () => {
    return fetch('/api/team-members?include_inactive=true')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setUsers(data as AdminUser[]) })
      .catch(() => toast('Failed to load users', 'error'))
  }
  useEffect(() => {
    fetchUsers().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [tab, setTab] = useState<AdminTab>('overview')
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<Record<string, 'sending' | 'sent' | 'error'>>({})
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showBulkResetModal, setShowBulkResetModal] = useState(false)
  const [showClearCacheModal, setShowClearCacheModal] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [exportModule, setExportModule] = useState('All')
  const [exportEntities, setExportEntities] = useState<Record<string, boolean>>({
    contacts: true, companies: true, deals: true, projects: true,
    contracts: true, invoices: true, tasks: true, time_entries: true,
  })
  const [exporting, setExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<'contacts' | 'companies' | 'pipeline'>('contacts')
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; error: string } | null>(null)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [bulkResetTarget, setBulkResetTarget] = useState('')
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<{ id: string; name: string; email: string; role: string; unit: string; initials: string; verification_code: string }[]>([])
  const [approvalLoading, setApprovalLoading] = useState<Record<string, boolean>>({})

  const fetchPendingApprovals = () => {
    return fetch('/api/auth/approve-setup')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setPendingApprovals(data) })
      .catch(() => {})
  }

  useEffect(() => { fetchPendingApprovals() }, [])

  async function handleApproval(userId: string, approved: boolean) {
    setApprovalLoading(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch('/api/auth/approve-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approved }),
      })
      if (res.ok) {
        toast(approved ? 'User approved' : 'User denied', approved ? 'success' : 'info')
        fetchPendingApprovals()
        fetchUsers()
      } else {
        toast('Failed to update approval', 'error')
      }
    } catch {
      toast('Failed to update approval', 'error')
    }
    setApprovalLoading(prev => ({ ...prev, [userId]: false }))
  }

  type PendingPortalClient = { id: string; contact: string; email: string; company: string; created_at: string }
  const [pendingPortalClients, setPendingPortalClients] = useState<PendingPortalClient[]>([])
  const [portalApprovalLoading, setPortalApprovalLoading] = useState<Record<string, boolean>>({})

  const fetchPendingPortalClients = () => {
    return fetch('/api/portal-clients?pending_approval=true')
      .then(r => r.ok ? r.json() : [])
      .then((data: PendingPortalClient[]) => {
        if (Array.isArray(data)) {
          setPendingPortalClients(data)
        }
      })
      .catch(() => {})
  }

  useEffect(() => { fetchPendingPortalClients() }, [])

  async function handlePortalApproval(clientId: string, approved: boolean) {
    setPortalApprovalLoading(prev => ({ ...prev, [clientId]: true }))
    try {
      const res = await fetch('/api/portal-clients/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, approved }),
      })
      if (res.ok) {
        toast(approved ? 'Portal client approved' : 'Portal client denied', approved ? 'success' : 'info')
        fetchPendingPortalClients()
      } else {
        toast('Failed to update portal approval', 'error')
      }
    } catch {
      toast('Failed to update portal approval', 'error')
    }
    setPortalApprovalLoading(prev => ({ ...prev, [clientId]: false }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [platformSettings, setPlatformSettings] = useState<Record<string, any> | null>(null)

  // KPI metrics
  const [metrics, setMetrics] = useState({ activeContracts: 0, pipelineValue: 0, mrr: 0, openProjects: 0 })

  // Integration health (for system health + integration cards)
  const [integrationHealth, setIntegrationHealth] = useState<{
    mercury: boolean
    email: boolean
    googleCalendar: boolean
    googleDrive: boolean
    geolocation: boolean
    granola: boolean
    database: boolean | null
    auth: boolean | null
  }>({ mercury: false, email: false, googleCalendar: false, googleDrive: false, geolocation: false, granola: false, database: null, auth: null })

  // Mercury Banking
  const [mercuryConnected, setMercuryConnected] = useState(false)
  const [mercuryAccounts, setMercuryAccounts] = useState<{ name: string; currentBalance: number }[]>([])

  // API Key Management
  type IntegrationKey = { key: string; show: boolean; status: 'idle' | 'testing' | 'connected' | 'error'; error: string; saving: boolean }
  const emptyKey = (): IntegrationKey => ({ key: '', show: false, status: 'idle', error: '', saving: false })
  const [integrationKeys, setIntegrationKeys] = useState<Record<string, IntegrationKey>>({
    mercury: emptyKey(),
    maverick: emptyKey(),
    resend: emptyKey(),
    hubspot: emptyKey(),
  })

  function updateKey(id: string, patch: Partial<IntegrationKey>) {
    setIntegrationKeys(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.mercury?.apiKey) updateKey('mercury', { key: d.mercury.apiKey, status: 'connected' })
        if (d.maverick?.apiKey) updateKey('maverick', { key: d.maverick.apiKey, status: 'connected' })
        if (d.resend?.apiKey) updateKey('resend', { key: d.resend.apiKey, status: 'connected' })
        if (d.hubspot?.apiKey) updateKey('hubspot', { key: d.hubspot.apiKey, status: 'connected' })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function testIntegration(id: string) {
    const k = integrationKeys[id]
    if (!k?.key.trim()) return
    updateKey(id, { status: 'testing', error: '' })
    try {
      let endpoint = ''
      let payload: Record<string, string> = {}
      if (id === 'mercury') { endpoint = '/api/integrations/mercury/test'; payload = { apiKey: k.key.trim() } }
      else if (id === 'maverick') { endpoint = '/api/integrations/maverick/test'; payload = { apiKey: k.key.trim() } }
      else if (id === 'resend') { endpoint = '/api/integrations/resend/test'; payload = { apiKey: k.key.trim() } }
      else if (id === 'hubspot') { endpoint = '/api/integrations/hubspot/test'; payload = { apiKey: k.key.trim() } }
      else return
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.connected) {
        updateKey(id, { status: 'connected' })
        toast(`${id.charAt(0).toUpperCase() + id.slice(1)} connected`, 'success')
      } else {
        updateKey(id, { status: 'error', error: data.error || 'Connection failed' })
      }
    } catch {
      updateKey(id, { status: 'error', error: 'Failed to test connection' })
    }
  }

  async function saveIntegrationKey(id: string) {
    const k = integrationKeys[id]
    if (!k) return
    updateKey(id, { saving: true })
    try {
      let payload: Record<string, unknown> = {}
      if (id === 'mercury') payload = { mercury: { apiKey: k.key.trim() } }
      else if (id === 'maverick') payload = { maverick: { apiKey: k.key.trim() } }
      else if (id === 'resend') payload = { resend: { apiKey: k.key.trim() } }
      else if (id === 'hubspot') payload = { hubspot: { apiKey: k.key.trim() } }
      await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      toast('API key saved', 'success')
    } catch {
      toast('Failed to save key', 'error')
    }
    updateKey(id, { saving: false })
  }

  function fetchMercuryStatus() {
    fetch('/api/mercury/accounts')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.accounts?.length) {
          setMercuryConnected(true)
          setMercuryAccounts(d.accounts)
          setIntegrationHealth(prev => ({ ...prev, mercury: true }))
        } else {
          setMercuryConnected(false)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch('/api/audit-logs?limit=50')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setAuditLog(data) })
      .catch(() => toast('Failed to load audit logs', 'error'))
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPlatformSettings(data) })
      .catch(() => {})
    fetchMercuryStatus()
  }, [])

  // Fetch KPI metrics from real API endpoints
  useEffect(() => {
    // Active contracts + MRR
    fetch('/api/contracts')
      .then(r => r.ok ? r.json() : [])
      .then((contracts: { status?: string; billingStructure?: string; value?: number }[]) => {
        if (!Array.isArray(contracts)) return
        const active = contracts.filter(c => c.status === 'Fully Executed' || c.status === 'Active').length
        const mrr = computeMRR(contracts)
        setMetrics(prev => ({ ...prev, activeContracts: active, mrr }))
      })
      .catch(() => {})

    // Pipeline value
    fetch('/api/deals')
      .then(r => r.ok ? r.json() : [])
      .then((deals: { stage?: string; value?: number }[]) => {
        if (!Array.isArray(deals)) return
        const pipeline = deals
          .filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
          .reduce((sum, d) => sum + (d.value || 0), 0)
        setMetrics(prev => ({ ...prev, pipelineValue: pipeline }))
      })
      .catch(() => {})

    // Open projects
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((projects: { status?: string }[]) => {
        if (!Array.isArray(projects)) return
        const open = projects.filter(p => p.status === 'In Progress' || p.status === 'Awaiting Client').length
        setMetrics(prev => ({ ...prev, openProjects: open }))
      })
      .catch(() => {})

    // Integration health check
    fetch('/api/mercury/accounts')
      .then(r => r.ok ? r.json() : null)
      .then(d => setIntegrationHealth(prev => ({ ...prev, mercury: !!(d?.accounts?.length) })))
      .catch(() => {})

    fetch('/api/admin/integration-health')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setIntegrationHealth(prev => ({
            ...prev,
            email: !!d.email,
            googleCalendar: !!d.googleCalendar,
            googleDrive: !!d.googleDrive,
            geolocation: !!d.geolocation,
            granola: !!d.granola,
            database: !!d.database,
            auth: !!d.auth,
          }))
        } else {
          setIntegrationHealth(prev => ({ ...prev, database: false, auth: false }))
        }
      })
      .catch(() => {
        // Fallback: assume email is configured if the app works, but leave
        // database/auth as an explicit failure since the health check itself failed
        setIntegrationHealth(prev => ({ ...prev, email: true, database: false, auth: false }))
      })
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
      contacts: 'first_name,last_name,email,phone,title,company_name\nFirst,Last,email@company.com,000-0000,CEO,Example Co\n',
      companies: 'name,industry,website,phone,hq,size,annual_revenue\nExample Co,Technology,https://example-co.com,000-0000,Austin TX,50,2500000\n',
      pipeline: 'company,contact,stage,value,service_type,close_date,assigned_rep,probability\nExample Co,First Last,Lead,5000,Website,2024-06-30,Jonathan Graviss,25\n',
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

  async function sendInviteEmail(name: string, email: string, role: string, unit: string) {
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, unit, invitedBy: user?.name }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async function sendSignInLink(targetUser: AdminUser) {
    setEmailStatus(prev => ({ ...prev, [targetUser.id]: 'sending' }))
    try {
      const res = await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetUser.name, email: targetUser.email, role: targetUser.role, unit: targetUser.unit, invitedBy: user?.name }),
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
    const isNewAdmin = addForm.role === 'Super Admin'
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          email: addForm.email,
          role: addForm.role,
          unit: addForm.unit,
          isAdmin: isNewAdmin,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error || 'Failed to create user', 'error')
        return
      }
      const created = await res.json()
      setUsers(prev => [...prev, created])
      toast(`${addForm.name} has been added`, 'success')
    } catch {
      toast('Failed to create user', 'error')
      return
    }
    // Send invite email in background
    await sendInviteEmail(addForm.name, addForm.email, addForm.role, addForm.unit)
    setAddForm({ name: '', email: '', role: 'Team Member', unit: 'Sales' })
    setShowAddUser(false)
  }

  async function deactivateUser(id: string) {
    const target = users.find(u => u.id === id)
    if (!target) return
    const isActive = target.status.toLowerCase() === 'active'
    const newStatus = isActive ? 'suspended' : 'active'
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u))
    try {
      const res = await fetch('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: isActive ? 'suspend' : 'reinstate' }),
      })
      if (!res.ok) throw new Error()
      toast(`User ${isActive ? 'suspended' : 'reinstated'}`, 'success')
    } catch {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: target.status } : u))
      toast('Failed to update user status', 'error')
    }
  }

  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null)
  const [reassignTo, setReassignTo] = useState('')
  const [userSubTab, setUserSubTab] = useState<UserSubTab>('active')
  const [suspendModal, setSuspendModal] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendUntil, setSuspendUntil] = useState('')
  const [scheduleModal, setScheduleModal] = useState<string | null>(null)
  const [scheduleRemoveOn, setScheduleRemoveOn] = useState('')
  const [scheduleReinstateOn, setScheduleReinstateOn] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  async function removeUser(id: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()

      if (reassignTo) {
        const targetUser = users.find(u => u.id === id)
        if (targetUser) {
          await fetch('/api/deals/reassign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromRep: targetUser.name, toRep: reassignTo }),
          }).catch(() => {})
        }
      }

      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'deleted', deletedAt: new Date().toISOString() } : u))
      setRemoveConfirm(null)
      setReassignTo('')
      toast('User removed and deals reassigned', 'success')
    } catch {
      toast('Failed to remove user', 'error')
    }
  }

  async function suspendUser(id: string) {
    try {
      const res = await fetch('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'suspend',
          reason: suspendReason || undefined,
          suspendUntil: suspendUntil || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
      setSuspendModal(null)
      setSuspendReason('')
      setSuspendUntil('')
      toast('User suspended', 'success')
    } catch {
      toast('Failed to suspend user', 'error')
    }
  }

  async function reinstateUser(id: string) {
    try {
      const res = await fetch('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reinstate' }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
      toast('User reinstated', 'success')
    } catch {
      toast('Failed to reinstate user', 'error')
    }
  }

  async function softDeleteUser(id: string) {
    try {
      const res = await fetch('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
      setDeleteConfirm(null)
      toast('User deleted', 'success')
    } catch {
      toast('Failed to delete user', 'error')
    }
  }

  async function scheduleAccess(id: string) {
    try {
      const res = await fetch('/api/team-members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'schedule_access',
          accessSchedule: {
            removeAccessOn: scheduleRemoveOn || undefined,
            reinstateOn: scheduleReinstateOn || undefined,
          },
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
      setScheduleModal(null)
      setScheduleRemoveOn('')
      setScheduleReinstateOn('')
      toast('Access schedule saved', 'success')
    } catch {
      toast('Failed to schedule access', 'error')
    }
  }

  async function saveUserEdit(id: string, updates: { role?: string; unit?: string; isAdmin?: boolean }) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error()
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u))
      setEditingUser(null)
      toast('User updated', 'success')
    } catch {
      toast('Failed to update user', 'error')
    }
  }

  if (loading) return <LoadingScreen />

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
      <Header title="Admin Panel" subtitle={`Super Admin • ${user.name}`} action={{ label: 'New Client', onClick: () => setShowNewClientModal(true) }} />
      <NewClientModal open={showNewClientModal} onClose={() => setShowNewClientModal(false)} />
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
              {t.id === 'overview' && pendingPortalClients.length > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full px-1">
                  {pendingPortalClients.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="flex flex-col gap-4">

            {pendingPortalClients.length > 0 && (
              <div className="metric-card border-2 border-amber-200" style={{ background: '#fffbeb' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Building size={15} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">Pending Portal Approvals</h3>
                  <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                    {pendingPortalClients.length} pending
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {pendingPortalClients.map(pc => (
                    <div key={pc.id} className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-amber-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                          {(pc.contact || pc.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{pc.contact || pc.email}</p>
                          <p className="text-xs text-gray-500 truncate">{pc.email} &middot; {pc.company}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-gray-400 hidden sm:inline">
                          {pc.created_at ? new Date(pc.created_at).toLocaleDateString() : ''}
                        </span>
                        <button
                          onClick={() => handlePortalApproval(pc.id, true)}
                          disabled={portalApprovalLoading[pc.id]}
                          className="px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-opacity disabled:opacity-50"
                          style={{ background: '#015035' }}
                        >
                          {portalApprovalLoading[pc.id] ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handlePortalApproval(pc.id, false)}
                          disabled={portalApprovalLoading[pc.id]}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* KPIs */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Users', value: users.length.toString(), color: '#015035', icon: <Users size={16} /> },
                { label: 'Active Contracts', value: metrics.activeContracts.toString(), color: '#3b82f6', icon: <ScrollText size={16} /> },
                { label: 'Pipeline Value', value: formatCurrency(metrics.pipelineValue), color: '#f59e0b', icon: <BarChart3 size={16} /> },
                { label: 'MRR', value: formatCurrency(metrics.mrr), color: '#8b5cf6', icon: <CreditCard size={16} /> },
                { label: 'Open Projects', value: metrics.openProjects.toString(), color: '#ec4899', icon: <Activity size={16} /> },
                { label: 'Integrations', value: `${[integrationHealth.mercury, integrationHealth.email, integrationHealth.googleCalendar, integrationHealth.googleDrive].filter(Boolean).length} Active`, color: '#14b8a6', icon: <Zap size={16} /> },
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
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  [integrationHealth.auth, integrationHealth.database].every(Boolean) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {integrationHealth.auth === null && integrationHealth.database === null
                    ? 'CHECKING...'
                    : [integrationHealth.auth, integrationHealth.database].every(Boolean) ? 'ALL SYSTEMS GO' : 'DEGRADED'}
                </span>
              </div>
              <SystemHealthRow
                label="Authentication"
                status={integrationHealth.auth === null ? 'warn' : integrationHealth.auth ? 'ok' : 'error'}
                detail={integrationHealth.auth === null ? 'Checking...' : integrationHealth.auth ? 'Operational' : 'SESSION_SIGNING_KEY not configured'}
              />
              <SystemHealthRow
                label="Database"
                status={integrationHealth.database === null ? 'warn' : integrationHealth.database ? 'ok' : 'error'}
                detail={integrationHealth.database === null ? 'Checking...' : integrationHealth.database ? 'Healthy' : 'Unreachable'}
              />
              <SystemHealthRow label="Mercury Banking" status={integrationHealth.mercury ? 'ok' : 'warn'} detail={integrationHealth.mercury ? 'Connected' : 'Not Connected'} />
              <SystemHealthRow label="E-Signature" status="ok" detail="Built-in" />
              <SystemHealthRow label="Email Delivery" status={integrationHealth.email ? 'ok' : 'warn'} detail={integrationHealth.email ? 'Active' : 'Not Configured'} />
              <SystemHealthRow label="Google Calendar" status={integrationHealth.googleCalendar ? 'ok' : 'warn'} detail={integrationHealth.googleCalendar ? 'Connected' : 'Not Connected'} />
              <SystemHealthRow label="Google Drive" status={integrationHealth.googleDrive ? 'ok' : 'warn'} detail={integrationHealth.googleDrive ? 'Connected' : 'Not Connected'} />
              <SystemHealthRow label="Visitor Geolocation" status={integrationHealth.geolocation ? 'ok' : 'warn'} detail={integrationHealth.geolocation ? 'Connected' : 'On hold — add IPINFO_API_KEY to enable'} />
              <SystemHealthRow label="Granola Meeting Notes" status={integrationHealth.granola ? 'ok' : 'warn'} detail={integrationHealth.granola ? 'Connected' : 'Not Connected — add an API key in Settings > Integrations'} />
            </div>

            {/* Quick Actions */}
            <div className="metric-card">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Admin Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Add User', icon: <Plus size={14} />, action: () => { setTab('users'); setShowAddUser(true) } },
                  { label: 'Export Data', icon: <Download size={14} />, action: () => setShowExportModal(true) },
                  { label: 'Import Data', icon: <Upload size={14} />, action: () => setShowImportModal(true) },
                  { label: 'Send Sign-In Links', icon: <Key size={14} />, action: () => setShowBulkResetModal(true) },
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
          </div>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (() => {
          const activeUsers = users.filter(u => u.status.toLowerCase() === 'active')
          const inactiveUsers = users.filter(u => u.status.toLowerCase() !== 'active')
          const displayUsers = userSubTab === 'active' ? activeUsers : inactiveUsers
          return (
          <div>
            {showAddUser && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800">Invite New User</h3>
                  <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
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
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                    <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700">
                      <option>Super Admin</option>
                      <option>Leadership</option>
                      <option>Department Manager</option>
                      <option>Team Member</option>
                      <option>Contractor</option>
                    </select>
                    {addForm.role === 'Super Admin' && (
                      <p className="text-[10px] text-amber-600 font-medium mt-1">This user will have full admin privileges</p>
                    )}
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

            {pendingApprovals.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-4">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-100 bg-amber-50">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-800">Pending Approvals ({pendingApprovals.length})</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingApprovals.map(pa => (
                    <div key={pa.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#f59e0b' }}>
                          {pa.initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pa.name}</p>
                          <p className="text-xs text-gray-400">{pa.email}</p>
                        </div>
                        <span className="status-badge bg-gray-100 text-gray-600 text-[11px]">{pa.role}</span>
                        <span className="text-xs text-gray-400">{pa.unit}</span>
                        {pa.verification_code && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100" style={{ color: '#015035' }}>
                            {pa.verification_code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproval(pa.id, true)}
                          disabled={approvalLoading[pa.id]}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                          style={{ background: '#015035' }}
                        >
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleApproval(pa.id, false)}
                          disabled={approvalLoading[pa.id]}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={12} /> Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-gray-800">Platform Users ({users.length})</h3>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setUserSubTab('active')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${userSubTab === 'active' ? 'text-white' : 'text-gray-500 bg-white hover:bg-gray-50'}`}
                      style={userSubTab === 'active' ? { background: '#015035' } : undefined}
                    >
                      Active ({activeUsers.length})
                    </button>
                    <button
                      onClick={() => setUserSubTab('inactive')}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${userSubTab === 'inactive' ? 'text-white' : 'text-gray-500 bg-white hover:bg-gray-50'}`}
                      style={userSubTab === 'inactive' ? { background: '#015035' } : undefined}
                    >
                      Inactive ({inactiveUsers.length})
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg"
                  style={{ background: '#015035' }}
                >
                  <Plus size={13} /> Invite User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px]">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-2.5 px-5 font-semibold">User</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Role</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Unit</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Access</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Last Login</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                          {userSubTab === 'inactive' ? 'No inactive users' : 'No active users'}
                        </td>
                      </tr>
                    )}
                    {displayUsers.map(u => (
                      <React.Fragment key={u.id}>
                        <tr className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${u.status.toLowerCase() !== 'active' ? 'opacity-60' : ''}`}>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: u.isAdmin ? '#f59e0b' : u.status.toLowerCase() !== 'active' ? '#9ca3af' : '#015035' }}
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
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={u.status} />
                              {u.suspendedUntil && u.status.toLowerCase() === 'suspended' && (
                                <span className="text-[10px] text-gray-400">Until {new Date(u.suspendedUntil).toLocaleDateString()}</span>
                              )}
                              {u.accessSchedule?.removeAccessOn && (
                                <span className="text-[10px] text-amber-600 flex items-center gap-1">
                                  <Calendar size={9} /> Scheduled
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={11} />
                              {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {user?.role === 'Super Admin' && u.id !== user?.id && u.status.toLowerCase() === 'active' && (
                                <button
                                  onClick={() => loginAs({
                                    id: u.id, email: u.email, name: u.name, role: u.role,
                                    initials: u.initials, unit: u.unit, isAdmin: u.isAdmin, userType: 'staff',
                                  })}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
                                  style={{ background: '#7c3aed', color: '#fff' }}
                                  title={`Login as ${u.name}`}
                                >
                                  <Eye size={11} /> Login As
                                </button>
                              )}
                              {u.id !== user?.id && (
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
                                    title="Send sign-in link"
                                  >
                                    <Key size={13} />
                                  </button>
                                  {u.status.toLowerCase() === 'active' && (
                                    <>
                                      <button
                                        onClick={() => setSuspendModal(u.id)}
                                        className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 transition-colors"
                                        title="Suspend user"
                                      >
                                        <Ban size={13} />
                                      </button>
                                      <button
                                        onClick={() => setScheduleModal(u.id)}
                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 transition-colors"
                                        title="Schedule access"
                                      >
                                        <Calendar size={13} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirm(u.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                        title="Delete user"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                  {(u.status.toLowerCase() === 'suspended' || u.status.toLowerCase() === 'deleted') && (
                                    <button
                                      onClick={() => reinstateUser(u.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-opacity"
                                      style={{ background: '#015035' }}
                                      title="Reinstate user"
                                    >
                                      <RotateCcw size={11} /> Reinstate
                                    </button>
                                  )}
                                </>
                              )}
                              {u.id === user?.id && (
                                <span className="text-xs text-amber-600 font-semibold">You</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editingUser === u.id && (
                          <tr key={`edit-${u.id}`} className="bg-blue-50/40 border-b border-blue-100">
                            <td colSpan={6} className="px-5 py-3">
                              {(() => {
                                const [editRole, setEditRole] = [u.role, (v: string) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: v, isAdmin: v === 'Super Admin' } : x))]
                                const [editUnit, setEditUnit] = [u.unit, (v: string) => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, unit: v } : x))]
                                return (
                                  <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Role</label>
                                      <select
                                        defaultValue={editRole}
                                        onChange={e => setEditRole(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700"
                                      >
                                        <option>Super Admin</option>
                                        <option>Leadership</option>
                                        <option>Department Manager</option>
                                        <option>Team Member</option>
                                        <option>Contractor</option>
                                        <option>Client</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit</label>
                                      <select
                                        defaultValue={editUnit}
                                        onChange={e => setEditUnit(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700"
                                      >
                                        <option>Sales</option>
                                        <option>Delivery/Operations</option>
                                        <option>Billing/Finance</option>
                                        <option>Leadership/Admin</option>
                                        <option>Contractors</option>
                                      </select>
                                    </div>
                                    <button
                                      onClick={() => saveUserEdit(u.id, { role: u.role, unit: u.unit, isAdmin: u.role === 'Super Admin' })}
                                      className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
                                      style={{ background: '#015035' }}
                                    >
                                      Save Changes
                                    </button>
                                    <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                                      Cancel
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                        {resetConfirm === u.id && (
                          <tr key={`reset-${u.id}`} className="bg-amber-50/40 border-b border-amber-100">
                            <td colSpan={6} className="px-5 py-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                                <span className="text-xs text-gray-700">Send sign-in link to <strong>{u.email}</strong>?</span>
                                <button
                                  onClick={() => sendSignInLink(u)}
                                  disabled={emailStatus[u.id] === 'sending'}
                                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60"
                                  style={{ background: '#f59e0b' }}
                                >
                                  {emailStatus[u.id] === 'sending' ? 'Sending...' : 'Send Sign-In Link'}
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
                                <AlertTriangle size={12} /> Failed to send email
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )
        })()}

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
                  {[integrationHealth.mercury, integrationHealth.email, integrationHealth.googleCalendar, integrationHealth.googleDrive].filter(Boolean).length} Connected
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <IntegrationCard
                name="Mercury Banking"
                description="Connect your Mercury bank account to view balances, transactions, and cash flow data directly in GravHub."
                status={integrationHealth.mercury ? 'connected' : 'disconnected'}
                logo="MR"
                actions={['Account Balances', 'Transactions', 'Cash Flow', 'Revenue Tracking']}
                onConnect={() => { document.getElementById('api-key-mgmt')?.scrollIntoView({ behavior: 'smooth' }) }}
                onConfigure={() => { document.getElementById('api-key-mgmt')?.scrollIntoView({ behavior: 'smooth' }) }}
                onRefresh={fetchMercuryStatus}
              />
              <IntegrationCard
                name="Google Calendar"
                description="Two-way calendar sync for project deadlines, client meetings, and team scheduling. Events created in GravHub automatically appear in Google Calendar."
                status={integrationHealth.googleCalendar ? 'connected' : 'disconnected'}
                logo="GC"
                actions={['Event Sync', 'Meeting Scheduling', 'Deadline Tracking', 'Team Calendars']}
                onConnect={() => { window.location.href = '/api/calendar/auth' }}
                onConfigure={() => { router.push('/settings/calendar') }}
                onRefresh={() => { fetch('/api/calendar/sync', { method: 'POST' }).then(() => toast('Calendar synced', 'success')).catch(() => toast('Calendar sync failed', 'error')) }}
              />
              <IntegrationCard
                name="Google Drive"
                description="Store and attach files from Google Drive to deals, projects, and contracts. Centralized document management with automatic folder organization."
                status={integrationHealth.googleDrive ? 'connected' : 'disconnected'}
                logo="GD"
                actions={['File Storage', 'Document Attachments', 'Auto-Folders', 'Sharing']}
                onConnect={() => { window.location.href = '/api/drive?action=auth' }}
                onConfigure={() => { router.push('/settings?tab=Integrations') }}
                onRefresh={() => { toast('Google Drive files refreshed', 'success') }}
              />
              <IntegrationCard
                name="Resend Email"
                description="Transactional email delivery for sign-in links, contract notifications, invoice reminders, and team invitations. Powered by Resend API."
                status={integrationHealth.email ? 'connected' : 'disconnected'}
                logo="RE"
                actions={['Sign-In Links', 'Contract Emails', 'Invoice Reminders', 'Team Invites']}
                onConnect={() => { router.push('/settings?tab=Integrations') }}
                onConfigure={() => { router.push('/settings?tab=Integrations') }}
                onRefresh={() => { fetch('/api/admin/integration-health').then(r => r.ok ? r.json() : Promise.reject()).then(() => toast('Email status refreshed', 'success')).catch(() => toast('Failed to check email status', 'error')) }}
              />
            </div>

            {/* API Key Management */}
            <div id="api-key-mgmt" className="mt-5 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Key size={15} className="text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-800">API Key Management</h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Add and manage API keys for all integrations. Keys are encrypted and stored securely.</p>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Mercury Banking */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-[11px]">MR</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Mercury Banking</p>
                      <p className="text-[11px] text-gray-400">Bank account balances, transactions, and cash flow</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      integrationKeys.mercury.status === 'connected' ? 'bg-green-100 text-green-700' :
                      integrationKeys.mercury.status === 'error' ? 'bg-red-100 text-red-700' :
                      integrationKeys.mercury.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {integrationKeys.mercury.status === 'connected' ? 'Connected' :
                       integrationKeys.mercury.status === 'error' ? 'Error' :
                       integrationKeys.mercury.status === 'testing' ? 'Testing...' : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type={integrationKeys.mercury.show ? 'text' : 'password'}
                        value={integrationKeys.mercury.key}
                        onChange={e => updateKey('mercury', { key: e.target.value, status: integrationKeys.mercury.status === 'error' ? 'idle' : integrationKeys.mercury.status })}
                        placeholder="Mercury API token"
                        className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                      />
                      <button type="button" onClick={() => updateKey('mercury', { show: !integrationKeys.mercury.show })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {integrationKeys.mercury.show ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <button onClick={() => testIntegration('mercury')} disabled={!integrationKeys.mercury.key.trim() || integrationKeys.mercury.status === 'testing'} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap" style={{ background: '#015035' }}>
                      {integrationKeys.mercury.status === 'testing' && <RefreshCw size={11} className="animate-spin" />}
                      Test
                    </button>
                    <button onClick={() => saveIntegrationKey('mercury')} disabled={!integrationKeys.mercury.key.trim() || integrationKeys.mercury.saving} className="px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                      {integrationKeys.mercury.saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {integrationKeys.mercury.error && <p className="text-[11px] text-red-500 mt-1.5">{integrationKeys.mercury.error}</p>}
                  {mercuryConnected && mercuryAccounts.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {mercuryAccounts.map(a => (
                        <div key={a.name} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 rounded-lg">
                          <CheckCircle size={11} className="text-green-500" />
                          <span className="text-[11px] font-medium text-green-700">{a.name}: ${a.currentBalance.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Maverick Intelligence */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center font-bold text-violet-700 text-[11px]">MV</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Maverick Intelligence</p>
                      <p className="text-[11px] text-gray-400">Website visitor identification and lead intelligence</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      integrationKeys.maverick.status === 'connected' ? 'bg-green-100 text-green-700' :
                      integrationKeys.maverick.status === 'error' ? 'bg-red-100 text-red-700' :
                      integrationKeys.maverick.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {integrationKeys.maverick.status === 'connected' ? 'Connected' :
                       integrationKeys.maverick.status === 'error' ? 'Error' :
                       integrationKeys.maverick.status === 'testing' ? 'Testing...' : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type={integrationKeys.maverick.show ? 'text' : 'password'}
                        value={integrationKeys.maverick.key}
                        onChange={e => updateKey('maverick', { key: e.target.value, status: integrationKeys.maverick.status === 'error' ? 'idle' : integrationKeys.maverick.status })}
                        placeholder="mk_live_xxxxxxxxxxxx"
                        className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                      />
                      <button type="button" onClick={() => updateKey('maverick', { show: !integrationKeys.maverick.show })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {integrationKeys.maverick.show ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <button onClick={() => testIntegration('maverick')} disabled={!integrationKeys.maverick.key.trim() || integrationKeys.maverick.status === 'testing'} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap" style={{ background: '#015035' }}>
                      {integrationKeys.maverick.status === 'testing' && <RefreshCw size={11} className="animate-spin" />}
                      Test
                    </button>
                    <button onClick={() => saveIntegrationKey('maverick')} disabled={!integrationKeys.maverick.key.trim() || integrationKeys.maverick.saving} className="px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                      {integrationKeys.maverick.saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {integrationKeys.maverick.error && <p className="text-[11px] text-red-500 mt-1.5">{integrationKeys.maverick.error}</p>}
                </div>

                {/* HubSpot CRM */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center font-bold text-orange-700 text-[11px]">HS</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">HubSpot CRM</p>
                      <p className="text-[11px] text-gray-400">Import contacts, companies, and deals</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      integrationKeys.hubspot.status === 'connected' ? 'bg-green-100 text-green-700' :
                      integrationKeys.hubspot.status === 'error' ? 'bg-red-100 text-red-700' :
                      integrationKeys.hubspot.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {integrationKeys.hubspot.status === 'connected' ? 'Connected' :
                       integrationKeys.hubspot.status === 'error' ? 'Error' :
                       integrationKeys.hubspot.status === 'testing' ? 'Testing...' : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type={integrationKeys.hubspot.show ? 'text' : 'password'}
                        value={integrationKeys.hubspot.key}
                        onChange={e => updateKey('hubspot', { key: e.target.value, status: integrationKeys.hubspot.status === 'error' ? 'idle' : integrationKeys.hubspot.status })}
                        placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                      />
                      <button type="button" onClick={() => updateKey('hubspot', { show: !integrationKeys.hubspot.show })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {integrationKeys.hubspot.show ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <button onClick={() => testIntegration('hubspot')} disabled={!integrationKeys.hubspot.key.trim() || integrationKeys.hubspot.status === 'testing'} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap" style={{ background: '#015035' }}>
                      {integrationKeys.hubspot.status === 'testing' && <RefreshCw size={11} className="animate-spin" />}
                      Test
                    </button>
                    <button onClick={() => saveIntegrationKey('hubspot')} disabled={!integrationKeys.hubspot.key.trim() || integrationKeys.hubspot.saving} className="px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                      {integrationKeys.hubspot.saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {integrationKeys.hubspot.error && <p className="text-[11px] text-red-500 mt-1.5">{integrationKeys.hubspot.error}</p>}
                </div>

                {/* Resend Email */}
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center font-bold text-sky-700 text-[11px]">RE</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Resend Email</p>
                      <p className="text-[11px] text-gray-400">Transactional emails, sign-in links, and notifications</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      integrationKeys.resend.status === 'connected' ? 'bg-green-100 text-green-700' :
                      integrationKeys.resend.status === 'error' ? 'bg-red-100 text-red-700' :
                      integrationKeys.resend.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {integrationKeys.resend.status === 'connected' ? 'Connected' :
                       integrationKeys.resend.status === 'error' ? 'Error' :
                       integrationKeys.resend.status === 'testing' ? 'Testing...' : 'Not Set'}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <input
                        type={integrationKeys.resend.show ? 'text' : 'password'}
                        value={integrationKeys.resend.key}
                        onChange={e => updateKey('resend', { key: e.target.value, status: integrationKeys.resend.status === 'error' ? 'idle' : integrationKeys.resend.status })}
                        placeholder="re_xxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                      />
                      <button type="button" onClick={() => updateKey('resend', { show: !integrationKeys.resend.show })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {integrationKeys.resend.show ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <button onClick={() => testIntegration('resend')} disabled={!integrationKeys.resend.key.trim() || integrationKeys.resend.status === 'testing'} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap" style={{ background: '#015035' }}>
                      {integrationKeys.resend.status === 'testing' && <RefreshCw size={11} className="animate-spin" />}
                      Test
                    </button>
                    <button onClick={() => saveIntegrationKey('resend')} disabled={!integrationKeys.resend.key.trim() || integrationKeys.resend.saving} className="px-3 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                      {integrationKeys.resend.saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {integrationKeys.resend.error && <p className="text-[11px] text-red-500 mt-1.5">{integrationKeys.resend.error}</p>}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ── PERMISSIONS ── */}
        {tab === 'permissions' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-800">Role-Based Permission Matrix</h3>
                <span className="status-badge text-[10px] bg-gray-100 text-gray-500">Reference only</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Illustrates intended module access by role — not editable here, and not independently enforced
                per module. The app&apos;s actual access control is a single role hierarchy (Client &lt; Contractor &lt; Team
                Member &lt; Dept Manager &lt; Leadership &lt; Super Admin, each level inheriting the ones below it);
                per-module distinctions like &quot;Unit&quot; or &quot;Assigned&quot; below reflect what each page&apos;s
                queries happen to filter by, not a separate permissions system.
              </p>
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
        {tab === 'config' && (() => {
          const co = platformSettings?.company as Record<string, string> | undefined
          const companyFields = [
            { label: 'Company Name', value: co?.name ?? 'Graviss Marketing' },
            { label: 'Admin Email', value: co?.email ?? 'jonathan@gravissmarketing.com' },
            { label: 'Platform URL', value: co?.url ?? 'app.gravissmarketing.com' },
            { label: 'Fiscal Year Start', value: co?.fiscalYearStart ?? 'January' },
            { label: 'Default Currency', value: co?.currency ?? 'USD ($)' },
            { label: 'Timezone', value: co?.timezone ?? 'America/New_York (ET)' },
          ]

          const serviceTypes = (platformSettings?.service_types as string[] | undefined) ?? [...SERVICE_NAMES]

          const DEFAULT_STAGE_COLORS: Record<string, string> = {
            Lead: '#9ca3af', Qualified: '#3b82f6', 'Proposal Sent': '#f59e0b',
            'Contract Sent': '#f97316', 'Closed Won': '#22c55e', 'Closed Lost': '#ef4444',
          }
          const rawStages = platformSettings?.pipeline_stages as
            | { name: string; color?: string }[]
            | string[]
            | undefined
          const pipelineStages = (rawStages ?? [
            { name: 'Lead' }, { name: 'Qualified' }, { name: 'Proposal Sent' },
            { name: 'Contract Sent' }, { name: 'Closed Won' }, { name: 'Closed Lost' },
          ]).map((s, i) => {
            const name = typeof s === 'string' ? s : s.name
            const color = (typeof s === 'object' && s.color) ? s.color : (DEFAULT_STAGE_COLORS[name] ?? '#9ca3af')
            return { name, color, order: i + 1 }
          })

          return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Company */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building size={15} style={{ color: '#015035' }} />
                  <h3 className="text-sm font-bold text-gray-800">Company Information</h3>
                </div>
                <button
                  onClick={() => router.push('/settings?tab=Company')}
                  className="text-xs font-medium px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={12} className="inline mr-1" />Edit
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {companyFields.map(f => (
                  <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
                    <span className="text-sm text-gray-800">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap size={15} style={{ color: '#015035' }} />
                  <h3 className="text-sm font-bold text-gray-800">Service Lines</h3>
                </div>
                <button
                  onClick={() => router.push('/settings?tab=CRM+Setup')}
                  className="text-xs font-medium px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={12} className="inline mr-1" />Edit
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {serviceTypes.map(name => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-700 font-medium">{name}</span>
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
                <button
                  onClick={() => router.push('/settings?tab=CRM+Setup')}
                  className="text-xs font-medium px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={12} className="inline mr-1" />Edit
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {pipelineStages.map(stage => (
                  <div key={stage.name} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200">
                    <span className="text-xs text-gray-400 w-4 font-mono">{stage.order}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                    <span className="text-sm text-gray-700 flex-1">{stage.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            {(() => {
              const secDefaults = { sessionTimeout: '8h', passwordPolicy: 'strong', twoFactor: 'optional', loginAttempts: 5, auditLogging: true, ipRestriction: 'disabled' }
              const sec = { ...secDefaults, ...(platformSettings?.security as Record<string, unknown> ?? {}) }
              const updateSecurity = async (field: string, value: unknown) => {
                const updated = { ...sec, [field]: value }
                try {
                  const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ security: updated }) })
                  if (res.ok) {
                    setPlatformSettings((prev: Record<string, unknown> | null) => ({ ...prev, security: updated }))
                    toast('Security setting saved', 'success')
                  } else { toast('Failed to save security setting', 'error') }
                } catch { toast('Failed to save security setting', 'error') }
              }
              return (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={15} style={{ color: '#015035' }} />
                  <h3 className="text-sm font-bold text-gray-800">Security Settings</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Session Timeout */}
                  <div className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Session Timeout</p>
                      <p className="text-[11px] text-gray-400">Auto-logout after inactivity</p>
                    </div>
                    <select value={String(sec.sessionTimeout)} onChange={e => updateSecurity('sessionTimeout', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 ml-4" style={{ focusRingColor: '#015035' } as React.CSSProperties}>
                      <option value="1h">1 hour</option>
                      <option value="4h">4 hours</option>
                      <option value="8h">8 hours</option>
                      <option value="24h">24 hours</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  {/* Password Policy */}
                  <div className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Password Policy</p>
                      <p className="text-[11px] text-gray-400">Min complexity requirements</p>
                    </div>
                    <select value={String(sec.passwordPolicy)} onChange={e => updateSecurity('passwordPolicy', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 ml-4">
                      <option value="basic">Basic (6+ chars)</option>
                      <option value="strong">Strong (8+ chars)</option>
                      <option value="very-strong">Very Strong (12+ chars)</option>
                    </select>
                  </div>
                  {/* Two-Factor Auth */}
                  <div className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Two-Factor Auth</p>
                      <p className="text-[11px] text-gray-400">Per-user 2FA setting</p>
                    </div>
                    <select value={String(sec.twoFactor)} onChange={e => updateSecurity('twoFactor', e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 ml-4">
                      <option value="disabled">Disabled</option>
                      <option value="optional">Optional</option>
                      <option value="required">Required</option>
                    </select>
                  </div>
                  {/* Login Attempts */}
                  <div className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Login Attempts</p>
                      <p className="text-[11px] text-gray-400">Brute force protection</p>
                    </div>
                    <select value={String(sec.loginAttempts)} onChange={e => updateSecurity('loginAttempts', e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 ml-4">
                      <option value="3">3 before lockout</option>
                      <option value="5">5 before lockout</option>
                      <option value="10">10 before lockout</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                  {/* Audit Logging */}
                  <div className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Audit Logging</p>
                      <p className="text-[11px] text-gray-400">Full action history</p>
                    </div>
                    <button
                      onClick={() => updateSecurity('auditLogging', !sec.auditLogging)}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-4 flex-shrink-0"
                      style={{ background: sec.auditLogging ? '#015035' : '#d1d5db' }}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${sec.auditLogging ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {/* IP Restriction */}
                  <div className="flex items-start justify-between py-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">IP Restriction</p>
                      <p className="text-[11px] text-gray-400">Restrict to office IPs</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {sec.ipRestriction === 'disabled' ? (
                        <button onClick={() => { const ips = prompt('Enter comma-separated IPs:'); if (ips) updateSecurity('ipRestriction', ips.trim()) }} className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                          Disabled &mdash; Edit
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-600 font-medium max-w-[140px] truncate">{String(sec.ipRestriction)}</span>
                          <button onClick={() => { const ips = prompt('Edit IPs (comma-separated):', String(sec.ipRestriction)); if (ips !== null) updateSecurity('ipRestriction', ips.trim() || 'disabled') }} className="text-[11px] font-medium text-emerald-700 hover:underline">Edit</button>
                          <button onClick={() => updateSecurity('ipRestriction', 'disabled')} className="text-[11px] font-medium text-red-500 hover:underline">Clear</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )
            })()}
          </div>
          )
        })()}

        {/* ── AUDIT LOG ── */}
        {tab === 'data-audit' && <DataAuditPanel />}

        {tab === 'audit' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Recent Audit Log</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/admin/audit-log')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <ScrollText size={12} /> View Full Audit Log
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
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Entities</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'contacts', label: 'Contacts' },
                    { key: 'companies', label: 'Companies' },
                    { key: 'deals', label: 'Deals' },
                    { key: 'projects', label: 'Projects' },
                    { key: 'contracts', label: 'Contracts' },
                    { key: 'invoices', label: 'Invoices' },
                    { key: 'tasks', label: 'Tasks' },
                    { key: 'time_entries', label: 'Time Entries' },
                  ].map(e => (
                    <label key={e.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportEntities[e.key] ?? false}
                        onChange={() => setExportEntities(prev => ({ ...prev, [e.key]: !prev[e.key] }))}
                        className="rounded border-gray-300 text-green-700 focus:ring-green-700"
                      />
                      {e.label}
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400">Exports as CSV format. All data visible to your role will be included.</p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                disabled={exporting}
                onClick={async () => {
                  const selected = Object.entries(exportEntities).filter(([, v]) => v).map(([k]) => k)
                  if (selected.length === 0) return
                  setExporting(true)
                  try {
                    const res = await fetch('/api/admin/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ entities: selected }),
                    })
                    if (!res.ok) throw new Error('Export failed')
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `gravhub-export-${Date.now()}.csv`
                    a.click(); URL.revokeObjectURL(url)
                    setShowExportModal(false)
                    toast('Data exported', 'success')
                  } catch {
                    toast('Export failed', 'error')
                  } finally {
                    setExporting(false)
                  }
                }}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {exporting ? 'Exporting...' : 'Download CSV'}
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

      {/* ── Send Sign-In Link Modal ── */}
      {showBulkResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={() => setShowBulkResetModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 pointer-events-auto overflow-hidden">
            <div className="p-5 border-b" style={{ background: '#012b1e' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-white text-sm font-bold">Send Sign-In Link</h3>
                <button onClick={() => setShowBulkResetModal(false)} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-gray-500">Select a user to send a sign-in link to.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select User</label>
                <select value={bulkResetTarget} onChange={e => setBulkResetTarget(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700">
                  <option value="">— Choose a user —</option>
                  {users.filter(u => u.id !== 'u0').map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Mail size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">This will send a sign-in link via email. The user can click it to log in instantly.</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={async () => {
                  const target = users.find(u => u.id === bulkResetTarget)
                  if (target) { await sendSignInLink(target); setShowBulkResetModal(false); setBulkResetTarget('') }
                }}
                disabled={!bulkResetTarget}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                Send Sign-In Link
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
                onClick={async () => {
                  try {
                    const [usersRes, contactsRes, proposalsRes, contractsRes, invoicesRes, projectsRes, dealsRes] = await Promise.all([
                      fetch('/api/team-members?include_inactive=true'),
                      fetch('/api/crm/contacts'),
                      fetch('/api/proposals'),
                      fetch('/api/contracts'),
                      fetch('/api/invoices'),
                      fetch('/api/projects'),
                      fetch('/api/deals'),
                    ])
                    const [usersData, contactsData, proposalsData, contractsData, invoicesData, projectsData, dealsData] = await Promise.all([
                      usersRes.ok ? usersRes.json() : [],
                      contactsRes.ok ? contactsRes.json() : [],
                      proposalsRes.ok ? proposalsRes.json() : [],
                      contractsRes.ok ? contractsRes.json() : [],
                      invoicesRes.ok ? invoicesRes.json() : [],
                      projectsRes.ok ? projectsRes.json() : [],
                      dealsRes.ok ? dealsRes.json() : [],
                    ])
                    const backup = JSON.stringify({
                      exportedAt: new Date().toISOString(),
                      exportedBy: user?.name,
                      modules: ['users', 'contacts', 'proposals', 'contracts', 'invoices', 'projects', 'deals'],
                      data: {
                        users: usersData,
                        contacts: contactsData,
                        proposals: proposalsData,
                        contracts: contractsData,
                        invoices: invoicesData,
                        projects: projectsData,
                        deals: dealsData,
                      },
                    }, null, 2)
                    const blob = new Blob([backup], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `gravhub-backup-${Date.now()}.json`
                    a.click(); URL.revokeObjectURL(url)
                    setBackupDone(true)
                    setTimeout(() => { setBackupDone(false); setShowBackupModal(false) }, 2000)
                  } catch {
                    toast('Failed to generate backup', 'error')
                  }
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

      {/* Remove user modal with deal reassignment */}
      {removeConfirm && (() => {
        const target = users.find(u => u.id === removeConfirm)
        if (!target) return null
        const otherReps = users.filter(u => u.id !== removeConfirm && u.status.toLowerCase() === 'active').map(u => u.name)
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
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reassign deals to</label>
                  <select
                    value={reassignTo}
                    onChange={e => setReassignTo(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select a team member...</option>
                    {otherReps.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <p className="text-xs font-semibold text-red-600">This change cannot be undone.</p>
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => removeUser(removeConfirm)}
                  disabled={!reassignTo}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  Remove & Reassign Deals
                </button>
                <button
                  onClick={() => { setRemoveConfirm(null); setReassignTo('') }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Suspend user modal */}
      {suspendModal && (() => {
        const target = users.find(u => u.id === suspendModal)
        if (!target) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b" style={{ background: '#012b1e' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-bold">Suspend {target.name}</h3>
                  <button onClick={() => { setSuspendModal(null); setSuspendReason(''); setSuspendUntil('') }} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <p className="text-xs text-gray-500">
                  This user will immediately lose access to GravHub and be hidden from all dropdowns and assignee lists.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reason (optional)</label>
                  <input
                    value={suspendReason}
                    onChange={e => setSuspendReason(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                    placeholder="e.g., Leave of absence"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Suspend until (optional)</label>
                  <input
                    type="datetime-local"
                    value={suspendUntil}
                    onChange={e => setSuspendUntil(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank for indefinite suspension. User will be auto-reinstated when this date passes.</p>
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => suspendUser(suspendModal)}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 transition-colors"
                >
                  Suspend User
                </button>
                <button onClick={() => { setSuspendModal(null); setSuspendReason(''); setSuspendUntil('') }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Schedule access modal */}
      {scheduleModal && (() => {
        const target = users.find(u => u.id === scheduleModal)
        if (!target) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b" style={{ background: '#012b1e' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-bold">Schedule Access for {target.name}</h3>
                  <button onClick={() => { setScheduleModal(null); setScheduleRemoveOn(''); setScheduleReinstateOn('') }} className="p-1 rounded hover:bg-white/10"><X size={15} className="text-white/60" /></button>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <p className="text-xs text-gray-500">
                  Schedule when this user should lose and regain access. The system will automatically enforce these windows.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Remove access on</label>
                  <input
                    type="datetime-local"
                    value={scheduleRemoveOn}
                    onChange={e => setScheduleRemoveOn(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reinstate access on (optional)</label>
                  <input
                    type="datetime-local"
                    value={scheduleReinstateOn}
                    onChange={e => setScheduleReinstateOn(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank if access should not be automatically reinstated.</p>
                </div>
                {target.accessSchedule?.removeAccessOn && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <Calendar size={13} className="text-amber-500 flex-shrink-0" />
                    <div className="text-xs text-amber-700">
                      <p>Current schedule: Remove on {new Date(target.accessSchedule.removeAccessOn).toLocaleString()}</p>
                      {target.accessSchedule.reinstateOn && <p>Reinstate on {new Date(target.accessSchedule.reinstateOn).toLocaleString()}</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => scheduleAccess(scheduleModal)}
                  disabled={!scheduleRemoveOn}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
                  style={{ background: '#015035' }}
                >
                  Save Schedule
                </button>
                <button onClick={() => { setScheduleModal(null); setScheduleRemoveOn(''); setScheduleReinstateOn('') }} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Delete confirmation modal */}
      {deleteConfirm && (() => {
        const target = users.find(u => u.id === deleteConfirm)
        if (!target) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <UserX size={18} className="text-red-500" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Delete {target.name}</h3>
                </div>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700">
                    <p className="font-semibold mb-1">This user will be:</p>
                    <ul className="list-disc ml-4 space-y-0.5">
                      <li>Hidden from all dropdowns and assignee lists</li>
                      <li>Unable to log in or access GravHub</li>
                      <li>Marked as deleted (can be reinstated by an admin)</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Their existing assignments and history will be preserved for audit purposes.</p>
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => softDeleteUser(deleteConfirm)}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Delete User
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
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
