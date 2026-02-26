'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { deals } from '@/lib/data'
import { formatCurrency, stageColors, serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Deal, DealStage } from '@/lib/types'
import {
  X, Phone, Mail, Calendar, TrendingUp, DollarSign,
  FileText, ScrollText, User, Building2, ChevronDown,
} from 'lucide-react'

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
        <span
          className="text-base font-bold"
          style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}
        >
          {formatCurrency(deal.value)}
        </span>
        <div className="flex items-center gap-1">
          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${deal.probability}%`, background: '#015035' }}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">{deal.probability}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-400">
          <Calendar size={11} />
          <span className="text-[11px]">{new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge label={deal.stage} colorClass={stageColors[deal.stage]} />
              <StatusBadge label={deal.serviceType} colorClass={serviceTypeColors[deal.serviceType]} />
            </div>
            <h2
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
            >
              {deal.company}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">{deal.contact.title} — {deal.contact.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(['overview', 'activity', 'tasks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize ${tab === t ? 'active' : ''}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Left col */}
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deal Info</p>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-gray-400" />
                      <div>
                        <p className="text-[11px] text-gray-400">Value</p>
                        <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{formatCurrency(deal.value)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <div>
                        <p className="text-[11px] text-gray-400">Close Date</p>
                        <p className="text-sm font-medium text-gray-800">{new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-gray-400" />
                      <div>
                        <p className="text-[11px] text-gray-400">Probability</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: '#015035' }} />
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{deal.probability}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <div>
                        <p className="text-[11px] text-gray-400">Assigned Rep</p>
                        <p className="text-sm font-medium text-gray-800">{deal.assignedRep}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
                  <ul className="flex flex-col gap-1.5">
                    {deal.notes.map((note, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-gray-400 flex-shrink-0">·</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right col */}
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-800 font-medium">{deal.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{deal.contact.name} — {deal.contact.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{deal.contact.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{deal.contact.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Related</p>
                  <div className="flex flex-col gap-2">
                    <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                      <FileText size={14} />
                      View Proposals
                    </button>
                    <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700">
                      <ScrollText size={14} />
                      View Contracts
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stage Actions</p>
                  <div className="flex flex-col gap-2">
                    <button className="flex items-center justify-between text-sm font-medium text-white px-3 py-2 rounded-lg transition-opacity hover:opacity-90" style={{ background: '#015035' }}>
                      Advance Stage
                      <ChevronDown size={14} />
                    </button>
                    <button className="text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                      Log Activity
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="flex flex-col gap-3">
              {[
                { icon: <Mail size={14} />, text: 'Proposal sent via email', time: '2 days ago', color: '#f59e0b' },
                { icon: <Phone size={14} />, text: 'Discovery call — 45 minutes', time: '5 days ago', color: '#3b82f6' },
                { icon: <User size={14} />, text: 'Deal created', time: '1 week ago', color: '#015035' },
              ].map((a, i) => (
                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18`, color: a.color }}>
                    {a.icon}
                  </div>
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

export default function CRMPage() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [filterRep, setFilterRep] = useState('All')

  const filtered = filterRep === 'All' ? deals : deals.filter(d => d.assignedRep === filterRep)
  const reps = ['All', ...Array.from(new Set(deals.map(d => d.assignedRep)))]

  return (
    <>
      <Header title="CRM & Pipeline" subtitle="Track deals from lead to close" action={{ label: 'New Deal' }} />
      <div className="p-6 flex-1">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          {reps.map(rep => (
            <button
              key={rep}
              onClick={() => setFilterRep(rep)}
              className={`tab-btn ${filterRep === rep ? 'active' : ''}`}
            >
              {rep}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{filtered.length}</span> deals ·
            <span className="font-semibold" style={{ color: '#015035' }}>{formatCurrency(filtered.reduce((s, d) => s + d.value, 0))}</span>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageDeal = filtered.filter(d => d.stage === stage)
            const stageTotal = stageDeal.reduce((s, d) => s + d.value, 0)
            return (
              <div key={stage} className="kanban-col" style={{ minWidth: 220 }}>
                {/* Column Header */}
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
                    <span className="text-[11px] text-gray-400 font-medium">{formatCurrency(stageTotal)}</span>
                  )}
                </div>

                {/* Cards */}
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

      {/* Deal Modal */}
      {selectedDeal && <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </>
  )
}
