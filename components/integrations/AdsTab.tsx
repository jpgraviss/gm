'use client'

import { useCallback, useEffect, useState } from 'react'
import { DollarSign, MousePointerClick, Eye, Target, Loader2 } from 'lucide-react'

interface Campaign {
  name: string
  status: string
  cost: number
  clicks: number
  impressions: number
  conversions: number
}

interface AdReport {
  summary: {
    totalCost: number
    impressions: number
    clicks: number
    conversions: number
    ctr: number
    cpc: number
    roas: number
  }
  campaigns: Campaign[]
}

interface Props {
  adsCustomerId?: string
  metaAdAccountId?: string
  days?: number
}

const DATE_RANGES = [7, 14, 28, 90] as const

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtNum = (v: number) =>
  new Intl.NumberFormat('en-US').format(v)
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`
const fmtRoas = (v: number) => `${v.toFixed(1)}x`

const statusColor: Record<string, string> = {
  ENABLED: 'bg-emerald-100 text-emerald-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PAUSED: 'bg-amber-100 text-amber-800',
  REMOVED: 'bg-red-100 text-red-800',
}

function PlatformIcon({ platform }: { platform: 'google' | 'meta' }) {
  if (platform === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09A6.69 6.69 0 0 1 5.5 12c0-.72.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" fill="none">
      <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.79-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953h-1.513c-1.49 0-1.956.926-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.384C19.612 22.954 24 17.99 24 12z" fill="#1877F2" />
    </svg>
  )
}

function SummaryRow({ report }: { report: AdReport }) {
  const { summary: s } = report
  const stats = [
    { label: 'Spend', value: fmtCurrency(s.totalCost), icon: DollarSign },
    { label: 'Clicks', value: fmtNum(s.clicks), icon: MousePointerClick },
    { label: 'Impressions', value: fmtNum(s.impressions), icon: Eye },
    { label: 'CTR', value: fmtPct(s.ctr), icon: Target },
    { label: 'CPC', value: fmtCurrency(s.cpc), icon: DollarSign },
    { label: 'Conv.', value: fmtNum(s.conversions), icon: Target },
    { label: 'ROAS', value: fmtRoas(s.roas), icon: DollarSign },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((st) => (
        <div key={st.label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{st.label}</p>
          <p className="text-sm font-bold text-gray-900">{st.value}</p>
        </div>
      ))}
    </div>
  )
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  const rows = campaigns.slice(0, 10)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <th className="py-2 pr-2">Campaign</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-2 text-right">Spend</th>
            <th className="py-2 pr-2 text-right">Clicks</th>
            <th className="py-2 text-right">Conv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name} className="border-b border-gray-50">
              <td className="py-1.5 pr-2 font-medium text-gray-800 truncate max-w-[160px]">{c.name}</td>
              <td className="py-1.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {c.status}
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right text-gray-700">{fmtCurrency(c.cost)}</td>
              <td className="py-1.5 pr-2 text-right text-gray-700">{fmtNum(c.clicks)}</td>
              <td className="py-1.5 text-right text-gray-700">{fmtNum(c.conversions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlatformCard({ label, platform, report, loading }: {
  label: string
  platform: 'google' | 'meta'
  report: AdReport | null
  loading: boolean
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PlatformIcon platform={platform} />
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : report ? (
        <>
          <SummaryRow report={report} />
          {report.campaigns.length > 0 && <CampaignTable campaigns={report.campaigns} />}
        </>
      ) : (
        <p className="text-xs text-gray-400 py-4 text-center">Failed to load data</p>
      )}
    </div>
  )
}

export default function AdsTab({ adsCustomerId, metaAdAccountId, days: defaultDays }: Props) {
  const [days, setDays] = useState(defaultDays ?? 28)
  const [googleReport, setGoogleReport] = useState<AdReport | null>(null)
  const [metaReport, setMetaReport] = useState<AdReport | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)

  const hasGoogle = !!adsCustomerId
  const hasMeta = !!metaAdAccountId

  const fetchReports = useCallback(() => {
    if (hasGoogle) {
      setGoogleLoading(true)
      fetch(`/api/integrations/ads/report?customerId=${encodeURIComponent(adsCustomerId!)}&days=${days}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setGoogleReport(d))
        .catch(() => setGoogleReport(null))
        .finally(() => setGoogleLoading(false))
    }
    if (hasMeta) {
      setMetaLoading(true)
      fetch(`/api/integrations/meta/report?adAccountId=${encodeURIComponent(metaAdAccountId!)}&days=${days}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setMetaReport(d))
        .catch(() => setMetaReport(null))
        .finally(() => setMetaLoading(false))
    }
  }, [adsCustomerId, metaAdAccountId, days, hasGoogle, hasMeta])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchReports() }, [fetchReports])

  if (!hasGoogle && !hasMeta) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-400">No ad accounts configured</p>
      </div>
    )
  }

  const singleColumn = (hasGoogle && !hasMeta) || (!hasGoogle && hasMeta)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        {DATE_RANGES.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              days === d
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className={`flex gap-4 ${singleColumn ? '' : 'flex-col md:flex-row'}`}>
        {hasGoogle && (
          <PlatformCard label="Google Ads" platform="google" report={googleReport} loading={googleLoading} />
        )}
        {hasMeta && (
          <PlatformCard label="Meta Ads" platform="meta" report={metaReport} loading={metaLoading} />
        )}
      </div>
    </div>
  )
}
