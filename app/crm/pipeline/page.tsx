'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import { deals, crmCompanies, crmContacts, contracts, crmActivities } from '@/lib/data'
import { formatCurrency, stageColors, serviceTypeColors, contractStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Deal, DealStage, CRMActivity, ActivityType } from '@/lib/types'
import {
  X, Phone, Mail, Calendar, TrendingUp, DollarSign,
  FileText, ScrollText, User, Building2, ChevronDown,
  Clock, PhoneCall, MessageSquare, Video, StickyNote,
  CheckSquare, Linkedin, Plus, ExternalLink, ChevronRight,
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

// ─── Pipeline Constants ───────────────────────────────────────────────────────

const stages: DealStage[] = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']

const stageHeaderColors: Record<DealStage, string> = {
  Lead: '#9ca3af',
  Qualified: '#3b82f6',
  'Proposal Sent': '#f59e0b',
  'Contract Sent': '#f97316',
  'Closed Won': '#22c55e',
  'Closed Lost': '#ef4444',
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

// ─── Deal Card ────────────────────────────────────────────────────────────────

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

// ─── Deal Detail Panel ────────────────────────────────────────────────────────

function DealPanel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'activity' | 'tasks'>('overview')

  // Related data
  const company = crmCompanies.find(c => c.name === deal.company)
  const linkedContacts = crmContacts.filter(c => c.companyName === deal.company)
  const linkedContract = contracts.find(c => c.company === deal.company)
  const dealActivities = crmActivities.filter(a => a.companyId === company?.id).slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="w-[540px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <StatusBadge label={deal.stage} colorClass={stageColors[deal.stage]} />
                <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType]} />
              </div>
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                {deal.company}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">{deal.contact.title} — {deal.contact.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Value + probability */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Deal Value</p>
              <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                {formatCurrency(deal.value)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Probability</p>
              <p className="text-base font-bold text-gray-900">{deal.probability}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Close Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0">
          {(['overview', 'activity', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Deal info */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deal Info</p>
                <div className="flex flex-col gap-2.5">
                  <InfoRow icon={<DollarSign size={14} />} label="Value" value={
                    <span className="font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(deal.value)}
                    </span>
                  } />
                  <InfoRow icon={<TrendingUp size={14} />} label="Probability" value={
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: '#015035' }} />
                      </div>
                      <span className="text-sm font-semibold">{deal.probability}%</span>
                    </div>
                  } />
                  <InfoRow icon={<User size={14} />} label="Assigned Rep" value={deal.assignedRep} />
                  <InfoRow icon={<Calendar size={14} />} label="Last Activity" value={deal.lastActivity} />
                </div>
              </div>

              {/* Notes */}
              {deal.notes.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <ul className="flex flex-col gap-1.5">
                    {deal.notes.map((note, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-gray-400">·</span>{note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Contact</p>
                  {company && (
                    <Link href="/crm/contacts" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      All contacts <ChevronRight size={11} />
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                    {deal.contact.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{deal.contact.name}</p>
                    <p className="text-xs text-gray-400">{deal.contact.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`mailto:${deal.contact.email}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Mail size={13} />
                    </a>
                    <a href={`tel:${deal.contact.phone}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Phone size={13} />
                    </a>
                  </div>
                </div>
                {linkedContacts.length > 1 && (
                  <p className="text-xs text-gray-400 mt-2">+{linkedContacts.length - 1} more contacts at this company</p>
                )}
              </div>

              {/* Company summary */}
              {company && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</p>
                    <Link href="/crm/companies" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      View <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {company.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{company.name}</p>
                      <p className="text-xs text-gray-400">{company.industry} · {company.hq}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contract info */}
              {linkedContract && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Contract</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge label={linkedContract.status} colorClass={contractStatusColors[linkedContract.status]} />
                      </div>
                      <p className="text-xs text-gray-500">{linkedContract.billingStructure}</p>
                    </div>
                    <p className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>
                      {formatCurrency(linkedContract.value)}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</p>
                <div className="flex flex-col gap-2">
                  <button className="flex items-center justify-between text-sm font-medium text-white px-3 py-2 rounded-lg hover:opacity-90" style={{ background: '#015035' }}>
                    Advance Stage <ChevronDown size={14} />
                  </button>
                  <button className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
                    Log Activity
                  </button>
                  <Link href="/proposals" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 px-1 py-1">
                    <FileText size={14} /> View Proposals
                  </Link>
                  <Link href="/contracts" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 px-1 py-1">
                    <ScrollText size={14} /> View Contracts
                  </Link>
                </div>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="flex flex-col gap-3">
              {dealActivities.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No activities logged.</p>
              )}
              {dealActivities.map((act, i) => {
                const cfg = activityConfig[act.type]
                return (
                  <div key={act.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{act.title}</p>
                      {act.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{act.body}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(act.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {act.user}
                      </p>
                    </div>
                  </div>
                )
              })}
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
                  <span className={`text-sm flex-1 ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {t.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(t.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
            Advance Stage
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

export default function PipelinePage() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [filterRep, setFilterRep] = useState('All')

  const reps = ['All', ...Array.from(new Set(deals.map(d => d.assignedRep)))]
  const filteredDeals = filterRep === 'All' ? deals : deals.filter(d => d.assignedRep === filterRep)

  const totalPipeline = filteredDeals
    .filter(d => !d.stage.startsWith('Closed'))
    .reduce((s, d) => s + d.value, 0)
  const wonValue = filteredDeals
    .filter(d => d.stage === 'Closed Won')
    .reduce((s, d) => s + d.value, 0)
  const weightedValue = filteredDeals
    .filter(d => !d.stage.startsWith('Closed'))
    .reduce((s, d) => s + (d.value * d.probability) / 100, 0)

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: 'New Deal' }}
      />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Pipeline summary */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Open Pipeline', value: formatCurrency(totalPipeline), sub: `${filteredDeals.filter(d => !d.stage.startsWith('Closed')).length} deals` },
            { label: 'Weighted Value', value: formatCurrency(Math.round(weightedValue)), sub: 'Probability-adjusted' },
            { label: 'Closed Won', value: formatCurrency(wonValue), sub: `${filteredDeals.filter(d => d.stage === 'Closed Won').length} deals` },
          ].map(m => (
            <div key={m.label} className="metric-card flex items-center gap-3">
              <div>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{m.label}</p>
                <p className="text-[11px] text-gray-400">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rep filter */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {reps.map(rep => (
            <button key={rep} onClick={() => setFilterRep(rep)} className={`tab-btn ${filterRep === rep ? 'active' : ''}`}>
              {rep}
            </button>
          ))}
          <div className="ml-auto text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{filteredDeals.length}</span> deals ·{' '}
            <span className="font-semibold" style={{ color: '#015035' }}>
              {formatCurrency(filteredDeals.reduce((s, d) => s + d.value, 0))}
            </span>
          </div>
        </div>

        {/* Kanban */}
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
                    <span
                      className="text-xs font-semibold text-white rounded-full px-1.5 py-0.5 min-w-5 text-center"
                      style={{ background: stageHeaderColors[stage], fontSize: '10px' }}
                    >
                      {stageDeal.length}
                    </span>
                  </div>
                  {stageTotal > 0 && (
                    <span className="text-[11px] text-gray-400">{formatCurrency(stageTotal)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {stageDeal.map(deal => (
                    <DealCard key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />
                  ))}
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
      </div>

      {selectedDeal && <DealPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </>
  )
}
