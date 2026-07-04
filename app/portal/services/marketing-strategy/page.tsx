'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Lightbulb, Target, TrendingUp, Calendar,
  CheckCircle, Circle, BarChart3, Flag, Compass,
} from 'lucide-react'

interface KPI {
  name: string
  current: number
  target: number
  unit: string
}

interface Goal {
  id: string
  title: string
  status: string
  quarter: string
  progress: number
}

interface StrategyData {
  overview: string
  kpis: KPI[]
  goals: Goal[]
  lastUpdated: string
}

const DEFAULT_DATA: StrategyData = {
  overview: '',
  kpis: [],
  goals: [],
  lastUpdated: new Date().toISOString().split('T')[0],
}

export default function PortalMarketingStrategyPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<StrategyData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/seo?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const strategyConfig = d?.strategy?.marketing_strategy ?? null
        if (strategyConfig) setData({ ...DEFAULT_DATA, ...strategyConfig })
      })
      .catch(() => toast('Failed to load strategy data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#4f46e5' }} />
      </div>
    )
  }

  const completedGoals = data.goals.filter(g => g.status === 'Completed').length

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Marketing Strategy</h1>
            <p className="text-xs text-gray-500 mt-0.5">Strategic overview, quarterly goals, and KPI tracking</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar size={12} />
            Last Updated: {new Date(data.lastUpdated + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active KPIs', value: data.kpis.length.toString(), icon: BarChart3, color: '#4f46e5' },
            { label: 'Quarterly Goals', value: data.goals.length.toString(), icon: Target, color: '#015035' },
            { label: 'Goals Achieved', value: completedGoals.toString(), icon: CheckCircle, color: '#059669' },
            { label: 'Strategy Score', value: data.goals.length > 0 ? `${Math.round((completedGoals / data.goals.length) * 100)}%` : '—', icon: TrendingUp, color: '#ea580c' },
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

        {data.overview && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Compass size={14} style={{ color: '#4f46e5' }} />
              <h3 className="text-sm font-semibold text-gray-800">Strategy Overview</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{data.overview}</p>
          </div>
        )}

        {data.kpis.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Key Performance Indicators</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.kpis.map((kpi, i) => {
                const pct = kpi.target > 0 ? Math.min(100, (kpi.current / kpi.target) * 100) : 0
                return (
                  <div key={i} className="p-4 rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800">{kpi.name}</p>
                      <p className="text-xs font-semibold" style={{ color: '#4f46e5' }}>
                        {kpi.current.toLocaleString()}{kpi.unit} / {kpi.target.toLocaleString()}{kpi.unit}
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : '#4f46e5' }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{Math.round(pct)}% of target</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {data.goals.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Quarterly Goals</h3>
            <div className="flex flex-col gap-3">
              {data.goals.map(g => (
                <div key={g.id} className={`flex items-center gap-3 p-3 rounded-xl ${g.status === 'Completed' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                  {g.status === 'Completed' ? (
                    <CheckCircle size={16} style={{ color: '#015035' }} />
                  ) : (
                    <Circle size={16} className="text-gray-300" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${g.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'}`}>
                      {g.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{g.quarter}</span>
                      {g.progress > 0 && g.progress < 100 && (
                        <span className="text-[10px] text-gray-400">{g.progress}% complete</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.kpis.length === 0 && data.goals.length === 0 && !data.overview && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <Lightbulb size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Strategy details coming soon</p>
            <p className="text-xs text-gray-400 mt-1">Your marketing strategy overview will appear here once configured.</p>
          </div>
        )}
      </div>
    </div>
  )
}
