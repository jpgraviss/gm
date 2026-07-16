'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Search, Globe,
  Link2, BarChart3, Calendar, CheckCircle, Circle,
} from 'lucide-react'

interface KeywordRanking {
  keyword: string
  currentRank: number
  previousRank: number
}

interface Deliverable {
  name: string
  completed: boolean
}

interface SeoStrategy {
  lastUpdated: string
  overview: string
  keywords: KeywordRanking[]
  deliverables: Deliverable[]
  organicTraffic: number
  keywordsRanking: number
  domainAuthority: number
  backlinks: number
  monthlyTraffic: number[]
  monthlyLabels: string[]
}

function RankChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const diff = previous - current
  if (diff > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
        <TrendingUp size={12} /> +{diff}
      </span>
    )
  }
  if (diff < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
        <TrendingDown size={12} /> {diff}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-400">
      <Minus size={12} /> 0
    </span>
  )
}

const DEFAULT_STRATEGY: SeoStrategy = {
  lastUpdated: new Date().toISOString().split('T')[0],
  overview: 'Your SEO strategy is being prepared. Check back soon for updates.',
  keywords: [],
  deliverables: [],
  organicTraffic: 0,
  keywordsRanking: 0,
  domainAuthority: 0,
  backlinks: 0,
  monthlyTraffic: [],
  monthlyLabels: [],
}

export default function PortalSeoPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [strategy, setStrategy] = useState<SeoStrategy>(DEFAULT_STRATEGY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/seo?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.strategy) {
          setStrategy({ ...DEFAULT_STRATEGY, ...data.strategy })
        }
      })
      .catch(() => toast('Failed to load SEO data', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  const maxTraffic = useMemo(
    () => Math.max(...(strategy.monthlyTraffic.length > 0 ? strategy.monthlyTraffic : [1])),
    [strategy.monthlyTraffic],
  )

  const completedDeliverables = strategy.deliverables.filter(d => d.completed).length
  const totalDeliverables = strategy.deliverables.length

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">SEO Strategy</h1>
            <p className="text-xs text-gray-500 mt-0.5">Monthly overview and performance metrics</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar size={12} />
            Last Updated: {strategy.lastUpdated ? new Date(strategy.lastUpdated + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        {strategy.overview && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Monthly Strategy Overview</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{strategy.overview}</p>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Organic Traffic', value: strategy.organicTraffic.toLocaleString(), icon: Globe, color: '#015035' },
            { label: 'Keywords Ranking', value: strategy.keywordsRanking.toLocaleString(), icon: Search, color: '#2563eb' },
            { label: 'Domain Authority', value: strategy.domainAuthority.toString(), icon: BarChart3, color: '#7c3aed' },
            { label: 'Backlinks', value: strategy.backlinks.toLocaleString(), icon: Link2, color: '#ea580c' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                    <Icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>

        {strategy.keywords.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Keyword Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2.5 px-5 font-semibold">Keyword</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Current</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Previous</th>
                    <th className="text-center py-2.5 px-4 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.keywords.map((kw, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-5 text-sm font-medium text-gray-800">{kw.keyword}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold" style={{ background: '#e6f0ec', color: '#015035' }}>
                          {kw.currentRank}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">{kw.previousRank}</td>
                      <td className="py-3 px-4 text-center">
                        <RankChangeIndicator current={kw.currentRank} previous={kw.previousRank} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {strategy.deliverables.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Monthly Deliverables</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#e6f0ec', color: '#015035' }}>
                {completedDeliverables}/{totalDeliverables} Complete
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: totalDeliverables > 0 ? `${(completedDeliverables / totalDeliverables) * 100}%` : '0%',
                  background: '#015035',
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              {strategy.deliverables.map((d, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${d.completed ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                  {d.completed ? (
                    <CheckCircle size={16} style={{ color: '#015035' }} />
                  ) : (
                    <Circle size={16} className="text-gray-300" />
                  )}
                  <span className={`text-sm ${d.completed ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'}`}>
                    {d.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {strategy.monthlyTraffic.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Organic Traffic Trend</h3>
            <div className="flex items-end gap-2 h-48">
              {strategy.monthlyTraffic.map((val, i) => {
                const height = maxTraffic > 0 ? (val / maxTraffic) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500 font-medium">{val.toLocaleString()}</span>
                    <div className="w-full flex items-end" style={{ height: '160px' }}>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{ height: `${height}%`, background: '#015035', minHeight: val > 0 ? '4px' : '0px' }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{strategy.monthlyLabels[i] ?? ''}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
