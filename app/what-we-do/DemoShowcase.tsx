'use client'

import { useState } from 'react'
import {
  Users, DollarSign, FileText, FolderKanban, BarChart3, Settings,
  Search, Bell, Download, MessageSquare,
  TrendingUp, CheckCircle2, ArrowUpRight,
} from 'lucide-react'

// ─── Fake demo data — no real client names, no real numbers, no real code.
// Everything below exists purely to illustrate what the screens look like.

const PIPELINE_COLUMNS = [
  {
    name: 'Prospect',
    color: '#8C8478',
    deals: [
      { company: 'Anchor Outdoor', value: '$4,200/mo', initials: 'AO' },
      { company: 'Wayfinder Coffee', value: '$1,900/mo', initials: 'WC' },
    ],
  },
  {
    name: 'Proposal Sent',
    color: '#CC7853',
    deals: [
      { company: 'Riverside Dental', value: '$2,800/mo', initials: 'RD' },
      { company: 'Blue Ridge Auto', value: '$5,400/mo', initials: 'BA' },
    ],
  },
  {
    name: 'Negotiation',
    color: '#01673f',
    deals: [
      { company: 'Meridian HVAC', value: '$6,500/mo', initials: 'MH' },
    ],
  },
  {
    name: 'Closed Won',
    color: '#015035',
    deals: [
      { company: 'Palmetto Realty', value: '$3,100/mo', initials: 'PR' },
    ],
  },
]

const PROPOSAL_LINE_ITEMS = [
  { name: 'Website Redesign', detail: 'One-time build, 6-page site', price: '$3,500' },
  { name: 'SEO Management', detail: 'Ongoing optimization & reporting', price: '$1,800/mo' },
  { name: 'Content & Local SEO', detail: 'Blog + Google Business Profile', price: '$700/mo' },
]

const REVENUE_TREND = [62, 68, 71, 79, 84, 91]
const FUNNEL = [
  { stage: 'Prospect', count: 22 },
  { stage: 'Qualified', count: 14 },
  { stage: 'Proposal', count: 9 },
  { stage: 'Negotiation', count: 5 },
  { stage: 'Closed Won', count: 3 },
]

const TABS = [
  { key: 'pipeline', label: 'Pipeline & CRM' },
  { key: 'proposal', label: 'Proposals & Contracts' },
  { key: 'portal', label: 'Client Portal' },
  { key: 'reporting', label: 'Reporting' },
] as const

type TabKey = typeof TABS[number]['key']

const TAB_CAPTIONS: Record<TabKey, string> = {
  pipeline: 'Every deal, staged and valued, with the full activity history behind it — no separate spreadsheet tracking what a CRM record can’t.',
  proposal: 'A proposal goes out as a branded document with real line items. Accepted becomes signed becomes a contract — one record, not three.',
  portal: 'What the client sees when they log in: real SEO progress, an invoice they can pay, and work waiting on their approval.',
  reporting: 'Pipeline, revenue, and win-rate — computed from the same records the team is already working in, not a separately maintained deck.',
}

function DeviceFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_20px_60px_-15px_rgba(1,42,28,0.35)] ring-1 ring-black/5 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#F7F5F2] border-b border-black/5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e5675a]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#e6b45a]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#5cb87a]" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[10px] text-[#1B211D]/40 bg-white rounded-full px-3 py-1 border border-black/5">
            {url}
          </span>
        </div>
      </div>
      <div className="flex bg-white">
        <div className="hidden sm:flex flex-col items-center gap-4 w-12 py-4 bg-[#012A1C] flex-shrink-0">
          <div className="w-6 h-6 rounded-md bg-[#CC7853]/90 flex items-center justify-center text-white text-[9px] font-bold">
            G
          </div>
          <div className="flex flex-col gap-3.5 mt-2 text-white/50">
            <BarChart3 size={14} className="text-white" />
            <Users size={14} />
            <FileText size={14} />
            <FolderKanban size={14} />
            <Settings size={14} />
          </div>
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-black/5">
      <h4 className="text-sm font-bold text-[#012A1C]">{title}</h4>
      <div className="flex items-center gap-3 text-[#1B211D]/30">
        <Search size={13} />
        <Bell size={13} />
        <div className="w-6 h-6 rounded-full bg-[#e6f0ec] flex items-center justify-center text-[9px] font-bold text-[#015035]">
          JG
        </div>
      </div>
    </div>
  )
}

