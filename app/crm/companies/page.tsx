'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { crmCompanies, crmContacts, deals, contracts, invoices, projects, crmActivities } from '@/lib/data'
import {
  formatCurrency, stageColors, serviceTypeColors, contractStatusColors,
  projectStatusColors, invoiceStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import CRMSubNav from '@/components/crm/CRMSubNav'
import { InfoRow, ActivityTimeline } from '@/components/crm/activityUtils'
import LogActivityForm, { type LoggedActivity } from '@/components/crm/LogActivityForm'
import NewCompanyPanel, { type NewCompanyFormData } from '@/components/crm/NewCompanyPanel'
import NewContactPanel, { type NewContactFormData } from '@/components/crm/NewContactPanel'
import NewProposalPanel, { type NewProposalFormData } from '@/components/crm/NewProposalPanel'
import AiInsightsPanel from '@/components/crm/AiInsightsPanel'
import type { CRMCompany, CRMContact, CompanyStatus } from '@/lib/types'
import {
  X, Phone, Mail, Building2, MapPin, Users, Globe, DollarSign,
  User, Filter, Search, Plus, FileText, ScrollText, ChevronRight,
  ExternalLink, TrendingUp, FolderKanban, Pencil, Tag,
} from 'lucide-react'

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

function CompanyPanel({ company, onClose, onEdit }: { company: CRMCompany; onClose: () => void; onEdit?: () => void }) {
  const [tab, setTab] = useState<'overview' | 'contacts' | 'deals' | 'contracts' | 'activity'>('overview')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [extraContacts, setExtraContacts] = useState<CRMContact[]>([])
  const [localTags, setLocalTags] = useState<string[]>(company.tags)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)
  const [localActivities, setLocalActivities] = useState(
    () => crmActivities.filter(a => a.companyId === company.id)
  )

  function handleAddTag() {
    const tag = newTag.trim()
    if (!tag || localTags.includes(tag)) return
    setLocalTags(prev => [...prev, tag])
    setNewTag('')
    setAddingTag(false)
  }

  function handleRemoveTag(tag: string) {
    setLocalTags(prev => prev.filter(t => t !== tag))
  }

  function handleAddContact(data: NewContactFormData) {
    const newContact: CRMContact = {
      id: `contact-${Date.now()}`,
      companyId: company.id,
      companyName: company.name,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`,
      title: data.title,
      emails: data.email ? [data.email] : [],
      phones: data.phone ? [data.phone] : [],
      linkedIn: data.linkedIn || undefined,
      website: data.website || undefined,
      isPrimary: false,
      owner: data.owner,
      tags: [],
      contactNotes: [],
      contactTasks: [],
      createdDate: new Date().toISOString().split('T')[0],
    }
    setExtraContacts(prev => [...prev, newContact])
    setAddingContact(false)
  }

  function handleSaveActivity(activity: LoggedActivity) {
    setLocalActivities(prev => [{
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
    }, ...prev])
    setLoggingActivity(false)
    setTab('activity')
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
              {onEdit && (
                <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" title="Edit company">
                  <Pencil size={15} className="text-white/60" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
                <X size={18} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2">
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

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Industry</label>
              <input value={form.industry} onChange={e => set('industry', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">HQ / Location</label>
              <input value={form.hq} onChange={e => set('hq', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Employees</label>
              <input type="number" value={form.size} onChange={e => set('size', e.target.value)} min="1"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
            <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="gravissmarketing.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Owner / Account Rep</label>
            <input value={form.owner} onChange={e => set('owner', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
              placeholder="About this company..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null)
  const [editingCompany, setEditingCompany] = useState<CRMCompany | null>(null)
  const [localCompanies, setLocalCompanies] = useState<CRMCompany[]>(crmCompanies)
  const [creatingCompany, setCreatingCompany] = useState(false)

  function handleEditCompany(updated: CRMCompany) {
    setLocalCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditingCompany(null)
    if (selectedCompany?.id === updated.id) setSelectedCompany(updated)
  }

  function handleNewCompany(data: NewCompanyFormData) {
    const newCompany: CRMCompany = {
      id: `co-${Date.now()}`,
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
    setLocalCompanies(prev => [newCompany, ...prev])
    setCreatingCompany(false)
  }

  const filtered = localCompanies.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.hq.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Company', onClick: () => setCreatingCompany(true) }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

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
          <span className="ml-auto text-sm text-gray-400">{filtered.length} companies</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
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
              {filtered.map(company => {
                const companyContacts = crmContacts.filter(c => c.companyId === company.id)
                const companyDeals = deals.filter(d => d.company === company.name && !d.stage.startsWith('Closed'))
                const companyContract = contracts.find(c => c.company === company.name)
                return (
                  <tr
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
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
                      <ChevronRight size={14} className="text-gray-300" />
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
        </div>
      </div>

      {selectedCompany && (
        <CompanyPanel
          company={localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onEdit={() => setEditingCompany(localCompanies.find(c => c.id === selectedCompany.id) ?? selectedCompany)}
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
    </>
  )
}
