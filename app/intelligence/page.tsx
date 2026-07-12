'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Radar, Search, Flame, Building2, Users, Globe, Phone, Mail,
  ExternalLink, ChevronRight, RefreshCw, Eye, MousePointerClick,
  ArrowUpDown, Clock, TrendingUp, Code, Copy, CheckCircle,
  UserPlus, Zap, Filter, BarChart3, Target,
} from 'lucide-react'

interface Person {
  id: string
  email: string
  businessEmail: string | null
  personalEmail: string | null
  firstName: string
  lastName: string
  title: string | null
  company: string | null
  phone: string | null
  profileImageUrl: string | null
  trafficType: string | null
  adPlatform: string | null
  isHotLead: boolean
  visitCount: number
}

interface MavEvent {
  id: string
  eventType: string
  url: string
  timestamp: string
}

interface Stats {
  totalPeople: number
  totalCompanies: number
  recentEvents: number
}

interface Company {
  id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  visitorCount: number
}

interface GiVisitor {
  visitor_id: string
  email: string | null
  name: string | null
  phone: string | null
  company: string | null
  ip_address: string | null
  city: string | null
  region: string | null
  country: string | null
  rdns_company: string | null
  first_seen: string
  last_seen: string
  visit_count: number
  is_hot_lead: boolean
  lead_score: number
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

interface GiEvent {
  id: number
  event_type: string
  url: string | null
  path: string | null
  title: string | null
  time_on_page: number | null
  scroll_depth: number | null
  timestamp: string
}

const FOREST = '#015035'
const TERRACOTTA = '#CC7853'

function trafficBadge(type: string | null) {
  const colors: Record<string, string> = {
    organic: 'bg-emerald-100 text-emerald-700',
    paid: 'bg-blue-100 text-blue-700',
    direct: 'bg-gray-100 text-gray-600',
    referral: 'bg-purple-100 text-purple-700',
  }
  return colors[type ?? ''] ?? 'bg-gray-100 text-gray-600'
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function IntelligencePage() {
  const { toast } = useToast()
  const [source, setSource] = useState<'maverick' | 'gravintel' | 'setup'>('maverick')
  const [tab, setTab] = useState<'visitors' | 'companies'>('visitors')
  const [people, setPeople] = useState<Person[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'hot' | 'organic' | 'paid' | 'direct' | 'referral'>('all')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [personEvents, setPersonEvents] = useState<MavEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sortKey, setSortKey] = useState<'name' | 'company' | 'visits' | 'traffic'>('visits')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [giVisitors, setGiVisitors] = useState<GiVisitor[]>([])
  const [giTotal, setGiTotal] = useState(0)
  const [giSelected, setGiSelected] = useState<GiVisitor | null>(null)
  const [giEvents, setGiEvents] = useState<GiEvent[]>([])
  const [giEventsLoading, setGiEventsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        fetch('/api/intelligence/visitors?limit=100'),
        fetch('/api/intelligence/companies?limit=100'),
        fetch('/api/intelligence/stats'),
      ])
      const pData = await pRes.json()
      const cData = await cRes.json()
      const sData = await sRes.json()
      if (pData.data) setPeople(pData.data)
      if (cData.data) setCompanies(cData.data)
      if (sData.data) setStats(sData.data)
      if (pData.error) toast(pData.error, 'error')
    } catch { toast('Failed to load intelligence data', 'error') }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  const fetchGiData = useCallback(async () => {
    try {
      const res = await fetch(`/api/intelligence/identify?limit=100&search=${encodeURIComponent(search)}`)
      const data = await res.json()
      if (data.data) { setGiVisitors(data.data); setGiTotal(data.total ?? 0) }
    } catch { /* no self-hosted data yet is normal */ }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (source === 'gravintel') fetchGiData() }, [source, fetchGiData])