function PipelineMockup() {
  return (
    <DeviceFrame url="app.gravissmarketing.com/crm/pipeline">
      <TopBar title="Pipeline" />
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PIPELINE_COLUMNS.map(col => (
          <div key={col.name} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
              <span className="text-[10px] font-bold text-[#1B211D]/60 uppercase tracking-wide">{col.name}</span>
            </div>
            {col.deals.map(deal => (
              <div key={deal.company} className="bg-[#F7F5F2] rounded-lg p-2.5 border border-black/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#015035] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                    {deal.initials}
                  </div>
                  <p className="text-[10.5px] font-semibold text-[#012A1C] leading-tight truncate flex-1 min-w-0">{deal.company}</p>
                </div>
                <p className="text-[10px] font-medium text-[#015035]">{deal.value}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DeviceFrame>
  )
}

function ProposalMockup() {
  return (
    <DeviceFrame url="app.gravissmarketing.com/proposals/view">
      <TopBar title="Proposal" />
      <div className="p-5">
        <div className="bg-[#F7F5F2] rounded-xl p-5 border border-black/5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold tracking-[0.15em] text-[#CC7853] uppercase mb-1">Proposal</p>
              <h5 className="text-sm font-bold text-[#012A1C]">Meridian HVAC — Website + SEO</h5>
            </div>
            <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-[#e6f0ec] text-[#015035]">Awaiting Signature</span>
          </div>
          <div className="flex flex-col gap-2.5 mb-4">
            {PROPOSAL_LINE_ITEMS.map(item => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                <div>
                  <p className="text-[11px] font-semibold text-[#1B211D]">{item.name}</p>
                  <p className="text-[9.5px] text-[#1B211D]/50">{item.detail}</p>
                </div>
                <p className="text-[11px] font-bold text-[#012A1C]">{item.price}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[#1B211D]/50">Estimated monthly</p>
            <p className="text-sm font-bold text-[#015035]">$2,500/mo</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-4">
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#015035] text-white text-[11px] font-semibold py-2.5 rounded-lg">
            <CheckCircle2 size={13} /> Sign &amp; Accept
          </button>
          <button className="flex items-center justify-center gap-1.5 bg-white border border-black/10 text-[#1B211D]/60 text-[11px] font-semibold py-2.5 px-3.5 rounded-lg">
            <Download size={13} />
          </button>
        </div>
      </div>
    </DeviceFrame>
  )
}

function PortalMockup() {
  return (
    <DeviceFrame url="app.gravissmarketing.com/client">
      <TopBar title="Welcome back, Palmetto Realty" />
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-[#015035]" />
            <p className="text-[9.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide">SEO Score</p>
          </div>
          <p className="text-xl font-bold text-[#012A1C]">72</p>
          <p className="text-[9.5px] text-[#015035] font-medium flex items-center gap-0.5"><ArrowUpRight size={10} /> +9 this month</p>
        </div>
        <div className="bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={12} className="text-[#CC7853]" />
            <p className="text-[9.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide">Next Invoice</p>
          </div>
          <p className="text-xl font-bold text-[#012A1C]">$3,100</p>
          <p className="text-[9.5px] text-[#1B211D]/50">Due Aug 15</p>
        </div>
        <div className="col-span-2 bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#e6f0ec] flex items-center justify-center">
              <MessageSquare size={13} className="text-[#015035]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#012A1C]">Support ticket #482</p>
              <p className="text-[9.5px] text-[#1B211D]/50">“Question about GBP reviews”</p>
            </div>
          </div>
          <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">Open</span>
        </div>
        <div className="col-span-2 bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5 flex items-center justify-between">
          <div>
            <p className="text-[9.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide mb-1">Pending Your Approval</p>
            <p className="text-[11px] font-semibold text-[#012A1C]">Instagram post — “Fall Listings”</p>
          </div>
          <button className="bg-[#015035] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
            <CheckCircle2 size={11} /> Approve
          </button>
        </div>
      </div>
    </DeviceFrame>
  )
}

function ReportingMockup() {
  const max = Math.max(...REVENUE_TREND)
  const maxFunnel = Math.max(...FUNNEL.map(f => f.count))
  return (
    <DeviceFrame url="app.gravissmarketing.com/reports">
      <TopBar title="Revenue & Pipeline" />
      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-1">
        {[
          { label: 'MRR', value: '$184.5k', delta: '+6.2%' },
          { label: 'Win Rate', value: '38%', delta: '+3pt' },
          { label: 'Avg Deal', value: '$3,850', delta: '+4.1%' },
          { label: 'Active Clients', value: '47', delta: '+2' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#F7F5F2] rounded-lg p-2.5 border border-black/5">
            <p className="text-[9px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-sm font-bold text-[#012A1C]">{kpi.value}</p>
            <p className="text-[9px] text-[#015035] font-medium">{kpi.delta}</p>
          </div>
        ))}
      </div>
      <div className="p-4 pt-1 grid sm:grid-cols-2 gap-3">
        <div className="bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5">
          <p className="text-[9.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide mb-3">Revenue Trend</p>
          <div className="flex items-end gap-2 h-16">
            {REVENUE_TREND.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-[#015035]" style={{ height: `${(v / max) * 100}%`, opacity: 0.5 + (i / REVENUE_TREND.length) * 0.5 }} />
            ))}
          </div>
        </div>
        <div className="bg-[#F7F5F2] rounded-xl p-3.5 border border-black/5">
          <p className="text-[9.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide mb-3">Pipeline Funnel</p>
          <div className="flex flex-col gap-1.5">
            {FUNNEL.map(f => (
              <div key={f.stage} className="flex items-center gap-2">
                <span className="text-[9px] text-[#1B211D]/50 w-16 flex-shrink-0">{f.stage}</span>
                <div className="flex-1 h-2.5 rounded-full bg-white overflow-hidden">
                  <div className="h-full rounded-full bg-[#CC7853]" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                </div>
                <span className="text-[9px] font-semibold text-[#012A1C] w-4 text-right flex-shrink-0">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DeviceFrame>
  )
}

const MOCKUPS: Record<TabKey, () => React.ReactElement> = {
  pipeline: PipelineMockup,
  proposal: ProposalMockup,
  portal: PortalMockup,
  reporting: ReportingMockup,
}

export function HeroMockup() {
  return (
    <div className="hidden lg:block">
      <PipelineMockup />
    </div>
  )
}

export default function DemoShowcase() {
  const [active, setActive] = useState<TabKey>('pipeline')
  const Mockup = MOCKUPS[active]

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
              active === tab.key
                ? 'bg-[#015035] text-white border-[#015035]'
                : 'bg-white text-[#1B211D]/60 border-black/10 hover:border-[#015035]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Mockup />
      <p className="text-center text-sm text-[#1B211D]/55 max-w-xl mx-auto mt-6 leading-relaxed">
        {TAB_CAPTIONS[active]}
      </p>
      <p className="text-center text-[10px] text-[#1B211D]/35 mt-3">
        Illustrative screens with sample data — shown to demonstrate the product, not real client information.
      </p>
    </div>
  )
}
