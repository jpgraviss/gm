'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { useTeamMembers } from '@/lib/useTeamMembers'
import { fetchCrmCompanies, fetchCrmContacts, fetchDeals, fetchContracts, fetchInvoices, fetchProjects, fetchCrmActivities } from '@/lib/supabase'
import {
  formatCurrency, stageColors, serviceTypeColors, contractStatusColors,
  projectStatusColors, invoiceStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewCompanyPanel, { type NewCompanyFormData } from '@/components/crm/NewCompanyPanel'
import HubSpotImportPanel from '@/components/crm/HubSpotImportPanel'
import NewContactPanel, { type NewContactFormData } from '@/components/crm/NewContactPanel'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import AiInsightsPanel from '@/components/crm/AiInsightsPanel'
import type { CRMCompany, CRMContact, CompanyStatus, Deal, Contract, Invoice, Project, CRMActivity } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import {
  X, Phone, Mail, Building2, MapPin, Users, Globe, DollarSign,
  User, Filter, Search, Plus, FileText, ScrollText, ChevronRight, ChevronLeft,
  ExternalLink, TrendingUp, FolderKanban, Pencil, Tag, Trash2, Upload, BarChart3,
  Monitor, Loader2, Sparkles, Wand2, Share2, Brain, Download, GitMerge,
} from 'lucide-react'
import ClientIntegrationsPanel from '@/components/crm/ClientIntegrationsPanel'
import DuplicatesPanel from '@/components/crm/DuplicatesPanel'
import BulkActionBar from '@/components/ui/BulkActionBar'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useEnrichment } from '@/lib/useEnrichment'
import Pagination from '@/components/ui/Pagination'

// ─── Status colors ────────────────────────────────────────────────────────────

const companyStatusColors: Record<CompanyStatus, string> = {
  Prospect: 'bg-blue-50 text-blue-700',
  'Active Client': 'bg-emerald-50 text-emerald-700',
  'Past Client': 'bg-gray-100 text-gray-600',
  Partner: 'bg-purple-50 text-purple-700',
  Churned: 'bg-red-50 text-red-600',
}

const companyStatuses: CompanyStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned']

// ─── Company Detail Panel ─────────────────────────────────────────────────────

