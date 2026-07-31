import type { Metadata } from 'next'
import DemoPageHeader from '../DemoPageHeader'
import { KPIS, REVENUE_TREND, REVENUE_TREND_MONTHS, FUNNEL, RECENT_WINS, TOP_SOURCES } from '../data'

export const metadata: Metadata = { title: 'Reporting — GravHub Demo' }

export default function DemoReportingPage() {
  const maxTrend = Math.max(...REVENUE_TREND)
  const maxFunnel = Math.max(...FUNNEL.map(f => f.count))
  const maxSource = Math.max(...TOP_SOURCES.map(s => s.pct))

  return (
    <div>
      <DemoPageHeader title="Revenue & Pipeline" subtitle="Sample data — not real revenue figures" />
      <div className="p-6 sm:p-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {KPIS.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-2xl p-4 border border-black/5">
              <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-1.5">{kpi.label}</p>
              <p className="text-xl font-bold text-[#012A1C]">{kpi.value}</p>
              <p className="text-[10.5px] text-[#015035] font-medium">{kpi.delta}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl p-5 border border-black/5">
            <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-4">Revenue Trend</p>
            <div className="flex items-end gap-3 h-28">
              {REVENUE_TREND.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-t-md bg-[#015035]" style={{ height: `${(v / maxTrend) * 88}px`, opacity: 0.45 + (i / REVENUE_TREND.length) * 0.55 }} />
                  <span className="text-[9px] text-[#1B211D]/40">{REVENUE_TREND_MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-black/5">
            <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-4">Pipeline Funnel</p>
            <div className="flex flex-col gap-2.5">
              {FUNNEL.map(f => (
                <div key={f.stage} className="flex items-center gap-3">
                  <span className="text-[10.5px] text-[#1B211D]/55 w-20 flex-shrink-0">{f.stage}</span>
                  <div className="flex-1 h-3 rounded-full bg-[#F7F5F2] overflow-hidden">
                    <div className="h-full rounded-full bg-[#CC7853]" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                  </div>
                  <span className="text-[10.5px] font-semibold text-[#012A1C] w-5 text-right flex-shrink-0">{f.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-black/5">
            <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-4">Recently Won</p>
            <div className="flex flex-col gap-2.5">
              {RECENT_WINS.map(w => (
                <div key={w.company} className="flex items-center justify-between bg-[#F7F5F2] rounded-lg p-3">
                  <p className="text-[11.5px] font-semibold text-[#012A1C]">{w.company}</p>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[#015035]">{w.value}</p>
                    <p className="text-[9.5px] text-[#1B211D]/40">{w.closedDaysAgo}d ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-black/5">
            <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-4">Top Deal Sources</p>
            <div className="flex flex-col gap-2.5">
              {TOP_SOURCES.map(s => (
                <div key={s.source} className="flex items-center gap-3">
                  <span className="text-[10.5px] text-[#1B211D]/55 w-28 flex-shrink-0">{s.source}</span>
                  <div className="flex-1 h-3 rounded-full bg-[#F7F5F2] overflow-hidden">
                    <div className="h-full rounded-full bg-[#015035]" style={{ width: `${(s.pct / maxSource) * 100}%` }} />
                  </div>
                  <span className="text-[10.5px] font-semibold text-[#012A1C] w-8 text-right flex-shrink-0">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