  async function loadGiEvents(visitor: GiVisitor) {
    setGiSelected(visitor)
    setGiEventsLoading(true)
    try {
      const res = await fetch(`/api/intelligence/identify?visitor_id=${visitor.visitor_id}`)
      const data = await res.json()
      setGiEvents(data.events ?? [])
    } catch { setGiEvents([]) }
    finally { setGiEventsLoading(false) }
  }

  async function loadEvents(person: Person) {
    setSelectedPerson(person)
    setEventsLoading(true)
    try {
      const res = await fetch(`/api/intelligence/visitors?id=${person.id}&events=1&limit=50`)
      const data = await res.json()
      setPersonEvents(data.data ?? [])
    } catch { setPersonEvents([]) }
    finally { setEventsLoading(false) }
  }

  // Filter counts
  const hotCount = people.filter(p => p.isHotLead).length
  const organicCount = people.filter(p => p.trafficType === 'organic').length
  const paidCount = people.filter(p => p.trafficType === 'paid').length
  const directCount = people.filter(p => p.trafficType === 'direct').length
  const referralCount = people.filter(p => p.trafficType === 'referral').length

  const filtered = people
    .filter(p => {
      if (filter === 'hot') return p.isHotLead
      if (filter !== 'all') return p.trafficType === filter
      return true
    })
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        (p.company ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      if (sortKey === 'company') return dir * (a.company ?? '').localeCompare(b.company ?? '')
      if (sortKey === 'visits') return dir * (a.visitCount - b.visitCount)
      if (sortKey === 'traffic') return dir * (a.trafficType ?? '').localeCompare(b.trafficType ?? '')
      return 0
    })

  const hotLeads = people.filter(p => p.isHotLead).sort((a, b) => b.visitCount - a.visitCount).slice(0, 5)

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header title="Intelligence" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: FOREST }}>
              <Radar size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                Intelligence
              </h1>
              <p className="text-xs text-gray-500">Website visitor identification & lead intelligence</p>
            </div>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchData() }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: FOREST }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-5 w-fit">
          {([
            ['maverick', 'Maverick Data', Zap],
            ['gravintel', 'GravIntel (Self-Hosted)', Target],
            ['setup', 'Setup & Embed', Code],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSource(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${source === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Setup Tab */}
        {source === 'setup' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
              Tracking Script Setup
            </h3>
            <p className="text-xs text-gray-500 mb-5">Add this script to any website to start tracking visitors. When someone clicks an email link with a tracking parameter or submits a form, they become identified.</p>

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Embed Code</label>
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
{`<!-- GravIntel Tracking -->
<script src="https://app.gravissmarketing.com/api/intelligence/script?site=your-site-id" defer></script>`}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`<script src="https://app.gravissmarketing.com/api/intelligence/script?site=your-site-id" defer></script>`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700 text-gray-300 text-[10px] hover:bg-gray-600"
                >
                  {copied ? <><CheckCircle size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Email Click-Through Identification</label>
              <p className="text-xs text-gray-500 mb-2">When sending emails from GravHub, append this parameter to any link to identify the visitor:</p>
              <pre className="bg-gray-50 border border-gray-200 text-xs p-3 rounded-lg font-mono text-gray-700">
{`https://yoursite.com/page?_gi_eid=recipient@email.com`}
              </pre>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Manual Identification (JavaScript)</label>
              <pre className="bg-gray-50 border border-gray-200 text-xs p-3 rounded-lg font-mono text-gray-700">
{`// Identify a visitor after form fill or login
GravIntel.identify('user@email.com', { name: 'Jane Doe' });

// Track custom events
GravIntel.track('pricing_viewed', { plan: 'premium' });`}
              </pre>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-800 mb-1">How identification works</h4>
              <ul className="text-[11px] text-emerald-700 space-y-1">
                <li>1. Script assigns each visitor a persistent cookie ID</li>
                <li>2. All page views, clicks, and scrolls are tracked under that ID</li>
                <li>3. When they click an email link with <code className="bg-emerald-100 px-1 rounded">_gi_eid</code>, their cookie is permanently tied to their email</li>
                <li>4. Form submissions with email fields auto-identify the visitor</li>
                <li>5. All past anonymous activity is retroactively linked to their profile</li>
                <li>6. Lead scoring auto-calculates based on visit frequency and engagement</li>
              </ul>
            </div>
          </div>
        )}

        {/* GravIntel Self-Hosted View */}
        {source === 'gravintel' && (
          <div className="flex gap-4">
            <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search visitors..." className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-green-700" />
                </div>
                <span className="text-[11px] text-gray-400">{giTotal} visitors tracked</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-2.5 px-4 font-semibold">Visitor</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Visits</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Score</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Source</th>
                      <th className="text-left py-2.5 px-4 font-semibold">Last Seen</th>
                      <th className="py-2.5 px-4 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {giVisitors.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                        No visitors tracked yet. Add the tracking script to your website to start collecting data.
                      </td></tr>
                    ) : giVisitors.map(v => (
                      <tr key={v.visitor_id} onClick={() => loadGiEvents(v)} className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${giSelected?.visitor_id === v.visitor_id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: v.email ? FOREST : '#9ca3af' }}>
                              {v.name ? v.name[0].toUpperCase() : v.email ? v.email[0].toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{v.name ?? v.email ?? <span className="text-gray-400">Anonymous</span>}</p>
                              {v.email && v.name && <p className="text-[10px] text-gray-400">{v.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{v.company ?? v.rdns_company ?? '—'}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{v.visit_count}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(v.lead_score, 100)}%`, background: v.lead_score >= 60 ? '#ef4444' : v.lead_score >= 30 ? TERRACOTTA : FOREST }} />
                            </div>
                            <span className="text-[10px] text-gray-500">{v.lead_score}</span>
                            {v.is_hot_lead && <Flame size={10} className="text-orange-500" />}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {v.utm_source ? (
                            <span className="text-[10px] font-medium text-gray-600">{v.utm_source}{v.utm_medium ? ` / ${v.utm_medium}` : ''}</span>
                          ) : <span className="text-[10px] text-gray-400">direct</span>}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-gray-500">{timeAgo(v.last_seen)}</td>
                        <td className="py-3 px-4"><ChevronRight size={14} className="text-gray-300" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {giSelected && (
              <div className="w-[320px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden hidden lg:block">
                <div className="p-4 border-b border-gray-100" style={{ background: '#f8faf9' }}>
                  <h3 className="text-sm font-bold text-gray-900">{giSelected.name ?? giSelected.email ?? 'Anonymous Visitor'}</h3>
                  {giSelected.email && <p className="text-xs text-gray-500">{giSelected.email}</p>}
                  {giSelected.company && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={10} /> {giSelected.company}</p>}
                  {giSelected.city ? (
                    <p className="text-[10px] text-gray-400 mt-1">{[giSelected.city, giSelected.region, giSelected.country].filter(Boolean).join(', ')}</p>
                  ) : (
                    <p className="text-[10px] text-gray-300 mt-1 italic">Location not configured</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{giSelected.visit_count} visits</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Score: {giSelected.lead_score}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Activity</h4>
                  {giEventsLoading ? (
                    <div className="flex justify-center py-6"><RefreshCw size={14} className="animate-spin text-gray-400" /></div>
                  ) : giEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No events</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
                      {giEvents.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                          <div className="mt-0.5">
                            {ev.event_type === 'page_view' ? <Eye size={11} className="text-blue-500" />
                              : ev.event_type === 'page_leave' ? <Clock size={11} className="text-gray-400" />
                              : ev.event_type === 'form_submit' ? <Mail size={11} className="text-emerald-500" />
                              : <MousePointerClick size={11} className="text-purple-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-gray-700 truncate">{ev.path ?? ev.url}</p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span>{timeAgo(ev.timestamp)}</span>
                              {ev.time_on_page != null && <span>{ev.time_on_page}s</span>}
                              {ev.scroll_depth != null && <span>{ev.scroll_depth}% scroll</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {source === 'maverick' && <>
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-100">
                  <Users size={16} className="text-emerald-700" />
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Identified Visitors</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPeople.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100">
                  <Building2 size={16} className="text-blue-700" />
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Companies</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFF3EA' }}>
                  <TrendingUp size={16} style={{ color: TERRACOTTA }} />
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Events (30d)</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.recentEvents.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100">
                  <Flame size={16} className="text-orange-600" />
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Hot Leads</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{hotCount}</p>
            </div>
          </div>
        )}

        {/* Hot Leads Spotlight */}
        {hotLeads.length > 0 && filter !== 'hot' && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} className="text-orange-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Hot Leads</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {hotLeads.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadEvents(p)}
                  className="flex-shrink-0 w-48 bg-white rounded-xl border border-orange-100 p-3 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {p.profileImageUrl ? (
                      <img src={p.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: FOREST }}>
                        {p.firstName?.[0]}{p.lastName?.[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                      {p.title && <p className="text-[10px] text-gray-400 truncate">{p.title}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">{p.company ?? '—'}</span>
                    <span className="text-[10px] font-medium text-orange-600">{p.visitCount} visits</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs + Search + Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['visitors', 'companies'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'visitors' ? <><Users size={12} /> Visitors</> : <><Building2 size={12} /> Companies</>}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === 'visitors' ? 'Search visitors...' : 'Search companies...'}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-green-700"
            />
          </div>
          {tab === 'visitors' && (
            <div className="flex gap-1 flex-wrap">
              {([
                ['all', 'All', people.length],
                ['hot', 'Hot Leads', hotCount],
                ['organic', 'Organic', organicCount],
                ['paid', 'Paid', paidCount],
                ['direct', 'Direct', directCount],
                ['referral', 'Referral', referralCount],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${filter === key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={filter === key ? { background: FOREST } : {}}
                >
                  {key === 'hot' && <Flame size={10} className={`${filter === key ? 'text-white' : ''}`} />}
                  {label}
                  <span className={`text-[9px] ${filter === key ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Main Table */}
            <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${selectedPerson ? 'flex-1' : 'w-full'}`}>
              {tab === 'visitors' ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                        {([
                          ['name', 'Visitor'],
                          ['company', 'Company'],
                          ['visits', 'Visits'],
                          ['traffic', 'Source'],
                        ] as const).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="text-left py-2.5 px-4 font-semibold cursor-pointer hover:text-gray-600 select-none"
                          >
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : <ArrowUpDown size={10} className="text-gray-300" />}
                            </span>
                          </th>
                        ))}
                        <th className="text-left py-2.5 px-4 font-semibold">Contact</th>
                        <th className="py-2.5 px-4 font-semibold w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No visitors found</td></tr>
                      ) : filtered.map(p => (
                        <tr
                          key={p.id}
                          onClick={() => loadEvents(p)}
                          className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${selectedPerson?.id === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {p.profileImageUrl ? (
                                <img src={p.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: FOREST }}>
                                  {p.firstName?.[0]}{p.lastName?.[0]}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                                  {p.isHotLead && <Flame size={12} className="text-orange-500" />}
                                </div>
                                {p.title && <p className="text-[11px] text-gray-400">{p.title}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-700">{p.company ?? '—'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900">{p.visitCount}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${trafficBadge(p.trafficType)}`}>
                              {p.trafficType ?? 'unknown'}
                            </span>
                            {p.adPlatform && <span className="text-[10px] text-gray-400 ml-1">({p.adPlatform})</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {p.businessEmail && (
                                <a href={`mailto:${p.businessEmail}`} onClick={e => e.stopPropagation()} title={p.businessEmail}>
                                  <Mail size={13} className="text-gray-400 hover:text-gray-700" />
                                </a>
                              )}
                              {p.phone && (
                                <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} title={p.phone}>
                                  <Phone size={13} className="text-gray-400 hover:text-gray-700" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <ChevronRight size={14} className="text-gray-300" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
                    Showing {filtered.length} of {people.length} visitors
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Industry</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Size</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Visitors</th>
                        <th className="text-left py-2.5 px-4 font-semibold">Domain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies
                        .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                        .map(c => (
                          <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold flex-shrink-0">
                                  {c.name[0]}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">{c.industry ?? '—'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{c.size ?? '—'}</td>
                            <td className="py-3 px-4">
                              <span className="text-sm font-medium text-gray-900">{c.visitorCount}</span>
                            </td>
                            <td className="py-3 px-4">
                              {c.domain ? (
                                <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                  {c.domain} <ExternalLink size={10} />
                                </a>
                              ) : <span className="text-sm text-gray-400">—</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
                    {companies.length} companies
                  </div>
                </div>
              )}
            </div>

            {/* Person Detail Sidebar */}
            {selectedPerson && (
              <div className="w-[340px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden hidden lg:block">
                <div className="p-5 border-b border-gray-100" style={{ background: '#f8faf9' }}>
                  <div className="flex items-center gap-3 mb-3">
                    {selectedPerson.profileImageUrl ? (
                      <img src={selectedPerson.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: FOREST }}>
                        {selectedPerson.firstName?.[0]}{selectedPerson.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-gray-900">{selectedPerson.firstName} {selectedPerson.lastName}</h3>
                        {selectedPerson.isHotLead && <Flame size={13} className="text-orange-500" />}
                      </div>
                      {selectedPerson.title && <p className="text-xs text-gray-500">{selectedPerson.title}</p>}
                      {selectedPerson.company && <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 size={10} /> {selectedPerson.company}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${trafficBadge(selectedPerson.trafficType)}`}>
                      {selectedPerson.trafficType ?? 'unknown'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      <Eye size={9} /> {selectedPerson.visitCount} visits
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex gap-2">
                  {selectedPerson.businessEmail && (
                    <a
                      href={`mailto:${selectedPerson.businessEmail}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <Mail size={11} /> Email
                    </a>
                  )}
                  {selectedPerson.phone && (
                    <a
                      href={`tel:${selectedPerson.phone}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <Phone size={11} /> Call
                    </a>
                  )}
                  <a
                    href={`/crm?search=${encodeURIComponent(selectedPerson.email || `${selectedPerson.firstName} ${selectedPerson.lastName}`)}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-medium hover:bg-gray-200"
                  >
                    <UserPlus size={11} /> CRM
                  </a>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Contact Info</h4>
                  <div className="flex flex-col gap-1.5">
                    {selectedPerson.businessEmail && (
                      <div className="flex items-center gap-2 text-xs text-gray-700 group">
                        <Mail size={12} className="text-gray-400" />
                        <span className="flex-1 truncate">{selectedPerson.businessEmail}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(selectedPerson.businessEmail!); toast('Copied', 'success') }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Copy size={10} className="text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>
                    )}
                    {selectedPerson.personalEmail && selectedPerson.personalEmail !== selectedPerson.businessEmail && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 group">
                        <Mail size={12} className="text-gray-300" />
                        <span className="flex-1 truncate">{selectedPerson.personalEmail}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(selectedPerson.personalEmail!); toast('Copied', 'success') }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Copy size={10} className="text-gray-400 hover:text-gray-600" />
                        </button>
                      </div>
                    )}
                    {selectedPerson.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-700">
                        <Phone size={12} className="text-gray-400" /> {selectedPerson.phone}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Activity Timeline</h4>
                  {eventsLoading ? (
                    <div className="flex justify-center py-6"><RefreshCw size={14} className="animate-spin text-gray-400" /></div>
                  ) : personEvents.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No events found</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                      {personEvents.map(ev => (
                        <div key={ev.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                          <div className="mt-0.5">
                            {ev.eventType === 'page_view' ? <Eye size={12} className="text-blue-500" />
                              : ev.eventType === 'click' ? <MousePointerClick size={12} className="text-purple-500" />
                              : <Globe size={12} className="text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-gray-700 truncate">{ev.url}</p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock size={9} /> {timeAgo(ev.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </>}
      </div>
    </div>
  )
}