function CompanyPanel({ company, onClose, onEdit, onDelete, onOpenIntegrations, crmContacts, deals, contracts, invoices, projects, crmActivities }: { company: CRMCompany; onClose: () => void; onEdit?: () => void; onDelete?: () => void; onOpenIntegrations?: () => void; crmContacts: CRMContact[]; deals: Deal[]; contracts: Contract[]; invoices: Invoice[]; projects: Project[]; crmActivities: CRMActivity[] }) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'overview' | 'contacts' | 'deals' | 'contracts' | 'activity'>('overview')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [extraContacts, setExtraContacts] = useState<CRMContact[]>([])
  const [localTags, setLocalTags] = useState<string[]>(company.tags)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [localActivities, setLocalActivities] = useState(
    () => (crmActivities ?? []).filter(a => a.companyId === company.id)
  )
  const [socialAnalysis, setSocialAnalysis] = useState<{ platforms: { name: string; url: string; status: string; notes: string }[]; summary: string; engagementOpportunities: string[] } | null>(null)
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialOpen, setSocialOpen] = useState(false)
  const [companyRecs, setCompanyRecs] = useState<{ type: string; priority: string; title: string; description: string; suggestedAction: string }[]>([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsOpen, setRecsOpen] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiProposalContent, setAiProposalContent] = useState<string | null>(null)

  function persistTags(tags: string[]) {
    fetch(`/api/crm/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }).catch(() => toast('Failed to save company tags', 'error'))
  }

  function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || localTags.includes(tag)) return
    const updated = [...localTags, tag]
    setLocalTags(updated)
    setNewTag('')
    setAddingTag(false)
    persistTags(updated)
  }

  function handleRemoveTag(tag: string) {
    const updated = localTags.filter(t => t !== tag)
    setLocalTags(updated)
    persistTags(updated)
  }

  async function handleAddContact(data: NewContactFormData) {
    const payload = {
      companyId: company.id,
      companyName: company.name,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`,
      title: data.title,
      emails: data.email ? [data.email] : [],
      phones: data.phone ? [data.phone] : [],
      linkedIn: data.linkedIn || null,
      website: data.website || null,
      isPrimary: false,
      owner: data.owner,
      tags: [],
      contactNotes: [],
      contactTasks: [],
    }
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saved: CRMContact = res.ok ? await res.json() : { ...payload, id: `contact-${Date.now()}`, createdDate: new Date().toISOString().split('T')[0] }
      setExtraContacts(prev => [...prev, saved])
    } catch {
      setExtraContacts(prev => [...prev, { ...payload, id: `contact-${Date.now()}`, createdDate: new Date().toISOString().split('T')[0] } as CRMContact])
    }
    setAddingContact(false)
  }

  async function handleSaveActivity(activity: LoggedActivity) {
    const entry = {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      body: activity.body,
      outcome: activity.outcome || undefined,
      nextStep: activity.nextStep || undefined,
      user: activity.user,
      timestamp: activity.timestamp,
      duration: activity.duration,
      companyId: company.id,
      companyName: company.name,
    }
    setLocalActivities(prev => [entry, ...prev])
    setLoggingActivity(false)
    setTab('activity')
    try {
      await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
    } catch { console.warn('Failed to persist activity to server') }
  }

  // Cross-linked data
  const companyContacts = crmContacts.filter(c => c.companyId === company.id)
  const companyDeals = deals.filter(d => d.company === company.name)
  const companyContracts = contracts.filter(c => c.company === company.name)
  const companyInvoices = invoices.filter(i => i.company === company.name)
  const companyProject = projects.find(p => p.company === company.name)

  const totalInvoiced = companyInvoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = companyInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const openDeals = companyDeals.filter(d => !d.stage.startsWith('Closed'))

  return (
    <>
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(560px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mb-3">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                {company.name[0]}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-bold truncate" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {company.name}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                    {company.status}
                  </span>
                  <span className="text-white/40 text-xs">{company.industry}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <a
                href={`/portal/preview?company=${encodeURIComponent(company.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
                title="Preview client portal"
              >
                <Monitor size={15} className="text-white/60" />
              </a>
              {onOpenIntegrations && (
                <button onClick={onOpenIntegrations} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Client integrations">
                  <BarChart3 size={15} className="text-white/60" />
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Edit company">
                  <Pencil size={15} className="text-white/60" />
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 flex-shrink-0" title="Delete company">
                  <Trash2 size={15} className="text-red-400" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
                <X size={18} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Deal Value', value: formatCurrency(company.totalDealValue) },
              { label: 'Contacts', value: companyContacts.length.toString() },
              { label: 'Open Deals', value: openDeals.length.toString() },
              { label: 'Paid', value: formatCurrency(totalPaid) },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['overview', 'contacts', 'deals', 'contracts', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Details</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<Building2 size={14} />} label="Industry" value={company.industry} />
                  <InfoRow icon={<MapPin size={14} />} label="HQ" value={company.hq} />
                  <InfoRow icon={<Users size={14} />} label="Size" value={`${company.size} employees`} />
                  {company.annualRevenue && (
                    <InfoRow icon={<DollarSign size={14} />} label="Annual Revenue" value={formatCurrency(company.annualRevenue)} />
                  )}
                  {company.phone && <InfoRow icon={<Phone size={14} />} label="Phone" value={company.phone} />}
                  {company.website && (
                    <InfoRow icon={<Globe size={14} />} label="Website" value={
                      <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1">
                        {company.website} <ExternalLink size={11} />
                      </a>
                    } />
                  )}
                  <InfoRow icon={<User size={14} />} label="Owner" value={company.owner} />
                </div>
              </div>

              {company.description && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
                </div>
              )}

              {/* Primary contact quick view */}
              {companyContacts.filter(c => c.isPrimary).map(c => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Contact</p>
                    <button onClick={() => setTab('contacts')} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      All contacts <ChevronRight size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      <p className="text-xs text-gray-400">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a href={`mailto:${c.emails[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Mail size={13} />
                      </a>
                      <a href={`tel:${c.phones[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Phone size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              {/* AI Insights */}
              <AiInsightsPanel
                type="company"
                name={company.name}
                context={[
                  `Industry: ${company.industry}`,
                  `Status: ${company.status}`,
                  `HQ: ${company.hq}`,
                  `Size: ${company.size} employees`,
                  company.annualRevenue ? `Annual Revenue: $${company.annualRevenue.toLocaleString()}` : '',
                  `Owner: ${company.owner}`,
                  `Open Deals: ${openDeals.length}`,
                  `Total Deal Value: $${company.totalDealValue.toLocaleString()}`,
                  company.description ? `Description: ${company.description}` : '',
                ].filter(Boolean).join('\n')}
              />

              {/* AI Recommendations */}
              <div className="border border-purple-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!recsOpen && companyRecs.length === 0) {
                      setRecsOpen(true)
                      setRecsLoading(true)
                      fetch(`/api/ai/recommendations?companyId=${company.id}`)
                        .then(r => r.ok ? r.json() : [])
                        .then(data => { if (Array.isArray(data)) setCompanyRecs(data) })
                        .catch(() => {})
                        .finally(() => setRecsLoading(false))
                    } else {
                      setRecsOpen(v => !v)
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-purple-600" />
                    <span className="text-sm font-semibold text-purple-800">AI Recommendations</span>
                  </div>
                  <ChevronRight size={14} className={`text-purple-600 transition-transform ${recsOpen ? 'rotate-90' : ''}`} />
                </button>
                {recsOpen && (
                  <div className="px-4 py-3 bg-white">
                    {recsLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                        <span className="text-xs text-gray-400">Analyzing...</span>
                      </div>
                    ) : companyRecs.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">No recommendations at this time.</p>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {companyRecs.map((rec, i) => (
                          <div key={i} className="p-3 border border-gray-100 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                rec.priority === 'high' ? 'bg-red-50 text-red-600' :
                                rec.priority === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                'bg-gray-50 text-gray-500'
                              }`}>{rec.priority}</span>
                              <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{rec.type.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
                            <p className="text-xs text-purple-700 mt-1.5 font-medium">{rec.suggestedAction}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Social Insights */}
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!socialOpen && !socialAnalysis) {
                      setSocialOpen(true)
                      setSocialLoading(true)
                      fetch(`/api/crm/companies/${company.id}/social-analysis`)
                        .then(r => r.ok ? r.json() : null)
                        .then(data => { if (data) setSocialAnalysis(data) })
                        .catch(() => {})
                        .finally(() => setSocialLoading(false))
                    } else {
                      setSocialOpen(v => !v)
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Share2 size={14} className="text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Social Insights</span>
                  </div>
                  <ChevronRight size={14} className={`text-blue-600 transition-transform ${socialOpen ? 'rotate-90' : ''}`} />
                </button>
                {socialOpen && (
                  <div className="px-4 py-3 bg-white">
                    {socialLoading ? (
                      <div className="flex items-center gap-2 py-3">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                        <span className="text-xs text-gray-400">Analyzing social presence...</span>
                      </div>
                    ) : socialAnalysis ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                          {socialAnalysis.platforms.map(p => (
                            <div key={p.name} className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                              {p.url ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">{p.name}</a>
                              ) : (
                                <span className="text-xs text-gray-400">{p.name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{socialAnalysis.summary}</p>
                        {socialAnalysis.engagementOpportunities.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Engagement Opportunities</p>
                            <ul className="flex flex-col gap-1">
                              {socialAnalysis.engagementOpportunities.map((opp, i) => (
                                <li key={i} className="flex gap-2 text-xs text-gray-600">
                                  <span className="text-blue-500 flex-shrink-0">-</span>
                                  {opp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-2">Unable to analyze social presence.</p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Proposal Summary button */}
              {openDeals.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <button
                    onClick={async () => {
                      setAiGenerating(true)
                      setAiProposalContent(null)
                      try {
                        const res = await fetch('/api/ai/generate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'proposal_summary',
                            context: {
                              company: company.name,
                              services: openDeals.map(d => d.serviceType).join(', '),
                              value: `$${openDeals.reduce((s, d) => s + d.value, 0).toLocaleString()}`,
                              additionalContext: `Industry: ${company.industry}, Size: ${company.size}`,
                            },
                          }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          setAiProposalContent(data.content)
                        }
                      } catch { /* ignore */ }
                      setAiGenerating(false)
                    }}
                    disabled={aiGenerating}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    AI Proposal Summary
                  </button>
                  {aiProposalContent && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{aiProposalContent}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(aiProposalContent)
                          toast('Copied to clipboard', 'success')
                        }}
                        className="mt-2 text-xs font-semibold text-purple-700 hover:text-purple-900"
                      >
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Active project */}
              {companyProject && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active Project</p>
                    <Link href="/projects" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 flex-1">
                      <FolderKanban size={14} className="text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{companyProject.serviceType}</p>
                        <StatusBadge label={companyProject.status} colorClass={projectStatusColors[companyProject.status]} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#015035' }}>{companyProject.progress}%</p>
                      <p className="text-[11px] text-gray-400">complete</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                  <button
                    onClick={() => setAddingTag(v => !v)}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900"
                  >
                    <Plus size={12} /> Add Tag
                  </button>
                </div>
                {addingTag && (
                  <div className="flex gap-2 mb-2">
                    <input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      placeholder="New tag..."
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTag()
                        if (e.key === 'Escape') setAddingTag(false)
                      }}
                    />
                    <button onClick={handleAddTag} className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium">Add</button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {localTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full group">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {localTags.length === 0 && !addingTag && (
                    <span className="text-xs text-gray-400">No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Contacts ── */}
          {tab === 'contacts' && (
            <div className="flex flex-col gap-3">
              {[...companyContacts, ...extraContacts].map(c => (
                <div key={c.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      {c.isPrimary && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.emails[0] ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`mailto:${c.emails[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                      <Mail size={13} />
                    </a>
                    <a href={`tel:${c.phones[0] ?? ''}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
              ))}
              {companyContacts.length === 0 && extraContacts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No contacts linked to this company.</p>
              )}
              <button
                onClick={() => setAddingContact(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Add Contact
              </button>
            </div>
          )}

          {/* ── Deals ── */}
          {tab === 'deals' && (
            <div className="flex flex-col gap-3">
              {companyDeals.map(d => (
                <div key={d.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      <StatusBadge label={d.serviceType} colorClass={serviceTypeColors[d.serviceType]} />
                    </div>
                    <p className="text-base font-bold flex-shrink-0" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(d.value)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{d.contact.name} · {d.contact.title}</span>
                    <span>Close {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{d.probability}% probability</span>
                  </div>
                </div>
              ))}
              {companyDeals.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No deals linked to this company.</p>
              )}
              <button
                onClick={() => setCreatingProposal(true)}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> New Proposal
              </button>
            </div>
          )}

          {/* ── Contracts ── */}
          {tab === 'contracts' && (
            <div className="flex flex-col gap-3">
              {companyContracts.map(c => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                      <p className="text-xs text-gray-500 mt-1.5">{c.billingStructure}</p>
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(c.value)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: 'Service', value: c.serviceType },
                      { label: 'Start', value: new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                      { label: 'Renewal', value: new Date(c.renewalDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                    ].map(f => (
                      <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                        <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Invoices for this contract */}
                  {companyInvoices.filter(i => i.company === c.company).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Invoices</p>
                      <div className="flex flex-col gap-1.5">
                        {companyInvoices.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status]} />
                              <span className="text-gray-500">Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <span className="font-semibold text-gray-800">{formatCurrency(inv.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">Total Invoiced: {formatCurrency(totalInvoiced)}</span>
                        <span className="font-semibold text-emerald-700">Paid: {formatCurrency(totalPaid)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {companyContracts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No contracts found for this company.</p>
              )}
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <ActivityTimeline activities={localActivities} />
          )}
        </div>

        {/* Log Activity form or footer */}
        {loggingActivity ? (
          <LogActivityForm
            onSave={handleSaveActivity}
            onCancel={() => setLoggingActivity(false)}
          />
        ) : (
          <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <button
              onClick={() => setLoggingActivity(true)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#015035' }}
            >
              <Plus size={14} /> Log Activity
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
    {addingContact && (
      <NewContactPanel
        onSave={handleAddContact}
        onClose={() => setAddingContact(false)}
      />
    )}
    {creatingProposal && (
      <NewProposalPanel
        onSave={(_data: NewProposalFormData) => setCreatingProposal(false)}
        onClose={() => setCreatingProposal(false)}
      />
    )}
    </>
  )
}

// ─── Edit Company Panel ───────────────────────────────────────────────────────

function EditCompanyPanel({
  company,
  onSave,
  onClose,
}: {
  company: CRMCompany
  onSave: (updated: CRMCompany) => void
  onClose: () => void
}) {
  const REPS = useTeamMembers()
  const [form, setForm] = useState({
    name: company.name,
    industry: company.industry,
    hq: company.hq,
    size: company.size,
    phone: company.phone ?? '',
    website: company.website ?? '',
    annualRevenue: company.annualRevenue ? String(company.annualRevenue) : '',
    owner: company.owner,
    description: company.description ?? '',
    status: company.status as CompanyStatus,
  })

  const { enriching, enrichedFields, enrich, markEnriched, clearEnriched } = useEnrichment()

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleWebsiteBlur() {
    if (!form.website.trim() || enriching) return
    const data = await enrich(form.website)
    if (!data) return
    const filled: string[] = []
    setForm(prev => {
      const next = { ...prev }
      if (data.name && !prev.name) { next.name = data.name; filled.push('name') }
      if (data.industry && !prev.industry) { next.industry = data.industry; filled.push('industry') }
      if (data.description && !prev.description) { next.description = data.description; filled.push('description') }
      if (data.phone && !prev.phone) { next.phone = data.phone; filled.push('phone') }
      if (data.address && !prev.hq) { next.hq = data.address; filled.push('hq') }
      return next
    })
    if (filled.length > 0) markEnriched(filled)
  }

  function ec(field: string) {
    return enrichedFields.has(field) ? 'ring-2 ring-blue-300 bg-blue-50/30' : ''
  }

  function handleSave() {
    onSave({
      ...company,
      name: form.name.trim(),
      industry: form.industry.trim(),
      hq: form.hq.trim(),
      size: form.size,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      annualRevenue: form.annualRevenue ? Number(form.annualRevenue) : undefined,
      owner: form.owner,
      description: form.description.trim() || undefined,
      status: form.status,
    })
  }

  const canSave = form.name.trim() && form.industry.trim() && form.hq.trim()

  return (
    <div className="fixed inset-0 z-[60] flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(520px, 100vw)' }}>
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">Edit Company</h2>
            <p className="text-white/50 text-xs mt-0.5">{company.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Company Name
              {enrichedFields.has('name') && (
                <button type="button" onClick={() => { clearEnriched('name'); set('name', '') }}
                  className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                  auto-filled &times;
                </button>
              )}
            </label>
            <input value={form.name} onChange={e => { set('name', e.target.value); clearEnriched('name') }}
              className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('name')}`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Industry
                {enrichedFields.has('industry') && (
                  <button type="button" onClick={() => { clearEnriched('industry'); set('industry', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <input value={form.industry} onChange={e => { set('industry', e.target.value); clearEnriched('industry') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('industry')}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                {companyStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                HQ / Location
                {enrichedFields.has('hq') && (
                  <button type="button" onClick={() => { clearEnriched('hq'); set('hq', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <input value={form.hq} onChange={e => { set('hq', e.target.value); clearEnriched('hq') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('hq')}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Employees</label>
              <input type="number" value={form.size} onChange={e => set('size', e.target.value)} min="1"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Phone
                {enrichedFields.has('phone') && (
                  <button type="button" onClick={() => { clearEnriched('phone'); set('phone', '') }}
                    className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                    auto-filled &times;
                  </button>
                )}
              </label>
              <input type="tel" value={form.phone} onChange={e => { set('phone', e.target.value); clearEnriched('phone') }}
                className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${ec('phone')}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Annual Revenue</label>
              <input type="number" value={form.annualRevenue} onChange={e => set('annualRevenue', e.target.value)} min="0"
                placeholder="0"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Website</label>
            <div className="relative">
              <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="gravissmarketing.com"
                onBlur={handleWebsiteBlur}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {enriching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-blue-600">
                  <Loader2 size={12} className="animate-spin" /> Fetching info...
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner / Account Rep</label>
            <select value={form.owner} onChange={e => set('owner', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {!REPS.includes(form.owner) && form.owner && <option value={form.owner}>{form.owner}</option>}
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
              {enrichedFields.has('description') && (
                <button type="button" onClick={() => { clearEnriched('description'); set('description', '') }}
                  className="ml-1 text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full hover:bg-blue-200">
                  auto-filled &times;
                </button>
              )}
            </label>
            <textarea value={form.description} onChange={e => { set('description', e.target.value); clearEnriched('description') }} rows={4}
              placeholder="About this company..."
              className={`w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${ec('description')}`} />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Save Changes
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null)
  const [integrationsCompany, setIntegrationsCompany] = useState<CRMCompany | null>(null)
  const [editingCompany, setEditingCompany] = useState<CRMCompany | null>(null)
  const [localCompanies, setLocalCompanies] = useState<CRMCompany[]>([])
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gravhub-companies-pageSize')
      return saved ? Number(saved) : 25
    }
    return 25
  })

  const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [crmActivities, setCrmActivities] = useState<CRMActivity[]>([])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
    localStorage.setItem('gravhub-companies-pageSize', String(size))
  }, [])

  useEffect(() => {
    fetch('/api/crm/companies?limit=50000')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLocalCompanies(data) })
      .catch(() => toast('Failed to load companies', 'error'))
      .finally(() => setLoading(false))
    fetchCrmContacts().then(setCrmContacts)
    fetchDeals().then(setDeals)
    fetchContracts().then(setContracts)
    fetchInvoices().then(setInvoices)
    fetchProjects().then(setProjects)
    fetchCrmActivities().then(setCrmActivities)
  }, [])

  async function handleEditCompany(updated: CRMCompany) {
    setLocalCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditingCompany(null)
    if (selectedCompany?.id === updated.id) setSelectedCompany(updated)
    await fetch(`/api/crm/companies/${updated.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => toast('Failed to save company changes', 'error'))
  }

  async function handleNewCompany(data: NewCompanyFormData) {
    const payload: Omit<CRMCompany, 'id'> = {
      name: data.name,
      industry: data.industry,
      website: data.website || undefined,
      phone: data.phone || undefined,
      hq: data.hq,
      size: data.size,
      annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
      status: data.status,
      owner: data.owner,
      description: data.description || undefined,
      tags: [],
      contactIds: [],
      dealIds: [],
      createdDate: new Date().toISOString().split('T')[0],
      totalDealValue: data.proposal ? data.proposal.grandTotal : 0,
    }
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saved = await res.json()
      setLocalCompanies(prev => [saved, ...prev])
    } catch {
      setLocalCompanies(prev => [{ ...payload, id: `co-${Date.now()}` } as CRMCompany, ...prev])
    }
    setCreatingCompany(false)
  }

  async function handleDeleteCompany(id: string) {
    if (!confirm('Delete this company? This action cannot be undone.')) return
    setLocalCompanies(prev => prev.filter(c => c.id !== id))
    if (selectedCompany?.id === id) setSelectedCompany(null)
    await fetch(`/api/crm/companies/${id}`, { method: 'DELETE' }).catch(() => toast('Failed to delete company', 'error'))
  }

  const filtered = localCompanies.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.hq.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const allFilteredIds = filtered.map(c => c.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allFilteredIds))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    setLocalCompanies(prev => prev.filter(c => !selectedIds.has(c.id)))
    setSelectedIds(new Set())
    setShowBulkDeleteConfirm(false)
    try {
      await fetch('/api/crm/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'companies', ids }),
      })
      toast(`${ids.length} companies deleted`, 'success')
    } catch {
      toast('Failed to delete companies', 'error')
    }
  }

  useEffect(() => { requestAnimationFrame(() => setCurrentPage(1)) }, [search, statusFilter])

  const effectivePageSize = pageSize <= 0 ? filtered.length : pageSize
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * effectivePageSize
  const paginatedCompanies = filtered.slice(startIndex, startIndex + effectivePageSize)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Company', onClick: () => setCreatingCompany(true) }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col bg-[#f8faf9]">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
            <Search size={13} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies, industry, location..."
              className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <Filter size={13} className="text-gray-400 flex-shrink-0" />
            {(['All', ...companyStatuses] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex-shrink-0 ${
                  statusFilter === s ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
                style={statusFilter === s ? { background: '#015035' } : {}}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowDuplicates(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <GitMerge size={13} /> Show Duplicates
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Upload size={13} /> Import CSV
          </button>
          <span className="ml-auto text-sm text-gray-400">{filtered.length} companies</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="w-10 py-2.5 px-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                  />
                </th>
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Industry</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Contacts</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Pipeline</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Contract</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden xl:table-cell">Owner</th>
                <th className="text-left py-2.5 px-4 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.map(company => {
                const companyContacts = crmContacts.filter(c => c.companyId === company.id)
                const companyDeals = deals.filter(d => d.company === company.name && !d.stage.startsWith('Closed'))
                const companyContract = contracts.find(c => c.company === company.name)
                return (
                  <tr
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(company.id) ? 'bg-emerald-50/50' : ''}`}
                  >
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(company.id)}
                        onChange={() => toggleSelect(company.id)}
                        className="rounded border-gray-300 text-[#015035] focus:ring-[#015035] cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                          {company.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                          <p className="text-xs text-gray-400 hidden sm:block">{company.hq}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-sm text-gray-600">{company.industry}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        {companyContacts.slice(0, 3).map(c => (
                          <div
                            key={c.id}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 -ml-1 first:ml-0 border border-white"
                            title={c.fullName}
                          >
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                        ))}
                        {companyContacts.length > 3 && (
                          <span className="text-xs text-gray-400 ml-1">+{companyContacts.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {companyDeals.length > 0 ? (
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#015035' }}>
                            {formatCurrency(companyDeals.reduce((s, d) => s + d.value, 0))}
                          </p>
                          <p className="text-[11px] text-gray-400">{companyDeals.length} open deal{companyDeals.length > 1 ? 's' : ''}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {companyContract ? (
                        <div>
                          <StatusBadge label={companyContract.status} colorClass={contractStatusColors[companyContract.status]} />
                          <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(companyContract.value)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-600">{company.owner.split(' ')[0]}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCompany(company.id) }}
                          className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete company"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No companies match your search.</p>
            </div>
          )}
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-gray-100">
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      </div>

      {selectedCompany && (
        <CompanyPanel
          company={localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany}
          crmContacts={crmContacts}
          deals={deals}
          contracts={contracts}
          invoices={invoices}
          projects={projects}
          crmActivities={crmActivities}
          onClose={() => setSelectedCompany(null)}
          onEdit={() => setEditingCompany(localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany)}
          onDelete={() => handleDeleteCompany(selectedCompany.id)}
          onOpenIntegrations={() => setIntegrationsCompany(selectedCompany)}
        />
      )}
      {integrationsCompany && (
        <ClientIntegrationsPanel
          companyName={integrationsCompany.name}
          companyId={integrationsCompany.id}
          onClose={() => setIntegrationsCompany(null)}
        />
      )}
      {editingCompany && (
        <EditCompanyPanel
          company={editingCompany}
          onSave={handleEditCompany}
          onClose={() => setEditingCompany(null)}
        />
      )}
      {creatingCompany && <NewCompanyPanel onSave={handleNewCompany} onClose={() => setCreatingCompany(false)} />}
      {showImport && (
        <HubSpotImportPanel
          defaultType="companies"
          onClose={() => setShowImport(false)}
          onComplete={() => {
            fetch('/api/crm/companies?limit=50000').then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setLocalCompanies(data) })
          }}
          onShowDuplicates={() => setShowDuplicates(true)}
        />
      )}
      {someSelected && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onDeselectAll={() => setSelectedIds(new Set())}
          actions={[
            { label: 'Export', icon: <Download size={13} />, onClick: () => {} },
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: () => setShowBulkDeleteConfirm(true), variant: 'danger' },
          ]}
        />
      )}
      {showBulkDeleteConfirm && (
        <ConfirmModal
          title={`Delete ${selectedIds.size} companies?`}
          description="This will also remove associated contacts, deals, and contracts."
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}
      {showDuplicates && (
        <DuplicatesPanel
          type="companies"
          onClose={() => setShowDuplicates(false)}
          onMergeComplete={() => {
            fetch('/api/crm/companies?limit=50000').then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setLocalCompanies(data) })
          }}
        />
      )}
    </>
  )
}
