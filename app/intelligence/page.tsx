'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Radar, Search, Flame, Building2, Users, Globe, Phone, Mail,
  ExternalLink, ChevronRight, RefreshCw, Eye, MousePointerClick,
  ArrowUpDown, Linkedin, Clock, TrendingUp, Filter,
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

  useEffect(() => { fetchData() }, [fetchData])

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
              <p className="text-xs text-gray-500">Website visitor identification powered by Maverick</p>
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100">
                <Users size={18} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPeople.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500">Identified Visitors</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100">
                <Building2 size={18} className="text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500">Companies Detected</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#FFF3EA' }}>
                <TrendingUp size={18} style={{ color: TERRACOTTA }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.recentEvents.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500">Events (30 days)</p>
              </div>
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
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'visitors' ? 'Visitors' : 'Companies'}
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
                ['all', 'All'],
                ['hot', 'Hot Leads'],
                ['organic', 'Organic'],
                ['paid', 'Paid'],
                ['direct', 'Direct'],
                ['referral', 'Referral'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${filter === key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={filter === key ? { background: FOREST } : {}}
                >
                  {key === 'hot' && <Flame size={10} className="inline mr-0.5 mb-0.5" />}
                  {label}
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
                  <div className="flex gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${trafficBadge(selectedPerson.trafficType)}`}>
                      {selectedPerson.trafficType ?? 'unknown'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                      <Eye size={9} /> {selectedPerson.visitCount} visits
                    </span>
                  </div>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Contact Info</h4>
                  <div className="flex flex-col gap-1.5">
                    {selectedPerson.businessEmail && (
                      <a href={`mailto:${selectedPerson.businessEmail}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-blue-600">
                        <Mail size={12} className="text-gray-400" /> {selectedPerson.businessEmail}
                      </a>
                    )}
                    {selectedPerson.personalEmail && selectedPerson.personalEmail !== selectedPerson.businessEmail && (
                      <a href={`mailto:${selectedPerson.personalEmail}`} className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600">
                        <Mail size={12} className="text-gray-300" /> {selectedPerson.personalEmail}
                      </a>
                    )}
                    {selectedPerson.phone && (
                      <a href={`tel:${selectedPerson.phone}`} className="flex items-center gap-2 text-xs text-gray-700 hover:text-blue-600">
                        <Phone size={12} className="text-gray-400" /> {selectedPerson.phone}
                      </a>
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
      </div>
    </div>
  )
}
