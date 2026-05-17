'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Building, Users, Plus, Trash2, Save, ChevronDown, ChevronRight,
  Mail, Shield, Eye, EyeOff, X, Search, Clock, UserPlus,
  FileText, BarChart3, Globe, CreditCard, Megaphone, Palette,
  MessageSquare, BookOpen, ArrowLeft,
} from 'lucide-react'

const SERVICES = ['SEO', 'PPC', 'Web Design', 'Social Media', 'Content', 'Email', 'Branding', 'Consulting'] as const
type ServiceType = typeof SERVICES[number]

interface PortalConfig {
  services: ServiceType[]
  visibility: {
    showAgreement: boolean
    showRenewalInfo: boolean
    showInvoices: boolean
    showSeoStrategy: boolean
    showReports: boolean
  }
  welcomeMessage: string
  seoStrategy: string
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
  company: string
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
}

function parseConfig(raw: unknown): PortalConfig {
  if (!raw || typeof raw !== 'object') return { ...defaultConfig }
  const obj = raw as Record<string, unknown>
  return {
    services: Array.isArray(obj.services) ? obj.services as ServiceType[] : [],
    visibility: {
      showAgreement: (obj.visibility as Record<string, unknown>)?.showAgreement !== false,
      showRenewalInfo: (obj.visibility as Record<string, unknown>)?.showRenewalInfo === true,
      showInvoices: (obj.visibility as Record<string, unknown>)?.showInvoices !== false,
      showSeoStrategy: (obj.visibility as Record<string, unknown>)?.showSeoStrategy === true,
      showReports: (obj.visibility as Record<string, unknown>)?.showReports !== false,
    },
    welcomeMessage: typeof obj.welcomeMessage === 'string' ? obj.welcomeMessage : '',
    seoStrategy: typeof obj.seoStrategy === 'string' ? obj.seoStrategy : '',
  }
}

export default function PortalManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [companies, setCompanies] = useState<CompanyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [savingCompany, setSavingCompany] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'Viewer' as 'Admin' | 'Viewer' })
  const [inviting, setInviting] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

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
        const key = client.company
        if (!grouped.has(key)) {
          grouped.set(key, {
            company: key,
            members: [],
            portalConfig: parseConfig(client.portalConfig),
          })
        }
        grouped.get(key)!.members.push({
          id: client.id,
          contact: client.contact,
          email: client.email,
          lastLogin: client.lastLogin,
          role: client.role ?? 'Viewer',
          access: client.access,
        })
      }
      setCompanies(Array.from(grouped.values()).sort((a, b) => a.company.localeCompare(b.company)))
    } catch {
      toast('Failed to load portal clients', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchClients() }, [fetchClients])

  const updateConfig = (company: string, updater: (prev: PortalConfig) => PortalConfig) => {
    setCompanies(prev => prev.map(g =>
      g.company === company ? { ...g, portalConfig: updater(g.portalConfig) } : g
    ))
  }

  const saveCompanyConfig = async (company: string) => {
    const group = companies.find(g => g.company === company)
    if (!group) return
    setSavingCompany(company)
    try {
      const res = await fetch('/api/portal-clients/company-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, portalConfig: group.portalConfig }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('Portal configuration saved', 'success')
    } catch {
      toast('Failed to save configuration', 'error')
    } finally {
      setSavingCompany(null)
    }
  }

  const inviteMember = async (company: string) => {
    if (!inviteForm.name || !inviteForm.email) {
      toast('Name and email are required', 'error')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/portal-clients/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteForm, company }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to invite member', 'error')
        setInviting(false)
        return
      }
      toast(`Invite sent to ${inviteForm.email}`, 'success')
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

  const filtered = searchQuery
    ? companies.filter(g =>
        g.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.members.some(m => m.email.toLowerCase().includes(searchQuery.toLowerCase()) || m.contact.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : companies

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  const serviceIcons: Record<string, React.ReactNode> = {
    'SEO': <Search size={12} />,
    'PPC': <CreditCard size={12} />,
    'Web Design': <Globe size={12} />,
    'Social Media': <Megaphone size={12} />,
    'Content': <BookOpen size={12} />,
    'Email': <Mail size={12} />,
    'Branding': <Palette size={12} />,
    'Consulting': <MessageSquare size={12} />,
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
              <span className="text-xs text-gray-400 font-medium">{companies.length} companies</span>
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
              const expanded = expandedCompany === group.company
              return (
                <div key={group.company} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedCompany(expanded ? null : group.company)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: '#015035' }}>
                        {group.company[0]}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{group.company}</p>
                        <p className="text-xs text-gray-400">{group.members.length} member{group.members.length !== 1 ? 's' : ''} &middot; {group.portalConfig.services.length} service{group.portalConfig.services.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                              onClick={() => { setShowInviteModal(group.company); setInviteForm({ name: '', email: '', role: 'Viewer' }) }}
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
                                  {group.members.length > 1 && (
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
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Services */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Services</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {SERVICES.map(service => {
                              const active = group.portalConfig.services.includes(service)
                              return (
                                <button
                                  key={service}
                                  onClick={() => updateConfig(group.company, prev => ({
                                    ...prev,
                                    services: active ? prev.services.filter(s => s !== service) : [...prev.services, service],
                                  }))}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                    active
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  {serviceIcons[service]} {service}
                                </button>
                              )
                            })}
                          </div>
                        </div>

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
                                  onClick={() => updateConfig(group.company, prev => ({
                                    ...prev,
                                    visibility: { ...prev.visibility, [key]: !on },
                                  }))}
                                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-white"
                                >
                                  <div className="flex items-center gap-2 text-xs font-medium text-gray-700">{icon} {label}</div>
                                  <div className={`w-8 h-[18px] rounded-full flex items-center transition-colors ${on ? 'justify-end' : 'justify-start'}`} style={{ background: on ? '#015035' : '#d1d5db' }}>
                                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm mx-0.5" />
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
                            onChange={e => updateConfig(group.company, prev => ({ ...prev, welcomeMessage: e.target.value }))}
                            placeholder="Welcome to your client portal! We're excited to partner with you..."
                            className="w-full h-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white resize-none"
                          />
                        </div>

                        {/* SEO Strategy Editor */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-2 mb-3">
                            <Search size={14} style={{ color: '#015035' }} />
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">SEO Strategy</h3>
                          </div>
                          <textarea
                            value={group.portalConfig.seoStrategy}
                            onChange={e => updateConfig(group.company, prev => ({ ...prev, seoStrategy: e.target.value }))}
                            placeholder="Monthly SEO strategy notes for this client. Supports plain text and will be displayed in the client's portal..."
                            className="w-full h-40 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 bg-white resize-y"
                          />
                        </div>
                      </div>

                      {/* Save */}
                      <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => saveCompanyConfig(group.company)}
                          disabled={savingCompany === group.company}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
                          style={{ background: '#015035' }}
                        >
                          {savingCompany === group.company ? (
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
              <h2 className="text-sm font-bold text-white">Add Member to {showInviteModal}</h2>
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
    </>
  )
}
