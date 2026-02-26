'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import { crmContacts, crmCompanies, deals, contracts, projects, crmActivities } from '@/lib/data'
import {
  formatCurrency, stageColors, serviceTypeColors,
  contractStatusColors, projectStatusColors,
} from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { CRMContact, CRMActivity, ActivityType } from '@/lib/types'
import {
  X, Phone, Mail, Building2, User, Search, Plus, ScrollText,
  ChevronRight, Linkedin, PhoneCall, Video, StickyNote, CheckSquare,
  TrendingUp, DollarSign, FileText, Clock, FolderKanban,
} from 'lucide-react'

// ─── CRM Sub-Nav ──────────────────────────────────────────────────────────────

function CRMSubNav() {
  const pathname = usePathname()
  const tabs = [
    { label: 'Pipeline', href: '/crm/pipeline' },
    { label: `Companies (${crmCompanies.length})`, href: '/crm/companies' },
    { label: `Contacts (${crmContacts.length})`, href: '/crm/contacts' },
    { label: 'Sequences', href: '/crm/sequences' },
  ]
  return (
    <div className="flex gap-1 border-b border-gray-200 px-6 pt-2 bg-white -mt-2 mb-5">
      {tabs.map(t => (
        <Link key={t.href} href={t.href} className={`tab-btn ${pathname === t.href ? 'active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        {label && <p className="text-[11px] text-gray-400">{label}</p>}
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  )
}

const activityConfig: Record<ActivityType, { icon: React.ReactNode; color: string }> = {
  call:     { icon: <PhoneCall size={14} />,   color: '#3b82f6' },
  email:    { icon: <Mail size={14} />,         color: '#f59e0b' },
  meeting:  { icon: <Video size={14} />,        color: '#8b5cf6' },
  note:     { icon: <StickyNote size={14} />,   color: '#6b7280' },
  task:     { icon: <CheckSquare size={14} />,  color: '#10b981' },
  deal:     { icon: <TrendingUp size={14} />,   color: '#015035' },
  contract: { icon: <ScrollText size={14} />,   color: '#f97316' },
  invoice:  { icon: <DollarSign size={14} />,   color: '#ef4444' },
  proposal: { icon: <FileText size={14} />,     color: '#6366f1' },
}

// ─── Contact Detail Panel ─────────────────────────────────────────────────────

function ContactPanel({ contact, onClose }: { contact: CRMContact; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'pipeline' | 'contracts' | 'activity'>('overview')

  // Cross-linked data
  const company = crmCompanies.find(c => c.id === contact.companyId)
  const contactDeals = deals.filter(d => d.company === contact.companyName)
  const contactContracts = contracts.filter(c => c.company === contact.companyName)
  const companyProject = projects.find(p => p.company === contact.companyName)
  const activities = crmActivities.filter(
    a => a.contactId === contact.id || a.companyId === contact.companyId
  )

  const activeDeal = contactDeals.find(d => !d.stage.startsWith('Closed'))
  const executedContract = contactContracts.find(c => c.status === 'Fully Executed')

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-[520px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4 flex-1 min-w-0 pr-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {contact.fullName}
                </h2>
                <p className="text-white/60 text-sm">{contact.title}</p>
                {contact.isPrimary && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block">
                    Primary Contact
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>

          {/* Company link + action buttons */}
          <Link
            href="/crm/companies"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-xl p-3 transition-colors mb-3"
          >
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {company?.name[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">{contact.companyName}</p>
              {company && <p className="text-white/50 text-xs">{company.industry} · {company.hq}</p>}
            </div>
            <ChevronRight size={14} className="text-white/40 flex-shrink-0" />
          </Link>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Pipeline Stage', value: activeDeal?.stage ?? 'No Deal' },
              { label: 'Deal Value', value: activeDeal ? formatCurrency(activeDeal.value) : '—' },
              { label: 'Contract', value: executedContract ? 'Active' : contactContracts.length > 0 ? 'Pending' : 'None' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-white text-xs font-bold truncate">{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Mail size={13} /> Email
          </a>
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
            <Phone size={13} /> Call
          </a>
          {contact.linkedIn && (
            <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              <Linkedin size={13} /> LinkedIn
            </a>
          )}
          <button className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white hover:opacity-90" style={{ background: '#015035' }}>
            <Plus size={13} /> Log Activity
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0">
          {(['overview', 'pipeline', 'contracts', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Info</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<Mail size={14} />} label="Email" value={
                    <a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline">{contact.email}</a>
                  } />
                  <InfoRow icon={<Phone size={14} />} label="Phone" value={contact.phone} />
                  {contact.mobile && <InfoRow icon={<Phone size={14} />} label="Mobile" value={contact.mobile} />}
                  <InfoRow icon={<User size={14} />} label="Owner" value={contact.owner} />
                  {contact.lastActivity && (
                    <InfoRow icon={<Clock size={14} />} label="Last Activity" value={contact.lastActivity} />
                  )}
                </div>
              </div>

              {contact.notes && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{contact.notes}</p>
                </div>
              )}

              {contact.tags.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
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
                    <div className="flex items-center gap-2">
                      <FolderKanban size={14} className="text-gray-400" />
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
            </div>
          )}

          {/* ── Pipeline ── */}
          {tab === 'pipeline' && (
            <div className="flex flex-col gap-3">
              {contactDeals.map(d => (
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
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{d.probability}% probability</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Close date: {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
              {contactDeals.length === 0 && (
                <div className="text-center py-12">
                  <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No pipeline deals linked.</p>
                </div>
              )}
              <Link
                href="/crm/pipeline"
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2"
              >
                View full pipeline <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {/* ── Contracts ── */}
          {tab === 'contracts' && (
            <div className="flex flex-col gap-3">
              {contactContracts.map(c => (
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
                      { label: 'Start', value: new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                      { label: 'Renewal', value: new Date(c.renewalDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
                    ].map(f => (
                      <div key={f.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                        <p className="text-xs font-semibold text-gray-800">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {contactContracts.length === 0 && (
                <div className="text-center py-12">
                  <ScrollText size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No contracts found.</p>
                </div>
              )}
              <Link
                href="/contracts"
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 py-2"
              >
                View all contracts <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <div>
              {activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No activities logged.</p>
              ) : (
                <div className="flex flex-col">
                  {activities.map((act, idx) => {
                    const cfg = activityConfig[act.type]
                    return (
                      <div key={act.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                            style={{ background: `${cfg.color}15`, color: cfg.color }}
                          >
                            {cfg.icon}
                          </div>
                          {idx < activities.length - 1 && (
                            <div className="w-px flex-1 bg-gray-100 my-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900">{act.title}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {act.duration && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                  <Clock size={10} />{act.duration}m
                                </span>
                              )}
                              <span className="text-[11px] text-gray-400">
                                {new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>
                          {act.body && (
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{act.body}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {act.outcome && (
                              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                Outcome: {act.outcome}
                              </span>
                            )}
                            {act.nextStep && (
                              <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                Next: {act.nextStep}
                              </span>
                            )}
                            <span className="text-[11px] text-gray-400">by {act.user}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
            Log Activity
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null)

  const filtered = crmContacts.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Companies · Contacts · Deals · Activity" action={{ label: 'New Contact' }} />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-sm">
            <Search size={13} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts, company, title..."
              className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
            />
          </div>
          <span className="ml-auto text-sm text-gray-400">{filtered.length} contacts</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Name</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden sm:table-cell">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden md:table-cell">Title</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Pipeline Stage</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden lg:table-cell">Contract Value</th>
                <th className="text-left py-2.5 px-4 font-semibold hidden xl:table-cell">Owner</th>
                <th className="text-left py-2.5 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => {
                const activeDeal = deals.find(d => d.company === contact.companyName && !d.stage.startsWith('Closed'))
                const contactContract = contracts.find(c => c.company === contact.companyName)
                return (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: '#015035' }}
                        >
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{contact.fullName}</p>
                          {contact.isPrimary && (
                            <span className="text-[10px] text-emerald-600 font-medium">Primary</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <Link
                        href="/crm/companies"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        {contact.companyName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-sm text-gray-500">{contact.title}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {activeDeal ? (
                        <div>
                          <StatusBadge label={activeDeal.stage} colorClass={stageColors[activeDeal.stage]} />
                          <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(activeDeal.value)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {contactContract ? (
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#015035' }}>
                            {formatCurrency(contactContract.value)}
                          </p>
                          <StatusBadge label={contactContract.status} colorClass={contractStatusColors[contactContract.status]} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No contract</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden xl:table-cell">
                      <span className="text-sm text-gray-500">{contact.owner.split(' ')[0]}</span>
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <a href={`mailto:${contact.email}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Mail size={13} />
                        </a>
                        <a href={`tel:${contact.phone}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Phone size={13} />
                        </a>
                        {contact.linkedIn && (
                          <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                            <Linkedin size={13} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <User size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No contacts match your search.</p>
            </div>
          )}
        </div>
      </div>

      {selectedContact && <ContactPanel contact={selectedContact} onClose={() => setSelectedContact(null)} />}
    </>
  )
}
