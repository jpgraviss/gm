import type { Metadata } from 'next'
import DemoPageHeader from '../DemoPageHeader'
import { PIPELINE_STAGES, DEALS } from '../data'

export const metadata: Metadata = { title: 'Pipeline — GravHub Demo' }

function formatMoney(n: number) {
  return `$${n.toLocaleString()}/mo`
}

export default function DemoPipelinePage() {
  return (
    <div>
      <DemoPageHeader title="Pipeline" />
      <div className="p-6 sm:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map(stage => {
            const deals = DEALS.filter(d => d.stage === stage.key)
            const total = deals.reduce((sum, d) => sum + d.value, 0)
            return (
              <div key={stage.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }} />
                    <span className="text-[10.5px] font-bold text-[#1B211D]/60 uppercase tracking-wide">{stage.name}</span>
                  </div>
                  <span className="text-[10px] text-[#1B211D]/35 font-medium">{deals.length}</span>
                </div>
                <p className="text-xs font-semibold text-[#015035] px-1 -mt-1.5">
                  ${(total).toLocaleString()}/mo
                </p>
                <div className="flex flex-col gap-2.5">
                  {deals.map(deal => (
                    <div key={deal.company} className="bg-white rounded-xl p-3.5 border border-black/5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-[#015035] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {deal.initials}
                        </div>
                        <p className="text-[11.5px] font-semibold text-[#012A1C] leading-tight flex-1 min-w-0 truncate">{deal.company}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10.5px] font-medium text-[#015035]">{formatMoney(deal.value)}</p>
                        <p className="text-[9.5px] text-[#1B211D]/35">{deal.lastActivity}</p>
                      </div>
                    </div>
                  ))}
                  {deals.length === 0 && (
                    <div className="rounded-xl border border-dashed border-black/10 p-4 text-center">
                      <p className="text-[10px] text-[#1B211D]/30">No deals</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
