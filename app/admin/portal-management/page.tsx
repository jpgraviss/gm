'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import CompanySelect from '@/components/ui/CompanySelect'
import {
  Building, Users, Plus, Trash2, Save, ChevronDown, ChevronRight,
  Mail, Shield, Eye, X, Search, Clock, UserPlus,
  FileText, BarChart3, Globe, CreditCard, Megaphone, Palette,
  MessageSquare, BookOpen, ArrowLeft, Image, Paintbrush,
  Target, PenTool, GraduationCap, Lightbulb, Upload, Calendar,
  RefreshCw, ExternalLink, Check, Monitor,
} from 'lucide-react'

const ALL_SERVICES = [
  { key: 'SEO', label: 'SEO', description: 'Search engine optimization & organic growth', icon: Search, color: '#015035', href: '/portal/seo' },
  { key: 'PPC', label: 'PPC', description: 'Pay-per-click advertising & paid search', icon: Target, color: '#2563eb', href: '/portal/ppc' },
  { key: 'Web Design', label: 'Web Design', description: 'Website design, development & maintenance', icon: Globe, color: '#7c3aed', href: '/portal/web-design' },
  { key: 'Social Media', label: 'Social Media', description: 'Social media management & strategy', icon: Megaphone, color: '#ec4899', href: '/portal/social-media' },
  { key: 'Email Marketing', label: 'Email Marketing', description: 'Email campaigns, automation & nurturing', icon: Mail, color: '#0891b2', href: '/portal/email-marketing' },
  { key: 'Content Creation', label: 'Content Creation', description: 'Blog posts, copywriting & content strategy', icon: PenTool, color: '#ea580c', href: '/portal/content-creation' },
  { key: 'Sales Training', label: 'Sales Training', description: 'Sales coaching, scripts & training programs', icon: GraduationCap, color: '#be123c', href: '/portal/sales-training' },
  { key: 'Marketing Strategy', label: 'Marketing Strategy', description: 'Full-funnel marketing strategy & consulting', icon: Lightbulb, color: '#4f46e5', href: '/portal/marketing-strategy' },
] as const

type ServiceKey = typeof ALL_SERVICES[number]['key']

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'annually'] as const
type Frequency = typeof FREQUENCIES[number]

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannually: 'Semiannually',
  annually: 'Annually',
}

