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
  Trash2, X, Eye, EyeOff, AlertTriangle, Mail, LayoutDashboard,
  TrendingUp, Smartphone, Menu, ChevronUp, ChevronDown, RotateCcw,
} from 'lucide-react'
import {
  defaultNavigation, buildDefaultNavConfig,
  type NavConfig, type NavConfigSection, type NavConfigItem,
} from '@/components/layout/Sidebar'

const membershipColors: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-700',
  Leadership: 'bg-blue-100 text-blue-700',
  'Department Manager': 'bg-indigo-100 text-indigo-700',
  'Team Member': 'bg-gray-100 text-gray-600',
  Contractor: 'bg-yellow-100 text-yellow-700',
  Client: 'bg-green-100 text-green-700',
}

const tabs = ['Company', 'Team', 'Permissions', 'Branding', 'Email Defaults', 'Dashboard', 'Navigation', 'Notifications', 'Integrations', 'CRM Setup', 'Engagement', 'Billing'] as const
type Tab = typeof tabs[number]

const tabIcons: Record<Tab, React.ReactNode> = {
  Company: <Building size={15} />,
  Team: <Users size={15} />,
  Permissions: <Shield size={15} />,
  Branding: <Palette size={15} />,
  'Email Defaults': <Mail size={15} />,
  Dashboard: <LayoutDashboard size={15} />,
  Navigation: <Menu size={15} />,
  Notifications: <Bell size={15} />,
  Integrations: <Plug size={15} />,
  'CRM Setup': <Tag size={15} />,
  Engagement: <TrendingUp size={15} />,
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

type ChannelPref = 'in-app' | 'email+in-app' | 'muted'
type ActivityNotif = { label: string; enabled: boolean; channel: ChannelPref }

const ACTIVITY_NOTIF_DEFAULTS: ActivityNotif[] = [
  { label: 'New ticket assigned to me', enabled: true, channel: 'in-app' },
  { label: 'Ticket status changed', enabled: true, channel: 'in-app' },
  { label: 'New deal created', enabled: false, channel: 'in-app' },
  { label: 'Deal stage changed', enabled: true, channel: 'in-app' },
  { label: 'Contract signed', enabled: true, channel: 'email+in-app' },
  { label: 'Invoice overdue', enabled: true, channel: 'email+in-app' },
  { label: 'Task assigned to me', enabled: true, channel: 'in-app' },
  { label: 'Task due today', enabled: true, channel: 'in-app' },
  { label: 'New form submission', enabled: true, channel: 'in-app' },
  { label: 'Proposal accepted/declined', enabled: true, channel: 'email+in-app' },
  { label: 'New contact created', enabled: false, channel: 'in-app' },
]

const QUIET_HOURS_DEFAULTS = {
  enabled: false,
  start: '22:00',
  end: '08:00',
}

const CHANNEL_OPTIONS: { value: ChannelPref; label: string }[] = [
  { value: 'in-app', label: 'In-app only' },
  { value: 'email+in-app', label: 'Email + in-app' },
  { value: 'muted', label: 'Muted' },
]

const BRANDING_DEFAULTS = {
  primaryColor: '#015035',
  secondaryColor: '#FFF3EA',
  appName: 'GravHub',
  darkBackground: '#012b1e',
  logoText: 'GravHub',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  dangerColor: '#dc2626',
  infoColor: '#3b82f6',
}

const EMAIL_DEFAULTS = {
  fromName: 'GravHub',
  fromEmail: 'noreply@app.gravissmarketing.com',
  replyTo: '',
  supportEmail: '',
  signatureRequestFrom: '',
  footerText: '',
}

const DASHBOARD_DEFAULTS = {
  greetings: {
    morning: 'Good Morning',
    afternoon: 'Good Afternoon',
    evening: 'Good Evening',
    night: 'Burning the midnight oil',
  },
  rotatingMessages: [] as { message: string; emoji: string }[],
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

const ENGAGEMENT_DEFAULTS = {
  points: { emailOpened: 5, linkClicked: 10, proposalViewed: 15, meetingHeld: 20 },
  thresholds: { cold: 20, hot: 60 },
}

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { user, gmailToken, gmailEmail, connectGmail, disconnectGmail, addUser, members: authMembers } = useAuth()
  const searchParams   = useSearchParams()
  const router         = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const t = searchParams.get('tab')
      if (t === 'integrations') return 'Integrations'
      if (t === 'notifications') return 'Notifications'
      if (t === 'navigation') return 'Navigation'
    }
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
  const [activityNotifs, setActivityNotifs] = useState<ActivityNotif[]>(ACTIVITY_NOTIF_DEFAULTS)
  const [quietHours, setQuietHours] = useState(QUIET_HOURS_DEFAULTS)

  // Branding
  const [branding, setBranding] = useState(BRANDING_DEFAULTS)

  // Email Defaults
  const [emailDefaults, setEmailDefaults] = useState(EMAIL_DEFAULTS)

  // Dashboard Config
  const [dashboardConfig, setDashboardConfig] = useState(DASHBOARD_DEFAULTS)

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

  // Engagement
  const [engagement, setEngagement] = useState(ENGAGEMENT_DEFAULTS)

  // Navigation config
  const [navConfig, setNavConfig] = useState<NavConfig>(buildDefaultNavConfig)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Load from API on mount (fall back to localStorage for backwards-compat, then defaults)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.id) {
          setCompany(loadLS('gravhub_company', COMPANY_DEFAULTS))
          setActivityNotifs(loadLS('gravhub_activity_notifs', ACTIVITY_NOTIF_DEFAULTS))
          setQuietHours(loadLS('gravhub_quiet_hours', QUIET_HOURS_DEFAULTS))
          setInvoiceDefaults(loadLS('gravhub_invoice_defaults', INVOICE_DEFAULTS))
          setServiceTypes(loadLS('gravhub_service_types', SERVICE_TYPES_DEFAULT))
          setContactTags(loadLS('gravhub_contact_tags', CONTACT_TAGS_DEFAULT))
          setBranding(loadLS('gravhub_branding', BRANDING_DEFAULTS))
          setQbSync(loadLS('gravhub_qb_sync', QB_SYNC_DEFAULTS))
          return
        }
        if (d.company          && Object.keys(d.company).length)           setCompany(d.company)
        if (Array.isArray(d.notification_preferences?.activity) && d.notification_preferences.activity.length) setActivityNotifs(d.notification_preferences.activity)
        if (d.notification_preferences?.quiet_hours) setQuietHours(prev => ({ ...prev, ...d.notification_preferences.quiet_hours }))
        if (d.invoice_defaults && Object.keys(d.invoice_defaults).length)  setInvoiceDefaults(d.invoice_defaults)
        if (Array.isArray(d.pipelines) && d.pipelines.length) setPipelines(d.pipelines)
        else if (Array.isArray(d.pipeline_stages) && d.pipeline_stages.length) setPipelines([{ id: 'sales', name: 'Sales Pipeline', stages: d.pipeline_stages.map((name: string, i: number) => ({ id: `s${i}`, name, color: STAGE_COLORS_CYCLE[i % STAGE_COLORS_CYCLE.length] })) }])
        if (Array.isArray(d.service_types)   && d.service_types.length)    setServiceTypes(d.service_types)
        if (Array.isArray(d.contact_tags)    && d.contact_tags.length)     setContactTags(d.contact_tags)
        if (d.branding         && Object.keys(d.branding).length)          setBranding(prev => ({ ...prev, ...d.branding }))
        if (d.email_defaults   && Object.keys(d.email_defaults).length)    setEmailDefaults(prev => ({ ...prev, ...d.email_defaults }))
        if (d.dashboard_config && Object.keys(d.dashboard_config).length)  setDashboardConfig(prev => ({ ...prev, ...d.dashboard_config }))
        if (Array.isArray(d.qb_sync)         && d.qb_sync.length)          setQbSync(d.qb_sync)
        if (d.engagement && Object.keys(d.engagement).length) setEngagement(prev => ({ points: { ...prev.points, ...d.engagement.points }, thresholds: { ...prev.thresholds, ...d.engagement.thresholds } }))
        if (d.navigation_config?.sections?.length) setNavConfig(d.navigation_config)
      })
      .catch(() => {
        setCompany(loadLS('gravhub_company', COMPANY_DEFAULTS))
        setActivityNotifs(loadLS('gravhub_activity_notifs', ACTIVITY_NOTIF_DEFAULTS))
        setQuietHours(loadLS('gravhub_quiet_hours', QUIET_HOURS_DEFAULTS))
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
    patchSettings({ notification_preferences: { activity: activityNotifs, quiet_hours: quietHours } }, 'Notifications')
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
    document.documentElement.style.setProperty('--brand-primary', branding.primaryColor)
    document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor)
    document.documentElement.style.setProperty('--brand-success', branding.successColor)
    document.documentElement.style.setProperty('--brand-warning', branding.warningColor)
    document.documentElement.style.setProperty('--brand-danger', branding.dangerColor)
    document.documentElement.style.setProperty('--brand-info', branding.infoColor)
  }

  function saveEmailDefaults() {
    patchSettings({ emailDefaults }, 'Email Defaults')
  }

  function saveDashboardConfig() {
    patchSettings({ dashboardConfig }, 'Dashboard')
  }

  function saveQbSync() {
    patchSettings({ qbSync }, 'QB Sync')
  }

  function saveEngagement() {
    patchSettings({ engagement }, 'Engagement')
  }

  function saveNavConfig() {
    patchSettings({ navigationConfig: navConfig }, 'Navigation')
  }

  function resetNavConfig() {
    const fresh = buildDefaultNavConfig()
    setNavConfig(fresh)
    patchSettings({ navigationConfig: fresh }, 'Navigation')
  }

  function moveSectionUp(idx: number) {
    if (idx === 0) return
    setNavConfig(prev => {
      const sections = [...prev.sections]
      const aOrder = sections[idx].order
      sections[idx] = { ...sections[idx], order: sections[idx - 1].order }
      sections[idx - 1] = { ...sections[idx - 1], order: aOrder }
      sections.sort((a, b) => a.order - b.order)
      return { sections }
    })
  }

  function moveSectionDown(idx: number) {
    setNavConfig(prev => {
      if (idx >= prev.sections.length - 1) return prev
      const sections = [...prev.sections]
      const aOrder = sections[idx].order
      sections[idx] = { ...sections[idx], order: sections[idx + 1].order }
      sections[idx + 1] = { ...sections[idx + 1], order: aOrder }
      sections.sort((a, b) => a.order - b.order)
      return { sections }
    })
  }

  function toggleSectionVisible(id: string) {
    setNavConfig(prev => ({
      sections: prev.sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s),
    }))
  }

  function renameSectionLabel(id: string, label: string) {
    setNavConfig(prev => ({
      sections: prev.sections.map(s => s.id === id ? { ...s, label } : s),
    }))
  }

  function toggleItemVisible(sectionId: string, href: string) {
    setNavConfig(prev => ({
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? { ...s, items: s.items.map(it => it.href === href ? { ...it, visible: !it.visible } : it) }
          : s,
      ),
    }))
  }

  function moveItemUp(sectionId: string, itemIdx: number) {
    if (itemIdx === 0) return
    setNavConfig(prev => ({
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s
        const items = [...s.items]
        const aOrder = items[itemIdx].order
        items[itemIdx] = { ...items[itemIdx], order: items[itemIdx - 1].order }
        items[itemIdx - 1] = { ...items[itemIdx - 1], order: aOrder }
        items.sort((a, b) => a.order - b.order)
        return { ...s, items }
      }),
    }))
  }

  function moveItemDown(sectionId: string, itemIdx: number) {
    setNavConfig(prev => ({
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s
        if (itemIdx >= s.items.length - 1) return s
        const items = [...s.items]
        const aOrder = items[itemIdx].order
        items[itemIdx] = { ...items[itemIdx], order: items[itemIdx + 1].order }
        items[itemIdx + 1] = { ...items[itemIdx + 1], order: aOrder }
        items.sort((a, b) => a.order - b.order)
        return { ...s, items }
      }),
    }))
  }

  function moveItemToSection(fromSectionId: string, href: string, toSectionId: string) {
    setNavConfig(prev => {
      const fromSection = prev.sections.find(s => s.id === fromSectionId)
      if (!fromSection) return prev
      const item = fromSection.items.find(it => it.href === href)
      if (!item) return prev
      return {
        sections: prev.sections.map(s => {
          if (s.id === fromSectionId) {
            return { ...s, items: s.items.filter(it => it.href !== href) }
          }
          if (s.id === toSectionId) {
            const maxOrder = s.items.length > 0 ? Math.max(...s.items.map(it => it.order)) : -1
            return { ...s, items: [...s.items, { ...item, order: maxOrder + 1 }] }
          }
          return s
        }),
      }
    })
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
            {tabs.filter(tab => tab !== 'Navigation' || user?.isAdmin).map(tab => (
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
              <EditableField label="App Name" value={branding.appName} onChange={v => setBranding(p => ({ ...p, appName: v }))} />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dark Background</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.darkBackground }} />
                  <input
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                    value={branding.darkBackground}
                    onChange={e => setBranding(p => ({ ...p, darkBackground: e.target.value }))}
                  />
                  <input type="color" value={branding.darkBackground} onChange={e => setBranding(p => ({ ...p, darkBackground: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
              </div>
              <EditableField label="Logo Text" value={branding.logoText} onChange={v => setBranding(p => ({ ...p, logoText: v }))} />
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
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-4">Accent Colors</h4>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Success Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.successColor }} />
                      <input
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                        value={branding.successColor}
                        onChange={e => setBranding(p => ({ ...p, successColor: e.target.value }))}
                      />
                      <input type="color" value={branding.successColor} onChange={e => setBranding(p => ({ ...p, successColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Warning Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.warningColor }} />
                      <input
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                        value={branding.warningColor}
                        onChange={e => setBranding(p => ({ ...p, warningColor: e.target.value }))}
                      />
                      <input type="color" value={branding.warningColor} onChange={e => setBranding(p => ({ ...p, warningColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Danger Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.dangerColor }} />
                      <input
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                        value={branding.dangerColor}
                        onChange={e => setBranding(p => ({ ...p, dangerColor: e.target.value }))}
                      />
                      <input type="color" value={branding.dangerColor} onChange={e => setBranding(p => ({ ...p, dangerColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Info Color</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ background: branding.infoColor }} />
                      <input
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700"
                        value={branding.infoColor}
                        onChange={e => setBranding(p => ({ ...p, infoColor: e.target.value }))}
                      />
                      <input type="color" value={branding.infoColor} onChange={e => setBranding(p => ({ ...p, infoColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={saveBranding} className="w-fit flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                {saved === 'Branding' ? <><CheckCircle size={14} /> Saved!</> : 'Save Branding'}
              </button>
            </div>
          </div>
        )}

        {/* ── Email Defaults ── */}
        {activeTab === 'Email Defaults' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Email Defaults</h3>
              {saved === 'Email Defaults' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <EditableField label="From Name" value={emailDefaults.fromName} onChange={v => setEmailDefaults(p => ({ ...p, fromName: v }))} />
              <EditableField label="From Email" value={emailDefaults.fromEmail} onChange={v => setEmailDefaults(p => ({ ...p, fromEmail: v }))} type="email" />
              <EditableField label="Reply-To Email" value={emailDefaults.replyTo} onChange={v => setEmailDefaults(p => ({ ...p, replyTo: v }))} type="email" />
              <EditableField label="Support Email" value={emailDefaults.supportEmail} onChange={v => setEmailDefaults(p => ({ ...p, supportEmail: v }))} type="email" />
              <EditableField label="Signature Request From" value={emailDefaults.signatureRequestFrom} onChange={v => setEmailDefaults(p => ({ ...p, signatureRequestFrom: v }))} />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Footer Text</label>
              <textarea
                value={emailDefaults.footerText}
                onChange={e => setEmailDefaults(p => ({ ...p, footerText: e.target.value }))}
                placeholder="Custom text appended to email footer"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors resize-none"
              />
            </div>
            <p className="text-[11px] text-gray-400 mb-5">These defaults are used in all outgoing emails (invites, proposals, contracts, broadcasts)</p>
            <button onClick={saveEmailDefaults} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Email Defaults' ? <><CheckCircle size={14} /> Saved!</> : 'Save Email Defaults'}
            </button>
          </div>
        )}

        {/* ── Dashboard ── */}
        {activeTab === 'Dashboard' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Greeting Messages</h3>
                {saved === 'Dashboard' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Morning Greeting" value={dashboardConfig.greetings.morning} onChange={v => setDashboardConfig(p => ({ ...p, greetings: { ...p.greetings, morning: v } }))} />
                <EditableField label="Afternoon Greeting" value={dashboardConfig.greetings.afternoon} onChange={v => setDashboardConfig(p => ({ ...p, greetings: { ...p.greetings, afternoon: v } }))} />
                <EditableField label="Evening Greeting" value={dashboardConfig.greetings.evening} onChange={v => setDashboardConfig(p => ({ ...p, greetings: { ...p.greetings, evening: v } }))} />
                <EditableField label="Night Greeting" value={dashboardConfig.greetings.night} onChange={v => setDashboardConfig(p => ({ ...p, greetings: { ...p.greetings, night: v } }))} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Rotating Messages</h3>
              </div>
              <div className="flex flex-col gap-2 mb-3">
                {dashboardConfig.rotatingMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      value={msg.message}
                      onChange={e => setDashboardConfig(p => ({ ...p, rotatingMessages: p.rotatingMessages.map((m, j) => j === i ? { ...m, message: e.target.value } : m) }))}
                      placeholder="Message text"
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    />
                    <input
                      value={msg.emoji}
                      onChange={e => setDashboardConfig(p => ({ ...p, rotatingMessages: p.rotatingMessages.map((m, j) => j === i ? { ...m, emoji: e.target.value } : m) }))}
                      placeholder="Emoji"
                      className="w-16 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors text-center"
                    />
                    <button
                      onClick={() => setDashboardConfig(p => ({ ...p, rotatingMessages: p.rotatingMessages.filter((_, j) => j !== i) }))}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setDashboardConfig(p => ({ ...p, rotatingMessages: [...p.rotatingMessages, { message: '', emoji: '' }] }))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium"
                style={{ background: '#015035' }}
              >
                <Plus size={12} /> Add Message
              </button>
            </div>

            <button onClick={saveDashboardConfig} className="w-fit flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Dashboard' ? <><CheckCircle size={14} /> Saved!</> : 'Save Dashboard Settings'}
            </button>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'Notifications' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Activity Notifications</h3>
                {saved === 'Notifications' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
              </div>
              <div className="hidden sm:grid grid-cols-[1fr_80px_160px] gap-x-4 px-3 pb-2 border-b border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Event</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Enabled</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Channel</span>
              </div>
              <div className="flex flex-col">
                {activityNotifs.map(n => (
                  <div key={n.label} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_160px] gap-x-4 gap-y-2 items-center py-3 px-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{n.label}</span>
                    <div className="flex sm:justify-center">
                      <Toggle enabled={n.enabled} onChange={() => setActivityNotifs(prev => prev.map(x => x.label === n.label ? { ...x, enabled: !x.enabled } : x))} />
                    </div>
                    <select
                      value={n.channel}
                      onChange={e => setActivityNotifs(prev => prev.map(x => x.label === n.label ? { ...x, channel: e.target.value as ChannelPref } : x))}
                      disabled={!n.enabled}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-gray-50 focus:outline-none focus:border-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {CHANNEL_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-5" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Quiet Hours</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-700 font-medium">Enable quiet hours</p>
                  <p className="text-xs text-gray-400 mt-0.5">During quiet hours, notifications are queued and delivered after</p>
                </div>
                <Toggle enabled={quietHours.enabled} onChange={() => setQuietHours(prev => ({ ...prev, enabled: !prev.enabled }))} />
              </div>
              {quietHours.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pl-0 sm:pl-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={quietHours.start}
                      onChange={e => setQuietHours(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={quietHours.end}
                      onChange={e => setQuietHours(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveNotifications} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Notifications' ? <><CheckCircle size={14} /> Saved!</> : 'Save Preferences'}
            </button>
          </div>
        )}

        {/* ── Integrations ── */}
        {activeTab === 'Integrations' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Connected Integrations</h3>

            <MarketingIntegrationsSection />

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

            <HubSpotIntegrationSection />

            <SmsIntegrationSection />
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

        {/* ── Engagement ── */}
        {activeTab === 'Engagement' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Point Values</h3>
                {saved === 'Engagement' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
              </div>
              <p className="text-xs text-gray-500 mb-4">Points awarded per activity when calculating a contact&apos;s engagement score.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Email Opened" value={String(engagement.points.emailOpened)} onChange={v => setEngagement(p => ({ ...p, points: { ...p.points, emailOpened: Number(v) || 0 } }))} type="number" />
                <EditableField label="Link Clicked" value={String(engagement.points.linkClicked)} onChange={v => setEngagement(p => ({ ...p, points: { ...p.points, linkClicked: Number(v) || 0 } }))} type="number" />
                <EditableField label="Proposal Viewed" value={String(engagement.points.proposalViewed)} onChange={v => setEngagement(p => ({ ...p, points: { ...p.points, proposalViewed: Number(v) || 0 } }))} type="number" />
                <EditableField label="Meeting Held" value={String(engagement.points.meetingHeld)} onChange={v => setEngagement(p => ({ ...p, points: { ...p.points, meetingHeld: Number(v) || 0 } }))} type="number" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Score Thresholds</h3>
              <p className="text-xs text-gray-500 mb-4">Define the boundaries between Cold, Warm, and Hot engagement levels.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cold Below</label>
                  <input
                    type="number"
                    value={engagement.thresholds.cold}
                    onChange={e => setEngagement(p => ({ ...p, thresholds: { ...p.thresholds, cold: Number(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hot Above</label>
                  <input
                    type="number"
                    value={engagement.thresholds.hot}
                    onChange={e => setEngagement(p => ({ ...p, thresholds: { ...p.thresholds, hot: Number(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Cold: below {engagement.thresholds.cold}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Warm: {engagement.thresholds.cold} &ndash; {engagement.thresholds.hot}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Hot: above {engagement.thresholds.hot}</span>
              </div>
            </div>

            <button onClick={saveEngagement} className="w-fit flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              {saved === 'Engagement' ? <><CheckCircle size={14} /> Saved!</> : 'Save Engagement Settings'}
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

        {activeTab === 'Navigation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>Sidebar Navigation</h3>
                  <div className="flex items-center gap-2">
                    {saved === 'Navigation' && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle size={12} /> Saved!</span>}
                    <button onClick={resetNavConfig} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <RotateCcw size={12} /> Reset to Default
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[...navConfig.sections].sort((a, b) => a.order - b.order).map((section, sIdx) => {
                    const isExpanded = expandedSections.has(section.id)
                    const defaultSection = defaultNavigation.find(s => s.section.toLowerCase().replace(/\s+/g, '-') === section.id)
                    return (
                      <div key={section.id} className={`border rounded-xl overflow-hidden transition-colors ${section.visible ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 px-4 py-3">
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => moveSectionUp(sIdx)}
                              disabled={sIdx === 0}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={() => moveSectionDown(sIdx)}
                              disabled={sIdx === navConfig.sections.length - 1}
                              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => setExpandedSections(prev => {
                              const next = new Set(prev)
                              if (next.has(section.id)) next.delete(section.id)
                              else next.add(section.id)
                              return next
                            })}
                            className="flex-1 flex items-center gap-2 text-left"
                          >
                            <ChevronRight size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <input
                              type="text"
                              value={section.label}
                              onClick={e => e.stopPropagation()}
                              onChange={e => renameSectionLabel(section.id, e.target.value)}
                              className="text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-green-700 focus:outline-none px-1 py-0.5 -ml-1 w-40"
                            />
                            <span className="text-[10px] text-gray-400">{section.items.length} items</span>
                          </button>
                          <Toggle enabled={section.visible} onChange={() => toggleSectionVisible(section.id)} />
                        </div>
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-4 py-2">
                            {[...section.items].sort((a, b) => a.order - b.order).map((item, iIdx) => {
                              const navItem = defaultSection?.items.find(ni => ni.href === item.href)
                              const label = navItem?.label ?? item.href
                              return (
                                <div key={item.href} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                    <button
                                      onClick={() => moveItemUp(section.id, iIdx)}
                                      disabled={iIdx === 0}
                                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:hover:bg-transparent"
                                    >
                                      <ChevronUp size={11} />
                                    </button>
                                    <button
                                      onClick={() => moveItemDown(section.id, iIdx)}
                                      disabled={iIdx === section.items.length - 1}
                                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:hover:bg-transparent"
                                    >
                                      <ChevronDown size={11} />
                                    </button>
                                  </div>
                                  <span className={`text-sm flex-1 ${item.visible ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                                  <select
                                    value={section.id}
                                    onChange={e => moveItemToSection(section.id, item.href, e.target.value)}
                                    className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:border-green-700"
                                  >
                                    {navConfig.sections.map(s => (
                                      <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                  </select>
                                  <Toggle enabled={item.visible} onChange={() => toggleItemVisible(section.id, item.href)} />
                                </div>
                              )
                            })}
                            {section.items.length === 0 && (
                              <p className="text-xs text-gray-400 py-3 text-center">No items in this section</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={saveNavConfig} className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
                  {saved === 'Navigation' ? <><CheckCircle size={14} /> Saved!</> : 'Save Navigation'}
                </button>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-4">Preview</h4>
                <div className="rounded-xl overflow-hidden" style={{ background: '#012b1e' }}>
                  <div className="px-3 py-3">
                    {[...navConfig.sections]
                      .filter(s => s.visible)
                      .sort((a, b) => a.order - b.order)
                      .map(section => {
                        const defaultSection = defaultNavigation.find(s => s.section.toLowerCase().replace(/\s+/g, '-') === section.id)
                        const visibleItems = [...section.items].filter(it => it.visible).sort((a, b) => a.order - b.order)
                        if (visibleItems.length === 0) return null
                        return (
                          <div key={section.id} className="mb-2.5">
                            <p className="text-white/30 text-[9px] font-semibold tracking-widest uppercase px-2 mb-1">{section.label}</p>
                            {visibleItems.map(item => {
                              const navItem = defaultSection?.items.find(ni => ni.href === item.href)
                              return (
                                <div key={item.href} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-white/50">
                                  <div className="w-3.5 h-3.5 rounded bg-white/10 flex-shrink-0" />
                                  <span className="text-[11px]">{navItem?.label ?? item.href}</span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
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

// ───────────────────────────────────────────────────────────────────────────
// Marketing integrations (Phase C: GSC, GA4, Ads, GBP, Meta)
// ───────────────────────────────────────────────────────────────────────────

interface MarketingStatus {
  product: 'search_console' | 'analytics' | 'ads' | 'business_profile'
  connected: boolean
  accountEmail: string | null
  lastSyncAt: string | null
  connectedAt: string | null
  reauthRequired: boolean
}

interface MetaStatus {
  connected: boolean
  accountEmail: string | null
  lastSyncAt: string | null
  connectedAt: string | null
  reauthRequired: boolean
}

const GOOGLE_PRODUCT_META: Record<MarketingStatus['product'], { name: string; description: string; icon: string }> = {
  search_console:   { name: 'Google Search Console', description: 'Pull keyword impressions, clicks, and ranking data for client reporting.', icon: '🔍' },
  analytics:        { name: 'Google Analytics 4',    description: 'Display session, user, and conversion metrics in client reports.',       icon: '📊' },
  ads:              { name: 'Google Ads',            description: 'Read campaign performance for client ad-spend reporting.',               icon: '💰' },
  business_profile: { name: 'Google Business Profile', description: 'Show reviews, reply to reviews, track local insights.',                icon: '⭐' },
}

function MarketingIntegrationsSection() {
  const [statuses, setStatuses] = useState<MarketingStatus[]>([])
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null)

  useEffect(() => {
    fetch('/api/integrations/google-marketing/status')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setStatuses(data) })
      .catch(() => {/* non-fatal */})

    fetch('/api/integrations/meta/status')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetaStatus)
      .catch(() => {/* non-fatal */})
  }, [])

  const anyGoogleConnected = statuses.some((s) => s.connected)
  const anyGoogleReauth = statuses.some((s) => s.reauthRequired)
  const metaReauth = metaStatus?.reauthRequired ?? false

  async function disconnectGoogleProduct(product: MarketingStatus['product']) {
    if (!confirm(`Disconnect ${GOOGLE_PRODUCT_META[product].name}?`)) return
    try {
      const res = await fetch('/api/integrations/google-marketing/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      })
      if (res.ok) {
        setStatuses((prev) => prev.map((s) => s.product === product ? { ...s, connected: false } : s))
      }
    } catch {/* best-effort */}
  }

  async function disconnectMeta() {
    if (!confirm('Disconnect Meta Ads?')) return
    try {
      const res = await fetch('/api/integrations/meta/disconnect', { method: 'POST' })
      if (res.ok) setMetaStatus({ connected: false, accountEmail: null, lastSyncAt: null, connectedAt: null, reauthRequired: false })
    } catch {/* best-effort */}
  }

  return (
    <div className="mb-6 pb-6 border-b border-gray-100">
      {(anyGoogleReauth || metaReauth) && (
        <div className="mb-4 flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-800">
            <p className="font-semibold">Re-authorization required</p>
            <p className="text-amber-700 mt-0.5">
              At least one integration has passed the 180-day re-consent window. Click Reconnect
              below to refresh authorization. Data sync is paused until reconnected.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-800">Google Marketing</p>
          <p className="text-xs text-gray-500">Search Console, Analytics, Ads, and Business Profile — one connection, four products.</p>
        </div>
        {!anyGoogleConnected ? (
          <a
            href="/api/integrations/google-marketing/connect"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white whitespace-nowrap"
            style={{ background: '#015035' }}
          >
            Connect
          </a>
        ) : (
          <a
            href="/api/integrations/google-marketing/connect"
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
          >
            Reconnect
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {statuses.map((s) => {
          const meta = GOOGLE_PRODUCT_META[s.product]
          return (
            <div key={s.product} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="text-xl flex-shrink-0">{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{meta.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{meta.description}</p>
                {s.connected && s.accountEmail && (
                  <p className="text-[10px] text-emerald-700 truncate">Connected as {s.accountEmail}</p>
                )}
              </div>
              <span className={`text-[10px] font-semibold flex-shrink-0 ${s.connected ? 'text-emerald-600' : 'text-gray-400'}`}>
                {s.connected ? (
                  <button
                    onClick={() => disconnectGoogleProduct(s.product)}
                    className="text-[10px] font-semibold text-gray-500 hover:text-red-600 underline"
                  >
                    Disconnect
                  </button>
                ) : 'Not connected'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
        <div className="text-2xl flex-shrink-0">📘</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Meta Ads (Facebook + Instagram)</p>
          <p className="text-xs text-gray-500">Pull campaign performance for client social-media marketing reports.</p>
          {metaStatus?.connected && metaStatus.accountEmail && (
            <p className="text-[11px] text-emerald-700 mt-0.5">Connected as {metaStatus.accountEmail}</p>
          )}
        </div>
        {metaStatus?.connected ? (
          <button
            onClick={disconnectMeta}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
          >
            Disconnect
          </button>
        ) : (
          <a
            href="/api/integrations/meta/connect"
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white whitespace-nowrap"
            style={{ background: '#015035' }}
          >
            Connect
          </a>
        )}
      </div>
    </div>
  )
}

function HubSpotIntegrationSection() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const key = d?.hubspot?.apiKey
        if (key) {
          setApiKey(key)
          setStatus('connected')
        }
      })
      .catch(() => {})
  }, [])

  async function handleTest() {
    if (!apiKey.trim()) return
    setStatus('testing')
    setErrorMsg('')
    try {
      const res = await fetch('/api/integrations/hubspot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (data.connected) {
        setStatus('connected')
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Connection failed')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Failed to test connection')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubspot: { apiKey: apiKey.trim() } }),
      })
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Globe size={18} className="text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">HubSpot</p>
          <p className="text-xs text-gray-500">Import contacts, companies, and deals from HubSpot CRM</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {status === 'connected' && <CheckCircle size={13} className="text-emerald-600" />}
          {status === 'error' && <AlertCircle size={13} className="text-red-500" />}
          <span className={`text-[11px] font-semibold ${
            status === 'connected' ? 'text-emerald-600' :
            status === 'error' ? 'text-red-500' :
            'text-gray-400'
          }`}>
            {status === 'connected' ? 'Connected' :
             status === 'error' ? 'Connection Failed' :
             status === 'testing' ? 'Testing...' :
             'Not Connected'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); if (status === 'connected' || status === 'error') setStatus('idle') }}
              placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={!apiKey.trim() || status === 'testing'}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            {status === 'testing' && <RefreshCw size={13} className="animate-spin" />}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SmsIntegrationSection() {
  const [sid, setSid] = useState('')
  const [token, setToken] = useState('')
  const [phone, setPhone] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')

  function handleTest() {
    if (!sid.trim() || !token.trim() || !phone.trim()) return
    setStatus('testing')
    setTimeout(() => {
      setStatus('connected')
    }, 1500)
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Smartphone size={18} className="text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">SMS / Twilio</p>
          <p className="text-xs text-gray-500">Send SMS messages to contacts via Twilio</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {status === 'connected' && <CheckCircle size={13} className="text-emerald-600" />}
          {status === 'error' && <AlertCircle size={13} className="text-red-500" />}
          <span className={`text-[11px] font-semibold ${
            status === 'connected' ? 'text-emerald-600' :
            status === 'error' ? 'text-red-500' :
            'text-gray-400'
          }`}>
            {status === 'connected' ? 'Connected' :
             status === 'error' ? 'Connection Failed' :
             status === 'testing' ? 'Testing...' :
             'Not Connected'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Account SID</label>
          <input
            type="text"
            value={sid}
            onChange={e => setSid(e.target.value)}
            placeholder="AC..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Auth Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Your Twilio auth token"
              className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Twilio Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
          />
        </div>
        <button
          onClick={handleTest}
          disabled={!sid.trim() || !token.trim() || !phone.trim() || status === 'testing'}
          className="self-start flex items-center gap-2 px-4 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          style={{ background: '#015035' }}
        >
          {status === 'testing' && <RefreshCw size={13} className="animate-spin" />}
          Test Connection
        </button>
      </div>
    </div>
  )
}
