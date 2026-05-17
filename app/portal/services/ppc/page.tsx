'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, DollarSign, MousePointer, Target, TrendingUp,
  BarChart3, Calendar, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'

interface Campaign {
  name: string
  status: string
  spend: number
  clicks: number
  impressions: number
  conversions: number
  cpa: number
  ctr: number
}

interface PpcData {
  totalSpend: number
  totalClicks: number
  totalConversions: number
  avgCpa: number
  avgCtr: number
  campaigns: Campaign[]
  lastUpdated: string
}

const DEFAULT_DATA: PpcData = {
  totalSpend: 0,
  totalClicks: 0,
  totalConversions: 0,
  avgCpa: 0,
  avgCtr: 0,
  campaigns: [],
  lastUpdated: new Date().toISOString().split('T')[0],
}

export default function PortalPpcPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<PpcData>(DEFAULT_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/seo?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const ppcConfig = d?.strategy?.ppc ?? d?.ppc ?? null
        if (ppcConfig) setData({ ...DEFAULT_DATA, ...ppcConfig })
      })
      .catch(() => toast('Failed to load PPC data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#2563eb' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">PPC Advertising</h1>
            <p className="text-xs text-gray-500 mt-0.5">Campaign performance and spend overview</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar size={12} />
            Last Updated: {new Date(data.lastUpdated + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Spend', value: `$${data.totalSpend.toLocaleString()}`, icon: DollarSign, color: '#2563eb' },
            { label: 'Clicks', value: data.totalClicks.toLocaleString(), icon: MousePointer, color: '#015035' },
            { label: 'Conversions', value: data.totalConversions.toLocaleString(), icon: Target, color: '#7c3aed' },
            { label: 'Avg. CPA', value: `$${data.avgCpa.toFixed(2)}`, icon: TrendingUp, color: '#ea580c' },
            { label: 'Avg. CTR', value: `${(data.avgCtr * 100).toFixed(1)}%`, icon: BarChart3, color: '#0891b2' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                    <Icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Campaigns</h3>
          </div>
          {data.campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2.5 px-5 font-semibold">Campaign</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Status</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Spend</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Clicks</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Conv.</th>
                    <th className="text-right py-2.5 px-3 font-semibold">CPA</th>
                    <th className="text-right py-2.5 px-4 font-semibold">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-5 text-sm font-medium text-gray-800">{c.name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                          c.status === 'Paused' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-gray-700">${c.spend.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-sm text-gray-700">{c.clicks.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-sm font-semibold" style={{ color: '#015035' }}>{c.conversions}</td>
                      <td className="py-3 px-3 text-right text-sm text-gray-700">${c.cpa.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-700">{(c.ctr * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Target size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Campaign data will appear here once available.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