function getNextUpdateDate(lastUpdated: string, frequency: Frequency): string {
  if (!lastUpdated) return ''
  const d = new Date(lastUpdated + 'T12:00:00')
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'biweekly': d.setDate(d.getDate() + 14); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'semiannually': d.setMonth(d.getMonth() + 6); break
    case 'annually': d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

interface ServiceConfig {
  enabled: boolean
  frequency: Frequency
  last_updated: string
  strategy: string
}

interface ReportEntry {
  title: string
  date: string
  file_url: string
  type: 'manual'
}

interface PortalConfig {
  services: ServiceKey[]
  visibility: {
    showAgreement: boolean
    showRenewalInfo: boolean
    showInvoices: boolean
    showSeoStrategy: boolean
    showReports: boolean
  }
  welcomeMessage: string
  seoStrategy: string
  client_logo_url: string
  client_brand_color: string
  services_config: Record<string, ServiceConfig>
  reports: ReportEntry[]
}

interface PortalMember {
  id: string
  contact: string
  email: string
  lastLogin: string
  role: string
  access: string
}

interface CompanyGroup {
  // AUDIT #187 — identity used for state/lookups (Map keys, ref keys,
  // React `key`, .find/.filter comparisons). `company` is DISPLAY ONLY:
  // it is not unique (two distinct companies can share a name), so it must
  // never be used to identify *which* card an action applies to. When a
  // client row is linked to a real CRM company, groupKey is derived from
  // companyId (collision-proof); otherwise it falls back to the name.
  groupKey: string
  company: string
  companyId: string | null
  members: PortalMember[]
  portalConfig: PortalConfig
}

const defaultConfig: PortalConfig = {
  services: [],
  visibility: {
    showAgreement: true,
    showRenewalInfo: false,
    showInvoices: true,
    showSeoStrategy: false,
    showReports: true,
  },
  welcomeMessage: '',
  seoStrategy: '',
  client_logo_url: '',
  client_brand_color: '',
  services_config: {},
  reports: [],
}

function parseConfig(raw: unknown): PortalConfig {
  if (!raw || typeof raw !== 'object') return { ...defaultConfig }
  const obj = raw as Record<string, unknown>
  return {
    services: Array.isArray(obj.services) ? obj.services as ServiceKey[] : [],
    visibility: {
      showAgreement: (obj.visibility as Record<string, unknown>)?.showAgreement !== false,
      showRenewalInfo: (obj.visibility as Record<string, unknown>)?.showRenewalInfo === true,
      showInvoices: (obj.visibility as Record<string, unknown>)?.showInvoices !== false,
      showSeoStrategy: (obj.visibility as Record<string, unknown>)?.showSeoStrategy === true,
      showReports: (obj.visibility as Record<string, unknown>)?.showReports !== false,
    },
    welcomeMessage: typeof obj.welcomeMessage === 'string' ? obj.welcomeMessage : '',
    seoStrategy: typeof obj.seoStrategy === 'string' ? obj.seoStrategy : '',
    client_logo_url: typeof obj.client_logo_url === 'string' ? obj.client_logo_url : '',
    client_brand_color: typeof obj.client_brand_color === 'string' ? obj.client_brand_color : '',
    services_config: (obj.services_config && typeof obj.services_config === 'object') ? obj.services_config as Record<string, ServiceConfig> : {},
    reports: Array.isArray(obj.reports) ? obj.reports as ReportEntry[] : [],
  }
}

export default function PortalManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [companies, setCompanies] = useState<CompanyGroup[]>([])
  const companiesRef = useRef(companies)
  useEffect(() => { companiesRef.current = companies }, [companies])
  // AUDIT #189 — per-company save queue. Both saveCompanyConfig (manual
  // "Save Configuration") and autoSaveCompanyConfig (toggle autosaves) PATCH
  // the entire portal_config blob with no merge/version check server-side;
  // rapid successive toggles, or a manual save while an autosave is still
  // in flight, could let a stale request's write land after a newer one's
  // and clobber it. Chaining saves per company (and always reading the
  // LATEST config at the moment each queued save actually runs, via
  // companiesRef) guarantees requests are issued in order and the last one
  // in the chain always carries the most current state.
  const saveChainRef = useRef<Record<string, Promise<void>>>({})
  // AUDIT #189 — Logo URL/Brand Color/Welcome Message/legacy SEO Strategy/
  // per-service Frequency fields are pure local state with no autosave and
  // no unsaved-changes warning — collapsing the panel or navigating away
  // could silently lose them. Snapshot the last-saved config per company so
  // we can detect and warn on real drift instead of blindly saving on
  // every render.
  const savedConfigRef = useRef<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [savingCompany, setSavingCompany] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Viewer' as 'Admin' | 'Viewer' })
  const [inviting, setInviting] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [reportModal, setReportModal] = useState<string | null>(null)
  const [reportForm, setReportForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], file_url: '' })
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({})
  const [autoSaved, setAutoSaved] = useState<string | null>(null)
  const [autoSaving, setAutoSaving] = useState<string | null>(null)
  const [deletingPortal, setDeletingPortal] = useState<string | null>(null)
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false)
  const [addCompanyForm, setAddCompanyForm] = useState({ companyName: '', companyId: undefined as string | undefined, service: '' as string, contactName: '', contactEmail: '' })
  const [addingCompany, setAddingCompany] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.replace('/admin')
    }
  }, [user, authLoading, router])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/portal-clients')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      const grouped = new Map<string, CompanyGroup>()
      for (const client of data) {
        const companyId: string | null = client.companyId ?? null
        // AUDIT #187 — group by companyId when linked to a real CRM
        // company (collision-proof), falling back to the name only for
        // legacy/unlinked rows. Two distinct companies that happen to
        // share a display name now become two separate cards.
        const groupKey = companyId ? `id:${companyId}` : `name:${client.company}`
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            groupKey,
            company: client.company,
            companyId,
            members: [],
            portalConfig: parseConfig(client.portalConfig),
          })
        }
        grouped.get(groupKey)!.members.push({
          id: client.id,
          contact: client.contact,
          email: client.email,
          lastLogin: client.lastLogin,
          role: client.role ?? 'Viewer',
          access: client.access,
        })
      }
      const list = Array.from(grouped.values()).sort((a, b) => a.company.localeCompare(b.company))
      setCompanies(list)
      for (const g of list) savedConfigRef.current[g.groupKey] = JSON.stringify(g.portalConfig)
    } catch {
      toast('Failed to load portal clients', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchClients() }, [fetchClients])

  const updateConfig = (groupKey: string, updater: (prev: PortalConfig) => PortalConfig) => {
    setCompanies(prev => prev.map(g =>
      g.groupKey === groupKey ? { ...g, portalConfig: updater(g.portalConfig) } : g
    ))
  }

  function isDirty(groupKey: string): boolean {
    const group = companies.find(g => g.groupKey === groupKey)
    if (!group) return false
    return JSON.stringify(group.portalConfig) !== savedConfigRef.current[groupKey]
  }

  // AUDIT #189 — warn on an actual page unload/close/refresh with unsaved
  // config changes, since navigating away previously lost them silently.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (companies.some(g => isDirty(g.groupKey))) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [companies]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveCompanyConfig = useCallback((groupKey: string) => {
    const run = async () => {
      const group = companiesRef.current.find(g => g.groupKey === groupKey)
      if (!group) return
      setSavingCompany(groupKey)
      try {
        const res = await fetch('/api/portal-clients/company-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: group.company, companyId: group.companyId ?? undefined, portalConfig: group.portalConfig }),
        })
        if (!res.ok) throw new Error('Failed to save')
        savedConfigRef.current[groupKey] = JSON.stringify(group.portalConfig)
        toast('Portal configuration saved', 'success')
      } catch {
        toast('Failed to save configuration', 'error')
      } finally {
        setSavingCompany(prev => prev === groupKey ? null : prev)
      }
    }
    const prevChain = saveChainRef.current[groupKey] ?? Promise.resolve()
    saveChainRef.current[groupKey] = prevChain.then(run)
  }, [toast])

  const autoSaveCompanyConfig = useCallback((groupKey: string) => {
    const run = async () => {
      const group = companiesRef.current.find(g => g.groupKey === groupKey)
      if (!group) return
      setAutoSaving(groupKey)
      try {
        const res = await fetch('/api/portal-clients/company-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: group.company, companyId: group.companyId ?? undefined, portalConfig: group.portalConfig }),
        })
        if (!res.ok) throw new Error('Failed to save')
        savedConfigRef.current[groupKey] = JSON.stringify(group.portalConfig)
        setAutoSaved(groupKey)
        setTimeout(() => setAutoSaved(prev => prev === groupKey ? null : prev), 2000)
      } catch {
        toast('Auto-save failed', 'error')
      } finally {
        setAutoSaving(prev => prev === groupKey ? null : prev)
      }
    }
    const prevChain = saveChainRef.current[groupKey] ?? Promise.resolve()
    saveChainRef.current[groupKey] = prevChain.then(run)
  }, [toast])

  const inviteMember = async (groupKey: string) => {
    const group = companies.find(g => g.groupKey === groupKey)
    if (!group) return
    if (!inviteForm.name || !inviteForm.email) {
      toast('Name and email are required', 'error')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/portal-clients/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // AUDIT #187 — send companyId (when the group is linked to a real
        // CRM company) so the new member's row is linked too, keeping it
        // grouped with the rest of this company after the next fetch
        // instead of splitting into a separate unlinked "same name" card.
        body: JSON.stringify({ ...inviteForm, company: group.company, companyId: group.companyId ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to invite member', 'error')
        setInviting(false)
        return
      }
      // AUDIT.md #186 — the account/token are created regardless, but the
      // invite email itself can fail (bad key, invalid recipient, rate
      // limit) — surface that instead of a blanket success toast so the
      // admin knows to resend rather than assuming the invitee got it.
      if (data.emailSent === false) {
        toast(`Account created for ${inviteForm.email}, but the invite email failed to send`, 'error')
      } else {
        toast(`Invite sent to ${inviteForm.email}`, 'success')
      }
      setShowInviteModal(null)
      setInviteForm({ name: '', email: '', role: 'Viewer' })
      fetchClients()
    } catch {
      toast('Failed to invite member', 'error')
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setRemovingMember(memberId)
    try {
      const res = await fetch(`/api/portal-clients/${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      toast('Member removed', 'success')
      fetchClients()
    } catch {
      toast('Failed to remove member', 'error')
    } finally {
      setRemovingMember(null)
    }
  }

  const addReport = (groupKey: string) => {
    if (!reportForm.title || !reportForm.file_url) {
      toast('Title and file URL are required', 'error')
      return
    }
    updateConfig(groupKey, prev => ({
      ...prev,
      reports: [
        { title: reportForm.title, date: reportForm.date, file_url: reportForm.file_url, type: 'manual' as const },
        ...prev.reports,
      ],
    }))
    setReportModal(null)
    setReportForm({ title: '', date: new Date().toISOString().split('T')[0], file_url: '' })
    toast('Report added. Save configuration to persist.', 'info')
  }

  const removeReport = (groupKey: string, idx: number) => {
    updateConfig(groupKey, prev => ({
      ...prev,
      reports: prev.reports.filter((_, i) => i !== idx),
    }))
  }

  const deletePortal = async (groupKey: string) => {
    const group = companies.find(g => g.groupKey === groupKey)
    if (!group) return
    if (!confirm(`Delete the entire portal for "${group.company}"? This removes all members, configuration, and access. This cannot be undone.`)) return
    setDeletingPortal(groupKey)
    try {
      // AUDIT #187 — prefer companyId (collision-proof); only fall back to
      // the name-based delete for portal clients never linked to a real
      // CRM company, since the server now restricts that fallback to
      // unlinked rows only.
      const params = new URLSearchParams()
      if (group.companyId) params.set('companyId', group.companyId)
      else params.set('company', group.company)
      const res = await fetch(`/api/portal-clients?${params.toString()}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast(`Portal for ${group.company} deleted`, 'success')
      setCompanies(prev => prev.filter(g => g.groupKey !== groupKey))
      if (expandedCompany === groupKey) setExpandedCompany(null)
    } catch {
      toast('Failed to delete portal', 'error')
    } finally {
      setDeletingPortal(null)
    }
  }

  const addCompany = async () => {
    if (!addCompanyForm.companyName.trim()) {
      toast('Company name is required', 'error')
      return
    }
    setAddingCompany(true)
    try {
      const hasContact = addCompanyForm.contactName.trim() && addCompanyForm.contactEmail.trim()
      if (hasContact) {
        // Use invite API to create company + first member
        const res = await fetch('/api/portal-clients/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: addCompanyForm.contactName.trim(),
            email: addCompanyForm.contactEmail.trim(),
            company: addCompanyForm.companyName.trim(),
            companyId: addCompanyForm.companyId,
            role: 'Admin',
            service: addCompanyForm.service,
            // AUDIT.md #188 — only `service` (the legacy free-text column)
            // was ever sent. The client portal's active-services list
            // actually reads `services_config[key].enabled` (confirmed
            // against toggleServiceConfig/ClientDashboard.tsx below), not
            // the flat `services` array — sending only the array left a
            // newly-added company showing 0 active services until an admin
            // manually reopened the panel and toggled it on. Send both.
            services: addCompanyForm.service ? [addCompanyForm.service] : [],
            portalConfig: addCompanyForm.service
              ? { services_config: { [addCompanyForm.service]: { enabled: true } } }
              : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          toast(data.error || 'Failed to create company', 'error')
          setAddingCompany(false)
          return
        }
        if (data.emailSent === false) {
          toast(`Company "${addCompanyForm.companyName.trim()}" created, but the invite email failed to send`, 'error')
        } else {
          toast(`Company "${addCompanyForm.companyName.trim()}" created with invite sent to ${addCompanyForm.contactEmail.trim()}`, 'success')
        }
      } else {
        // Create company-only record without a member
        const payload: Record<string, unknown> = {
          company: addCompanyForm.companyName.trim(),
          companyId: addCompanyForm.companyId,
          service: addCompanyForm.service,
          access: 'Not Setup',
          // AUDIT.md #188/#236 — this no-contact branch was missing the same
          // fix #188 already applied to the with-contact branch above: the
          // portal's active-services list reads services_config[key].enabled,
          // not the flat `services` array, so a company added without a
          // contact showed 0 active services until an admin manually
          // reopened the panel and toggled it on.
          services: addCompanyForm.service ? [addCompanyForm.service] : [],
          portalConfig: addCompanyForm.service
            ? { services_config: { [addCompanyForm.service]: { enabled: true } } }
            : undefined,
        }
        if (addCompanyForm.contactName.trim()) payload.contact = addCompanyForm.contactName.trim()
        if (addCompanyForm.contactEmail.trim()) payload.email = addCompanyForm.contactEmail.trim()
        const res = await fetch('/api/portal-clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          toast(data.error || 'Failed to create company', 'error')
          setAddingCompany(false)
          return
        }
        toast(`Company "${addCompanyForm.companyName.trim()}" created`, 'success')
      }
      setShowAddCompanyModal(false)
      setAddCompanyForm({ companyName: '', companyId: undefined, service: '', contactName: '', contactEmail: '' })
      fetchClients()
    } catch {
      toast('Failed to create company', 'error')
    } finally {
      setAddingCompany(false)
    }
  }

  const toggleServiceConfig = (groupKey: string, serviceKey: string, enabled: boolean) => {
    updateConfig(groupKey, prev => {
      const sc = { ...prev.services_config }
      if (enabled) {
        sc[serviceKey] = sc[serviceKey] ?? { enabled: true, frequency: 'monthly' as Frequency, last_updated: '', strategy: '' }
        sc[serviceKey] = { ...sc[serviceKey], enabled: true }
      } else {
        if (sc[serviceKey]) {
          sc[serviceKey] = { ...sc[serviceKey], enabled: false }
        }
      }
      const services = enabled
        ? (prev.services.includes(serviceKey as ServiceKey) ? prev.services : [...prev.services, serviceKey as ServiceKey])
        : prev.services.filter(s => s !== serviceKey)
      return { ...prev, services_config: sc, services }
    })
    // autoSaveCompanyConfig reads companiesRef fresh when it actually runs
    // (queued in the save chain), so this deferral just lets the state
    // update's effect flush the ref before that read happens.
    setTimeout(() => autoSaveCompanyConfig(groupKey), 0)
  }

  const updateServiceConfig = (groupKey: string, serviceKey: string, updates: Partial<ServiceConfig>) => {
    updateConfig(groupKey, prev => {
      const sc = { ...prev.services_config }
      sc[serviceKey] = { ...(sc[serviceKey] ?? { enabled: true, frequency: 'monthly' as Frequency, last_updated: '', strategy: '' }), ...updates }
      return { ...prev, services_config: sc }
    })
  }

  const filtered = searchQuery
    ? companies.filter(g =>
        g.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.members.some(m => m.email.toLowerCase().includes(searchQuery.toLowerCase()) || m.contact.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : companies

  // showInviteModal/reportModal hold the groupKey (identity); look up the
  // group here to get its display name for the modal headings below.
  const inviteModalGroup = showInviteModal ? companies.find(g => g.groupKey === showInviteModal) : null
  const reportModalGroup = reportModal ? companies.find(g => g.groupKey === reportModal) : null

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Header title="Portal Management" subtitle="Manage client portal access and configuration" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center justify-between gap-4 mb-6">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Admin
            </button>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search companies or members..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Building size={16} style={{ color: '#015035' }} />
                <h2 className="text-sm font-bold text-gray-900">Companies with Portal Access</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">{companies.length} companies</span>
                <button
                  onClick={() => { setShowAddCompanyModal(true); setAddCompanyForm({ companyName: '', companyId: undefined, service: '', contactName: '', contactEmail: '' }) }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> Add Company
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">Each company can have multiple portal users sharing the same view.</p>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Building size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">
                {searchQuery ? 'No companies match your search' : 'No companies with portal access yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Add clients from the Portal page to get started.</p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {filtered.map(group => {
              const expanded = expandedCompany === group.groupKey
              const enabledCount = Object.values(group.portalConfig.services_config).filter(s => s.enabled).length || group.portalConfig.services.length
              return (
                <div key={group.groupKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedCompany(expanded ? null : group.groupKey)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {group.portalConfig.client_logo_url ? (
                        <img src={group.portalConfig.client_logo_url} alt={group.company} className="w-9 h-9 rounded-xl object-contain" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: '#015035' }}>
                          {group.company[0]}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{group.company}</p>
                        <p className="text-xs text-gray-400">{group.members.length} member{group.members.length !== 1 ? 's' : ''} &middot; {enabledCount} service{enabledCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/portal/preview?company=${encodeURIComponent(group.company)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-90"
                        style={{ background: '#015035' }}
                      >
                        <Monitor size={10} /> Preview
                      </a>
                      {group.portalConfig.services.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{s}</span>
                      ))}
                      {group.portalConfig.services.length > 3 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{group.portalConfig.services.length - 3}</span>
                      )}
                      {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-100 px-5 py-5">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Members */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Users size={14} style={{ color: '#015035' }} />
                              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Members</h3>
                            </div>
                            <button
                              onClick={() => { setShowInviteModal(group.groupKey); setInviteForm({ name: '', email: '', role: 'Viewer' }) }}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity"
                              style={{ background: '#015035' }}
                            >
                              <UserPlus size={12} /> Add Member
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            {group.members.map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                                    {member.contact.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{member.contact}</p>
                                    <p className="text-xs text-gray-400">{member.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    member.role === 'Admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {member.role}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                    <Clock size={10} />
                                    {member.lastLogin === 'Never' ? 'Never' : member.lastLogin}
                                  </div>
                                  <button
                                    onClick={() => removeMember(member.id)}
                                    disabled={removingMember === member.id}
                                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Remove member"
                                  >
                                    {removingMember === member.id ? (
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Co-Branding */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Paintbrush size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Co-Branding</h3>
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-gray-600">Client Logo URL</label>
                              <div className="flex gap-2">
                                <input
                                  type="url"
                                  value={group.portalConfig.client_logo_url}
                                  onChange={e => updateConfig(group.groupKey, prev => ({ ...prev, client_logo_url: e.target.value }))}
                                  placeholder="https://example.com/logo.png"
                                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                                />
                                {group.portalConfig.client_logo_url && (
                                  <div className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                                    <img src={group.portalConfig.client_logo_url} alt="Preview" className="w-8 h-8 object-contain" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-gray-600">Client Brand Color</label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  value={group.portalConfig.client_brand_color}
                                  onChange={e => updateConfig(group.groupKey, prev => ({ ...prev, client_brand_color: e.target.value }))}
                                  placeholder="#3b82f6"
                                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                                />
                                <input
                                  type="color"
                                  value={group.portalConfig.client_brand_color || '#015035'}
                                  onChange={e => updateConfig(group.groupKey, prev => ({ ...prev, client_brand_color: e.target.value }))}
                                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Services — Full cards */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Services</h3>
                            {autoSaving === group.groupKey && (
                              <span className="text-[10px] text-gray-400 font-medium ml-auto">Saving...</span>
                            )}
                            {autoSaved === group.groupKey && autoSaving !== group.groupKey && (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold ml-auto">
                                <Check size={10} /> Saved
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {ALL_SERVICES.map(service => {
                              const Icon = service.icon
                              const svcConfig = group.portalConfig.services_config[service.key]
                              const active = svcConfig?.enabled ?? group.portalConfig.services.includes(service.key as ServiceKey)
                              return (
                                <div
                                  key={service.key}
                                  className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                                    active
                                      ? 'border-emerald-200 bg-emerald-50/50'
                                      : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                  onClick={() => toggleServiceConfig(group.groupKey, service.key, !active)}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${service.color}15` }}>
                                      <Icon size={14} style={{ color: service.color }} />
                                    </div>
                                    <div className={`w-8 h-[18px] rounded-full flex items-center transition-colors ${active ? 'justify-end' : 'justify-start'}`} style={{ background: active ? '#015035' : '#d1d5db' }}>
                                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm mx-0.5" />
                                    </div>
                                  </div>
                                  <p className="text-xs font-bold text-gray-900 mb-0.5">{service.label}</p>
                                  <p className="text-[11px] text-gray-500 leading-relaxed">{service.description}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Strategy Scheduling per Service */}
                        {group.portalConfig.services.length > 0 && (
                          <div className="lg:col-span-2">
                            <div className="flex items-center gap-2 mb-3">
                              <Calendar size={14} style={{ color: '#015035' }} />
                              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Strategy Scheduling</h3>
                            </div>
                            <div className="flex flex-col gap-3">
                              {group.portalConfig.services.map(svcKey => {
                                const svcDef = ALL_SERVICES.find(s => s.key === svcKey)
                                const svcConfig = group.portalConfig.services_config[svcKey] ?? { enabled: true, frequency: 'monthly' as Frequency, last_updated: '', strategy: '' }
                                const nextUpdate = svcConfig.last_updated ? getNextUpdateDate(svcConfig.last_updated, svcConfig.frequency) : ''
                                const isOverdue = nextUpdate && new Date(nextUpdate + 'T12:00:00') < new Date()
                                const isExpanded = expandedServices[`${group.groupKey}-${svcKey}`]
                                return (
                                  <div key={svcKey} className="border border-gray-200 rounded-xl overflow-hidden">
                                    <button
                                      onClick={() => setExpandedServices(prev => ({ ...prev, [`${group.groupKey}-${svcKey}`]: !prev[`${group.groupKey}-${svcKey}`] }))}
                                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        {svcDef && <svcDef.icon size={13} style={{ color: svcDef.color }} />}
                                        <span className="text-xs font-bold text-gray-800">{svcKey}</span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                          {FREQUENCY_LABELS[svcConfig.frequency]}
                                        </span>
                                        {isOverdue && (
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Overdue</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {svcConfig.last_updated && (
                                          <span className="text-[11px] text-gray-400">Updated {svcConfig.last_updated}</span>
                                        )}
                                        {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                                      </div>
                                    </button>
                                    {isExpanded && (
                                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-semibold text-gray-500">Update Frequency</label>
                                            <select
                                              value={svcConfig.frequency}
                                              onChange={e => updateServiceConfig(group.groupKey, svcKey, { frequency: e.target.value as Frequency })}
                                              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            >
                                              {FREQUENCIES.map(f => (
                                                <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-semibold text-gray-500">Last Updated</label>
                                            <input
                                              type="date"
                                              value={svcConfig.last_updated}
                                              onChange={e => updateServiceConfig(group.groupKey, svcKey, { last_updated: e.target.value })}
                                              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <label className="text-[11px] font-semibold text-gray-500">Next Update Due</label>
                                            <div className={`text-sm px-2.5 py-1.5 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-100 text-gray-700'} font-medium`}>
                                              {nextUpdate || 'Set last updated date'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[11px] font-semibold text-gray-500">Strategy Content</label>
                                          <textarea
                                            value={svcConfig.strategy}
                                            onChange={e => updateServiceConfig(group.groupKey, svcKey, { strategy: e.target.value })}
                                            placeholder={`${svcKey} strategy notes for this client...`}
                                            className="w-full h-28 text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white resize-y"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Visibility Toggles */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Eye size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Visibility</h3>
                          </div>
                          <div className="flex flex-col gap-2">
                            {([
                              { key: 'showAgreement' as const, label: 'Show Agreement', icon: <FileText size={13} /> },
                              { key: 'showRenewalInfo' as const, label: 'Show Renewal Info', icon: <Clock size={13} /> },
                              { key: 'showInvoices' as const, label: 'Show Invoices', icon: <CreditCard size={13} /> },
                              { key: 'showSeoStrategy' as const, label: 'Show SEO Strategy', icon: <Search size={13} /> },
                              { key: 'showReports' as const, label: 'Show Reports', icon: <BarChart3 size={13} /> },
                            ]).map(({ key, label, icon }) => {
                              const on = group.portalConfig.visibility[key]
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    const updated = {
                                      ...group.portalConfig,
                                      visibility: { ...group.portalConfig.visibility, [key]: !on },
                                    }
                                    updateConfig(group.groupKey, () => updated)
                                    setTimeout(() => autoSaveCompanyConfig(group.groupKey), 0)
                                  }}
                                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-white"
                                >
                                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">{icon} {label}</div>
                                  <div className="flex items-center gap-1.5">
                                    {autoSaved === group.groupKey && autoSaving !== group.groupKey && (
                                      <Check size={12} className="text-emerald-500" />
                                    )}
                                    <div className={`w-8 h-[18px] rounded-full flex items-center transition-colors ${on ? 'justify-end' : 'justify-start'}`} style={{ background: on ? '#015035' : '#d1d5db' }}>
                                      <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm mx-0.5" />
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Welcome Message */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <MessageSquare size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Custom Welcome Message</h3>
                          </div>
                          <textarea
                            value={group.portalConfig.welcomeMessage}
                            onChange={e => updateConfig(group.groupKey, prev => ({ ...prev, welcomeMessage: e.target.value }))}
                            placeholder="Welcome to your client portal! We're excited to partner with you..."
                            className="w-full h-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white resize-none"
                          />
                        </div>

                        {/* Client Reports */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <FileText size={14} style={{ color: '#015035' }} />
                              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Client Reports</h3>
                            </div>
                            <button
                              onClick={() => { setReportModal(group.groupKey); setReportForm({ title: '', date: new Date().toISOString().split('T')[0], file_url: '' }) }}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-opacity"
                              style={{ background: '#015035' }}
                            >
                              <Upload size={12} /> Upload Report
                            </button>
                          </div>
                          {group.portalConfig.reports.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {group.portalConfig.reports.map((report, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e6f0ec' }}>
                                      <FileText size={14} style={{ color: '#015035' }} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-800">{report.title}</p>
                                      <p className="text-[11px] text-gray-400">{report.date} &middot; Manual Upload</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeReport(group.groupKey, idx)}
                                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-gray-50 rounded-xl">
                              <FileText size={20} className="text-gray-300 mx-auto mb-2" />
                              <p className="text-xs text-gray-400">No reports uploaded yet</p>
                            </div>
                          )}
                        </div>

                        {/* SEO Strategy Editor */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-2 mb-3">
                            <Search size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">SEO Strategy (Legacy)</h3>
                          </div>
                          <textarea
                            value={group.portalConfig.seoStrategy}
                            onChange={e => updateConfig(group.groupKey, prev => ({ ...prev, seoStrategy: e.target.value }))}
                            placeholder="Monthly SEO strategy notes for this client. Supports plain text and will be displayed in the client's portal..."
                            className="w-full h-40 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white resize-y"
                          />
                        </div>
                      </div>

                      {/* Save / Delete */}
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          {isDirty(group.groupKey) && (
                            <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
                          )}
                          <button
                            onClick={() => deletePortal(group.groupKey)}
                            disabled={deletingPortal === group.groupKey}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-50"
                          >
                            {deletingPortal === group.groupKey ? (
                              <><div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> Deleting...</>
                            ) : (
                              <><Trash2 size={14} /> Delete Portal</>
                            )}
                          </button>
                        </div>
                        <button
                          onClick={() => saveCompanyConfig(group.groupKey)}
                          disabled={savingCompany === group.groupKey}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
                          style={{ background: '#015035' }}
                        >
                          {savingCompany === group.groupKey ? (
                            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                          ) : (
                            <><Save size={14} /> Save Configuration</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowInviteModal(null)} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
              <h2 className="text-sm font-bold text-white">Add Member to {inviteModalGroup?.company}</h2>
              <button onClick={() => setShowInviteModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={16} className="text-white/70" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Full Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={e => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@company.com"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Role</label>
                <div className="flex gap-2">
                  {(['Admin', 'Viewer'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setInviteForm(prev => ({ ...prev, role: r }))}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        inviteForm.role === r
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {r === 'Admin' ? <Shield size={12} /> : <Eye size={12} />}
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {inviteForm.role === 'Admin' ? 'Can manage portal settings for this company' : 'Read-only access to portal data'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowInviteModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => inviteMember(showInviteModal)}
                disabled={inviting || !inviteForm.name || !inviteForm.email}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                {inviting ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</>
                ) : (
                  <><Mail size={14} /> Send Invite</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddCompanyModal(false)} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
              <h2 className="text-sm font-bold text-white">Add New Company</h2>
              <button onClick={() => setShowAddCompanyModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={16} className="text-white/70" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Company Name <span className="text-red-400">*</span></label>
                <CompanySelect
                  value={addCompanyForm.companyName}
                  onChange={(name, id) => setAddCompanyForm(prev => ({ ...prev, companyName: name, companyId: id }))}
                  placeholder="Acme Corporation"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Service Type</label>
                <select
                  value={addCompanyForm.service}
                  onChange={e => setAddCompanyForm(prev => ({ ...prev, service: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
                >
                  <option value="">Select a service...</option>
                  {ALL_SERVICES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[11px] text-gray-400 mb-3">Optionally add a primary contact. An invite email will be sent if both name and email are provided.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600">Primary Contact Name</label>
                    <input
                      type="text"
                      value={addCompanyForm.contactName}
                      onChange={e => setAddCompanyForm(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="John Smith"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-600">Primary Contact Email</label>
                    <input
                      type="email"
                      value={addCompanyForm.contactEmail}
                      onChange={e => setAddCompanyForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="john@acme.com"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAddCompanyModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCompany}
                disabled={addingCompany || !addCompanyForm.companyName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                {addingCompany ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <><Building size={14} /> Add Company</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Upload Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReportModal(null)} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
              <h2 className="text-sm font-bold text-white">Upload Report for {reportModalGroup?.company}</h2>
              <button onClick={() => setReportModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={16} className="text-white/70" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Report Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={reportForm.title}
                  onChange={e => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Monthly SEO Report - May 2025"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">Report Date</label>
                <input
                  type="date"
                  value={reportForm.date}
                  onChange={e => setReportForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600">File URL (PDF) <span className="text-red-400">*</span></label>
                <input
                  type="url"
                  value={reportForm.file_url}
                  onChange={e => setReportForm(prev => ({ ...prev, file_url: e.target.value }))}
                  placeholder="https://drive.google.com/... or direct PDF link"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setReportModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => addReport(reportModal)}
                disabled={!reportForm.title || !reportForm.file_url}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                <Upload size={14} /> Add Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
