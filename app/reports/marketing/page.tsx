'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { Wand2, Loader2, X } from 'lucide-react'

type DateRange = '30D' | '90D' | '12M' | 'Custom'

interface Broadcast {
  id: string
  name: string
  subject: string
  status: string
  sentAt?: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalUnsubscribed: number
  createdAt: string
}

interface FormEntry {
  id: string
  formId: string
  formName?: string
  createdAt?: string
}

interface FormDef {
  id: string
  name: string
  totalSubmissions?: number
  totalViews?: number
}

export default function MarketingAnalyticsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('90D')
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [forms, setForms] = useState<FormDef[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/broadcasts').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/forms').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
    ]).then(([b, f]) => {
      if (Array.isArray(b)) setBroadcasts(b)
      if (Array.isArray(f)) setForms(f)
    }).catch(() => toast('Failed to load marketing data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const sentBroadcasts = useMemo(() => {
    let cutoffISO: string
    let endISO: string
    if (dateRange === 'Custom') {
      cutoffISO = customStart || '1970-01-01'
      endISO = customEnd ? customEnd + 'T23:59:59.999Z' : new Date().toISOString()
    } else {
      const now = new Date()
      const cutoff = new Date(now)
      if (dateRange === '30D') cutoff.setDate(cutoff.getDate() - 30)
      else if (dateRange === '90D') cutoff.setDate(cutoff.getDate() - 90)
      else cutoff.setFullYear(cutoff.getFullYear() - 1)
      cutoffISO = cutoff.toISOString()
      endISO = now.toISOString()
    }

    return broadcasts
      .filter(b => b.status === 'sent' || b.totalSent > 0)
      .filter(b => {
        const date = b.sentAt || b.createdAt
        return !date || (date >= cutoffISO && date <= endISO)
      })
  }, [broadcasts, dateRange, customStart, customEnd])

  const totals = useMemo(() => {
    const sent = sentBroadcasts.reduce((s, b) => s + b.totalSent, 0)
    const opened = sentBroadcasts.reduce((s, b) => s + b.totalOpened, 0)
    const clicked = sentBroadcasts.reduce((s, b) => s + b.totalClicked, 0)
    const bounced = sentBroadcasts.reduce((s, b) => s + b.totalBounced, 0)
    const unsubs = sentBroadcasts.reduce((s, b) => s + b.totalUnsubscribed, 0)
    return { sent, opened, clicked, bounced, unsubs }
  }, [sentBroadcasts])

  const openRate = totals.sent > 0 ? Math.round((totals.opened / totals.sent) * 100) : 0
  const clickRate = totals.sent > 0 ? Math.round((totals.clicked / totals.sent) * 100) : 0
  const bounceRate = totals.sent > 0 ? Math.round((totals.bounced / totals.sent) * 100) : 0

  const topBroadcasts = useMemo(() => {
    return [...sentBroadcasts]
      .sort((a, b) => b.totalOpened - a.totalOpened)
      .slice(0, 10)
  }, [sentBroadcasts])

  const monthlyPerformance = useMemo(() => {
    const months: Record<string, { sent: number; opened: number; clicked: number }> = {}
    sentBroadcasts.forEach(b => {
      const date = b.sentAt || b.createdAt
      if (!date) return
      const month = new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!months[month]) months[month] = { sent: 0, opened: 0, clicked: 0 }
      months[month].sent += b.totalSent
      months[month].opened += b.totalOpened
      months[month].clicked += b.totalClicked
    })
    return Object.entries(months)
      .map(([month, data]) => ({ month, ...data }))
      .slice(-8)
  }, [sentBroadcasts])

  const maxMonthlySent = Math.max(...monthlyPerformance.map(m => m.sent), 1)

  const formStats = useMemo(() => {
    return forms.map(f => {
      const views = f.totalViews ?? 0
      const submissions = f.totalSubmissions ?? 0
      const convRate = views > 0 ? Math.round((submissions / views) * 100) : 0
      return { ...f, views, submissions, convRate }
    }).sort((a, b) => b.submissions - a.submissions)
  }, [forms])

  const totalFormSubmissions = formStats.reduce((s, f) => s + f.submissions, 0)

  const [aiNarrative, setAiNarrative] = useState<string | null>(null)
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Marketing Analytics" subtitle="Broadcast performance, form conversions, and funnel metrics" />
      <div className="page-content">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period:</span>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {(['30D', '90D', '12M', 'Custom'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${dateRange === r ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ background: dateRange === r ? '#015035' : undefined }}
              >
                {r}
              </button>
            ))}
          </div>
          {dateRange === 'Custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Emails Sent', value: totals.sent.toLocaleString(), color: '#015035' },
            { label: 'Open Rate', value: `${openRate}%`, color: '#3b82f6' },
            { label: 'Click Rate', value: `${clickRate}%`, color: '#22c55e' },
            { label: 'Bounce Rate', value: `${bounceRate}%`, color: '#ef4444' },
            { label: 'Form Submissions', value: totalFormSubmissions.toLocaleString(), color: '#8b5cf6' },
          ].map(m => (
            <div key={m.label} className="kpi-card">
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: m.color }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div className="metric-card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">AI Narrative</h3>
            <button
              disabled={aiNarrativeLoading}
              onClick={async () => {
                setAiNarrativeLoading(true)
                try {
                  const res = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'report_summary',
                      context: {
                        company: 'all clients',
                        period: dateRange === '30D' ? 'last 30 days' : dateRange === '90D' ? 'last 90 days' : 'last 12 months',
                        metrics: `Emails sent: ${totals.sent}, Open rate: ${openRate}%, Click rate: ${clickRate}%, Bounce rate: ${bounceRate}%, Form submissions: ${totalFormSubmissions}`,
                        highlights: `${sentBroadcasts.length} campaigns sent, ${forms.length} active forms`,
                      },
                    }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setAiNarrative(data.content)
                  }
                } catch { /* ignore */ }
                setAiNarrativeLoading(false)
              }}
              className="flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-40"
            >
              {aiNarrativeLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Generate Narrative
            </button>
          </div>
          {aiNarrative ? (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg relative">
              <button onClick={() => setAiNarrative(null)} className="absolute top-2 right-2 text-purple-400 hover:text-purple-600"><X size={12} /></button>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{aiNarrative}</pre>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Click &quot;Generate Narrative&quot; to create an AI-written summary of your marketing performance.</p>
          )}
        </div>

        <div className="metric-card mb-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Broadcast Performance Over Time</h3>
          {monthlyPerformance.length > 0 ? (
            <div className="flex items-end gap-3 h-36">
              {monthlyPerformance.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-medium">{m.sent.toLocaleString()}</span>
                  <div className="w-full flex flex-col">
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: `${(m.sent / maxMonthlySent) * 100}px`, background: '#015035' }}
                    />
                    <div
                      className="w-full"
                      style={{ height: `${(m.opened / maxMonthlySent) * 100}px`, background: '#3b82f6', borderRadius: '0 0 3px 3px' }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-8">No broadcast data available yet</p>
          )}
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#015035' }} /><span className="text-[10px] text-gray-500">Sent</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#3b82f6' }} /><span className="text-[10px] text-gray-500">Opened</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Top Performing Broadcasts</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Broadcast</th>
                    <th className="text-right pb-2 font-semibold">Sent</th>
                    <th className="text-right pb-2 font-semibold">Opens</th>
                    <th className="text-right pb-2 font-semibold">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {topBroadcasts.map(b => {
                    const or = b.totalSent > 0 ? Math.round((b.totalOpened / b.totalSent) * 100) : 0
                    return (
                      <tr key={b.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-sm text-gray-800 font-medium max-w-[200px] truncate">{b.name || b.subject}</td>
                        <td className="py-2 text-sm text-right text-gray-600">{b.totalSent.toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <span className="text-sm font-semibold" style={{ color: '#015035' }}>{or}%</span>
                        </td>
                        <td className="py-2 text-sm text-right font-semibold text-blue-600">{b.totalClicked}</td>
                      </tr>
                    )
                  })}
                  {topBroadcasts.length === 0 && (
                    <tr><td colSpan={4} className="text-xs text-gray-400 text-center py-4">No broadcasts sent yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Form Conversion Rates</h3>
            <div className="flex flex-col gap-3">
              {formStats.slice(0, 8).map(f => (
                <div key={f.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-700 font-medium truncate max-w-[180px]">{f.name}</span>
                    <span className="text-xs font-bold text-gray-800">{f.submissions} submissions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(f.convRate, 100)}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{f.convRate}%</span>
                  </div>
                </div>
              ))}
              {formStats.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No forms created yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Funnel Performance Summary</h3>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {[
              { label: 'Sent', value: totals.sent, color: '#015035' },
              { label: 'Delivered', value: totals.sent - totals.bounced, color: '#3b82f6' },
              { label: 'Opened', value: totals.opened, color: '#8b5cf6' },
              { label: 'Clicked', value: totals.clicked, color: '#22c55e' },
            ].map((step, idx, arr) => (
              <div key={step.label} className="flex items-center gap-2 flex-1 min-w-[100px]">
                <div className="flex-1 text-center">
                  <p className="text-xl font-bold text-gray-900">{step.value.toLocaleString()}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: step.color }}>{step.label}</p>
                  {idx > 0 && arr[idx - 1].value > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{Math.round((step.value / arr[idx - 1].value) * 100)}% of prev</p>
                  )}
                </div>
                {idx < arr.length - 1 && (
                  <div className="text-gray-300 flex-shrink-0">&rarr;</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
