'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { deals, crmCompanies, crmContacts, crmActivities } from '@/lib/data'
import { formatCurrency, stageColors, serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Deal, DealStage, CRMCompany, CRMContact, CRMActivity, ActivityType, CompanyStatus } from '@/lib/types'
import {
  X, Phone, Mail, Calendar, TrendingUp, DollarSign,
  FileText, ScrollText, User, Building2, ChevronDown,
  Search, Plus, Globe, MapPin, Users, Clock,
  PhoneCall, MessageSquare, Video, StickyNote, CheckSquare,
  ExternalLink, Linkedin, Filter, ChevronRight,
} from 'lucide-react'

// ─── Pipeline Kanban ─────────────────────────────────────────────────────────

const stages: DealStage[] = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']

const stageHeaderColors: Record<DealStage, string> = {
  Lead: '#9ca3af',
  Qualified: '#3b82f6',
  'Proposal Sent': '#f59e0b',
  'Contract Sent': '#f97316',
  'Closed Won': '#22c55e',
  'Closed Lost': '#ef4444',
}

function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  return (
    <div className="deal-card" onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{deal.company}</p>
          <p className="text-xs text-gray-400 mt-0.5">{deal.contact.name}</p>
        </div>
        <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType]} />
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
          {formatCurrency(deal.value)}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: '#015035' }} />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">{deal.probability}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar size={11} />
          <span className="text-[11px]">
            {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600">
            {deal.assignedRep.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-[11px] text-gray-400">{deal.assignedRep.split(' ')[0]}</span>
        </div>
      </div>
    </div>
  )
}

function DealModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'activity' | 'tasks'>('overview')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge label={deal.stage} colorClass={stageColors[deal.stage]} />
              <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType]} />
            </div>
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{deal.company}</h2>
            <p className="text-gray-500 text-sm mt-0.5">{deal.contact.title} — {deal.contact.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex gap-1 px-6 pt-4">
          {(['overview', 'activity', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deal Info</p>
                  <div className="flex flex-col gap-2.5">
                    <InfoRow icon={<DollarSign size={14} />} label="Value" value={<span className="font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(deal.value)}</span>} />
                    <InfoRow icon={<Calendar size={14} />} label="Close Date" value={new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
                    <InfoRow icon={<TrendingUp size={14} />} label="Probability" value={
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: '#015035' }} />
                        </div>
                        <span className="text-sm font-semibold">{deal.probability}%</span>
                      </div>
                    } />
                    <InfoRow icon={<User size={14} />} label="Rep" value={deal.assignedRep} />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <ul className="flex flex-col gap-1.5">
                    {deal.notes.map((note, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-gray-400">·</span>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
                  <div className="flex flex-col gap-2">
                    <InfoRow icon={<Building2 size={14} />} label="" value={deal.company} />
                    <InfoRow icon={<User size={14} />} label="" value={`${deal.contact.name} — ${deal.contact.title}`} />
                    <InfoRow icon={<Mail size={14} />} label="" value={deal.contact.email} />
                    <InfoRow icon={<Phone size={14} />} label="" value={deal.contact.phone} />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</p>
                  <div className="flex flex-col gap-2">
                    <button className="flex items-center justify-between text-sm font-medium text-white px-3 py-2 rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                      Advance Stage <ChevronDown size={14} />
                    </button>
                    <button className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">Log Activity</button>
                    <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"><FileText size={14} />View Proposals</button>
                    <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"><ScrollText size={14} />View Contracts</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === 'activity' && (
            <div className="flex flex-col gap-3">
              {[
                { icon: <Mail size={14} />, text: 'Proposal sent via email', time: '2 days ago', color: '#f59e0b' },
                { icon: <Phone size={14} />, text: 'Discovery call — 45 min', time: '5 days ago', color: '#3b82f6' },
                { icon: <User size={14} />, text: 'Deal created', time: '1 week ago', color: '#015035' },
              ].map((a, i) => (
                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18`, color: a.color }}>{a.icon}</div>
                  <div>
                    <p className="text-sm text-gray-800">{a.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.time} · {deal.assignedRep}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'tasks' && (
            <div className="flex flex-col gap-2">
              {[
                { title: 'Follow up on proposal', due: '2026-03-01', done: false },
                { title: 'Send contract draft', due: '2026-03-05', done: false },
                { title: 'Discovery call completed', due: '2026-02-20', done: true },
              ].map((t, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${t.done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${t.done ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                    {t.done && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                  <span className={`text-sm flex-1 ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                  <span className="text-xs text-gray-400">{new Date(t.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

const companyStatusColors: Record<string, string> = {
  'Prospect': 'bg-blue-50 text-blue-700',
  'Active Client': 'bg-emerald-50 text-emerald-700',
  'Past Client': 'bg-gray-100 text-gray-600',
  'Partner': 'bg-purple-50 text-purple-700',
  'Churned': 'bg-red-50 text-red-600',
}

const activityConfig: Record<ActivityType, { icon: React.ReactNode; color: string; label: string }> = {
  call:     { icon: <PhoneCall size={14} />,     color: '#3b82f6', label: 'Call' },
  email:    { icon: <Mail size={14} />,           color: '#f59e0b', label: 'Email' },
  meeting:  { icon: <Video size={14} />,          color: '#8b5cf6', label: 'Meeting' },
  note:     { icon: <StickyNote size={14} />,     color: '#6b7280', label: 'Note' },
  task:     { icon: <CheckSquare size={14} />,    color: '#10b981', label: 'Task' },
  deal:     { icon: <TrendingUp size={14} />,     color: '#015035', label: 'Deal' },
  contract: { icon: <ScrollText size={14} />,     color: '#f97316', label: 'Contract' },
  invoice:  { icon: <DollarSign size={14} />,     color: '#ef4444', label: 'Invoice' },
  proposal: { icon: <FileText size={14} />,       color: '#6366f1', label: 'Proposal' },
}

function ActivityTimeline({ activities }: { activities: CRMActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No activities logged yet.</p>
  }
  return (
    <div className="flex flex-col">
      {activities.map((act, idx) => {
        const cfg = activityConfig[act.type]
        return (
          <div key={act.id} className="flex gap-3 group">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: `${cfg.color}15`, color: cfg.color }}
              >
                {cfg.icon}
              </div>
              {idx < activities.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
            </div>
            {/* Content */}
            <div className="flex-1 pb-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{act.title}</p>
                  {act.companyName && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {act.companyName}{act.contactName ? ` · ${act.contactName}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-right">
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
              {act.body && <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{act.body}</p>}
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
  )
}

// ─── Company Modal ────────────────────────────────────────────────────────────

function CompanyModal({ company, onClose }: { company: CRMCompany; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'contacts' | 'deals' | 'activity'>('overview')
  const contacts = crmContacts.filter(c => c.companyId === company.id)
  const companyDeals = deals.filter(d => d.company === company.name)
  const activities = crmActivities.filter(a => a.companyId === company.id)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                style={{ background: '#015035' }}>
                {company.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{company.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                    {company.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1"><Building2 size={11} />{company.industry}</span>
                  <span className="flex items-center gap-1"><MapPin size={11} />{company.hq}</span>
                  <span className="flex items-center gap-1"><Users size={11} />{company.size} employees</span>
                  {company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                      <Globe size={11} />{company.website.replace('https://', '')}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50"><X size={18} className="text-gray-400" /></button>
          </div>
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Total Deal Value</p>
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                {formatCurrency(company.totalDealValue)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Contacts</p>
              <p className="text-base font-bold text-gray-900">{contacts.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Open Deals</p>
              <p className="text-base font-bold text-gray-900">{companyDeals.filter(d => !d.stage.startsWith('Closed')).length}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-100 pb-0">
          {(['overview', 'contacts', 'deals', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Company Details</p>
                  <div className="flex flex-col gap-2.5">
                    <InfoRow icon={<Building2 size={14} />} label="Industry" value={company.industry} />
                    <InfoRow icon={<MapPin size={14} />} label="HQ" value={company.hq} />
                    <InfoRow icon={<Users size={14} />} label="Size" value={`${company.size} employees`} />
                    {company.annualRevenue && <InfoRow icon={<DollarSign size={14} />} label="Annual Revenue" value={formatCurrency(company.annualRevenue)} />}
                    {company.phone && <InfoRow icon={<Phone size={14} />} label="Phone" value={company.phone} />}
                    {company.website && <InfoRow icon={<Globe size={14} />} label="Website" value={
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {company.website.replace('https://', '')} <ExternalLink size={11} />
                      </a>
                    } />}
                    <InfoRow icon={<User size={14} />} label="Owner" value={company.owner} />
                  </div>
                </div>
                {company.description && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{company.description}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4">
                {/* Primary contacts */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Primary Contacts</p>
                  <div className="flex flex-col gap-2">
                    {contacts.filter(c => c.isPrimary).map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-100">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.fullName}</p>
                          <p className="text-xs text-gray-400 truncate">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a href={`mailto:${c.email}`} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" onClick={e => e.stopPropagation()}>
                            <Mail size={12} />
                          </a>
                          <a href={`tel:${c.phone}`} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" onClick={e => e.stopPropagation()}>
                            <Phone size={12} />
                          </a>
                        </div>
                      </div>
                    ))}
                    {contacts.filter(c => c.isPrimary).length === 0 && (
                      <p className="text-xs text-gray-400">No primary contact set.</p>
                    )}
                  </div>
                </div>
                {/* Tags */}
                {company.tags.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {company.tags.map(tag => (
                        <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Quick actions */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Actions</p>
                  <div className="flex flex-col gap-2">
                    <button className="flex items-center gap-2 text-sm font-medium text-white px-3 py-2 rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                      <Plus size={14} /> Log Activity
                    </button>
                    <button className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
                      <FileText size={14} /> New Proposal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {tab === 'contacts' && (
            <div className="flex flex-col gap-3">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: '#015035' }}>
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      {c.isPrimary && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Primary</span>}
                    </div>
                    <p className="text-xs text-gray-500">{c.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>
                    <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" onClick={e => e.stopPropagation()}><Mail size={13} /></a>
                    <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" onClick={e => e.stopPropagation()}><Phone size={13} /></a>
                    {c.linkedIn && <a href={c.linkedIn} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" onClick={e => e.stopPropagation()}><Linkedin size={13} /></a>}
                  </div>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No contacts linked to this company.</p>}
            </div>
          )}

          {/* Deals Tab */}
          {tab === 'deals' && (
            <div className="flex flex-col gap-3">
              {companyDeals.map(d => (
                <div key={d.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      <StatusBadge label={d.serviceType} colorClass={serviceTypeColors[d.serviceType]} />
                    </div>
                    <p className="text-sm text-gray-700">{d.contact.name} · Close {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(d.value)}</p>
                    <p className="text-xs text-gray-400">{d.probability}% probability</p>
                  </div>
                </div>
              ))}
              {companyDeals.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No deals linked to this company.</p>}
            </div>
          )}

          {/* Activity Tab */}
          {tab === 'activity' && (
            <div>
              <button className="mb-4 flex items-center gap-2 text-sm font-medium text-white px-3 py-2 rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                <Plus size={14} /> Log Activity
              </button>
              <ActivityTimeline activities={activities} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ contact, onClose }: { contact: CRMContact; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'deals' | 'activity'>('overview')
  const contactDeals = deals.filter(d => d.company === contact.companyName)
  const activities = crmActivities.filter(a => a.contactId === contact.id || a.companyId === contact.companyId)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                style={{ background: '#015035' }}>
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{contact.fullName}</h2>
                <p className="text-sm text-gray-500">{contact.title}</p>
                <a href={`/crm?company=${contact.companyId}`} className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                  <Building2 size={11} />{contact.companyName}
                </a>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50"><X size={18} className="text-gray-400" /></button>
          </div>
          {/* Contact actions */}
          <div className="flex gap-2 mt-4">
            <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              <Mail size={14} /> Email
            </a>
            <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
              <Phone size={14} /> Call
            </a>
            {contact.linkedIn && (
              <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">
                <Linkedin size={14} /> LinkedIn
              </a>
            )}
            <button className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg text-white hover:opacity-90" style={{ background: '#015035' }}>
              <Plus size={14} /> Log Activity
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(['overview', 'deals', 'activity'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Info</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<Mail size={14} />} label="Email" value={<a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>{contact.email}</a>} />
                  <InfoRow icon={<Phone size={14} />} label="Phone" value={contact.phone} />
                  {contact.mobile && <InfoRow icon={<Phone size={14} />} label="Mobile" value={contact.mobile} />}
                  <InfoRow icon={<User size={14} />} label="Owner" value={contact.owner} />
                  {contact.lastActivity && <InfoRow icon={<Clock size={14} />} label="Last Activity" value={new Date(contact.lastActivity).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />}
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
            </div>
          )}
          {tab === 'deals' && (
            <div className="flex flex-col gap-3">
              {contactDeals.map(d => (
                <div key={d.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge label={d.stage} colorClass={stageColors[d.stage]} />
                      <StatusBadge label={d.serviceType} colorClass={serviceTypeColors[d.serviceType]} />
                    </div>
                    <p className="text-xs text-gray-500">Close {new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(d.value)}</p>
                </div>
              ))}
              {contactDeals.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No deals linked.</p>}
            </div>
          )}
          {tab === 'activity' && <ActivityTimeline activities={activities} />}
        </div>
      </div>
    </div>
  )
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────

type CRMTab = 'pipeline' | 'companies' | 'contacts' | 'activity'

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<CRMTab>('pipeline')

  // Pipeline state
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [filterRep, setFilterRep] = useState('All')

  // Companies state
  const [companySearch, setCompanySearch] = useState('')
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string>('All')
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null)

  // Contacts state
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null)

  // Activity state
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | 'all'>('all')

  // Pipeline derived
  const reps = ['All', ...Array.from(new Set(deals.map(d => d.assignedRep)))]
  const filteredDeals = filterRep === 'All' ? deals : deals.filter(d => d.assignedRep === filterRep)

  // Companies derived
  const filteredCompanies = crmCompanies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
      c.industry.toLowerCase().includes(companySearch.toLowerCase())
    const matchStatus = companyStatusFilter === 'All' || c.status === companyStatusFilter
    return matchSearch && matchStatus
  })

  // Contacts derived
  const filteredContacts = crmContacts.filter(c =>
    c.fullName.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.companyName.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.title.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(contactSearch.toLowerCase())
  )

  // Activity derived
  const filteredActivities = activityTypeFilter === 'all'
    ? crmActivities
    : crmActivities.filter(a => a.type === activityTypeFilter)

  const companyStatuses: CompanyStatus[] = ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned']

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: activeTab === 'pipeline' ? 'New Deal' : activeTab === 'companies' ? 'New Company' : activeTab === 'contacts' ? 'New Contact' : 'Log Activity' }}
      />

      <div className="p-4 md:p-6 flex-1 flex flex-col">
        {/* Top-level tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 pb-0">
          {(['pipeline', 'companies', 'contacts', 'activity'] as CRMTab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`tab-btn capitalize ${activeTab === t ? 'active' : ''}`}
            >
              {t === 'pipeline' ? 'Pipeline' : t === 'companies' ? `Companies (${crmCompanies.length})` : t === 'contacts' ? `Contacts (${crmContacts.length})` : 'Activity'}
            </button>
          ))}
        </div>

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
          <>
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {reps.map(rep => (
                <button key={rep} onClick={() => setFilterRep(rep)} className={`tab-btn ${filterRep === rep ? 'active' : ''}`}>{rep}</button>
              ))}
              <div className="ml-auto text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{filteredDeals.length}</span> deals ·{' '}
                <span className="font-semibold" style={{ color: '#015035' }}>{formatCurrency(filteredDeals.reduce((s, d) => s + d.value, 0))}</span>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {stages.map(stage => {
                const stageDeal = filteredDeals.filter(d => d.stage === stage)
                const stageTotal = stageDeal.reduce((s, d) => s + d.value, 0)
                return (
                  <div key={stage} className="kanban-col" style={{ minWidth: 220 }}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: stageHeaderColors[stage] }} />
                        <span className="text-xs font-semibold text-gray-700">{stage}</span>
                        <span className="text-xs font-semibold text-white rounded-full px-1.5 py-0.5 min-w-5 text-center" style={{ background: stageHeaderColors[stage], fontSize: '10px' }}>
                          {stageDeal.length}
                        </span>
                      </div>
                      {stageTotal > 0 && <span className="text-[11px] text-gray-400">{formatCurrency(stageTotal)}</span>}
                    </div>
                    <div className="flex flex-col gap-2">
                      {stageDeal.map(deal => <DealCard key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />)}
                      {stageDeal.length === 0 && (
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-gray-400">No deals</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── COMPANIES TAB ── */}
        {activeTab === 'companies' && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs">
                <Search size={13} className="text-gray-400" />
                <input
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Search companies..."
                  className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter size={13} className="text-gray-400" />
                {['All', ...companyStatuses].map(s => (
                  <button key={s} onClick={() => setCompanyStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${companyStatusFilter === s ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    style={companyStatusFilter === s ? { background: '#015035' } : {}}>
                    {s}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-sm text-gray-400">{filteredCompanies.length} companies</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Company</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden sm:table-cell">Industry</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Status</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden md:table-cell">Contacts</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Deal Value</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Owner</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 hidden md:table-cell">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map(company => {
                    const contacts = crmContacts.filter(c => c.companyId === company.id)
                    return (
                      <tr key={company.id} onClick={() => setSelectedCompany(company)}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: '#015035' }}>
                              {company.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                              <p className="text-xs text-gray-400 hidden sm:block">{company.hq}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell">
                          <span className="text-sm text-gray-600">{company.industry}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${companyStatusColors[company.status]}`}>
                            {company.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            {contacts.slice(0, 3).map(c => (
                              <div key={c.id} className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 -ml-1 first:ml-0 border border-white"
                                title={c.fullName}>
                                {c.firstName[0]}{c.lastName[0]}
                              </div>
                            ))}
                            {contacts.length > 3 && <span className="text-xs text-gray-400 ml-1">+{contacts.length - 3}</span>}
                          </div>
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <span className="text-sm font-semibold" style={{ color: '#015035' }}>
                            {formatCurrency(company.totalDealValue)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <span className="text-sm text-gray-600">{company.owner.split(' ')[0]}</span>
                        </td>
                        <td className="py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-400">
                            {company.lastActivity
                              ? new Date(company.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredCompanies.length === 0 && (
                <div className="text-center py-12">
                  <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No companies match your search.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CONTACTS TAB ── */}
        {activeTab === 'contacts' && (
          <>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs">
                <Search size={13} className="text-gray-400" />
                <input
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
                />
              </div>
              <span className="ml-auto text-sm text-gray-400">{filteredContacts.length} contacts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4">Name</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden sm:table-cell">Company</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden md:table-cell">Title</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Email</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">Owner</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 hidden md:table-cell">Last Activity</th>
                    <th className="text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => (
                    <tr key={contact.id} onClick={() => setSelectedContact(contact)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: '#015035' }}>
                            {contact.firstName[0]}{contact.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{contact.fullName}</p>
                            {contact.isPrimary && <span className="text-[10px] text-emerald-600 font-medium">Primary</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="text-sm text-gray-600">{contact.companyName}</span>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <span className="text-sm text-gray-500">{contact.title}</span>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-500">{contact.email}</span>
                      </td>
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-500">{contact.owner.split(' ')[0]}</span>
                      </td>
                      <td className="py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-400">
                          {contact.lastActivity
                            ? new Date(contact.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </span>
                      </td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
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
                  ))}
                </tbody>
              </table>
              {filteredContacts.length === 0 && (
                <div className="text-center py-12">
                  <Users size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No contacts match your search.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <>
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => setActivityTypeFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${activityTypeFilter === 'all' ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  style={activityTypeFilter === 'all' ? { background: '#015035' } : {}}>
                  All ({crmActivities.length})
                </button>
                {(Object.keys(activityConfig) as ActivityType[]).map(type => {
                  const count = crmActivities.filter(a => a.type === type).length
                  if (count === 0) return null
                  return (
                    <button key={type} onClick={() => setActivityTypeFilter(type)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors capitalize ${activityTypeFilter === type ? 'text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                      style={activityTypeFilter === type ? { background: activityConfig[type].color } : {}}>
                      {activityConfig[type].label} ({count})
                    </button>
                  )
                })}
              </div>
              <button className="ml-auto flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                <Plus size={14} /> Log Activity
              </button>
            </div>
            <div className="max-w-2xl">
              <ActivityTimeline activities={filteredActivities} />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {selectedDeal && <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
      {selectedCompany && <CompanyModal company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
      {selectedContact && <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />}
    </>
  )
}
