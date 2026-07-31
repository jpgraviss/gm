import type { Metadata } from 'next'
import { CheckCircle2, Download, Eye, Send } from 'lucide-react'
import DemoPageHeader from '../DemoPageHeader'
import { PROPOSALS } from '../data'

export const metadata: Metadata = { title: 'Proposals — GravHub Demo' }

const STATUS_COLORS: Record<string, string> = {
  Sent: 'bg-[#e6f0ec] text-[#015035]',
  'Awaiting Signature': 'bg-amber-50 text-amber-700',
  Signed: 'bg-[#015035] text-white',
}

export default function DemoProposalsPage() {
  const featured = PROPOSALS[0]
  const others = PROPOSALS.slice(1)

  return (
    <div>
      <DemoPageHeader title="Proposals" />
      <div className="p-6 sm:p-10 grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="flex flex-col gap-2.5">
          <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide px-1 mb-1">All proposals</p>
          {PROPOSALS.map(p => (
            <div
              key={p.id}
              className={`rounded-xl p-3.5 border ${p.id === featured.id ? 'bg-white border-[#015035]/30 shadow-[0_1px_3px_rgba(0,0,0,0.04)]' : 'bg-white/50 border-black/5'}`}
            >
              <p className="text-[11.5px] font-semibold text-[#012A1C] mb-1">{p.company}</p>
              <p className="text-[10px] text-[#1B211D]/50 mb-2">{p.title}</p>
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[9px] font-bold tracking-[0.15em] text-[#CC7853] uppercase mb-1.5">Proposal</p>
              <h2 className="text-lg font-bold text-[#012A1C]">{featured.company} — {featured.title}</h2>
              <div className="flex items-center gap-3 mt-2 text-[10.5px] text-[#1B211D]/45">
                <span className="flex items-center gap-1"><Send size={11} /> Sent {featured.sentDaysAgo}d ago</span>
                {featured.viewedDaysAgo !== null && (
                  <span className="flex items-center gap-1"><Eye size={11} /> Viewed {featured.viewedDaysAgo}d ago</span>
                )}
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[featured.status]}`}>
              {featured.status}
            </span>
          </div>

          <div className="flex flex-col gap-3 mb-5">
            {featured.items.map(item => (
              <div key={item.name} className="flex items-center justify-between py-3 border-b border-black/5 last:border-0">
                <div>
                  <p className="text-[13px] font-semibold text-[#1B211D]">{item.name}</p>
                  <p className="text-[11px] text-[#1B211D]/50">{item.detail}</p>
                </div>
                <p className="text-[13px] font-bold text-[#012A1C]">{item.price}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 mb-6">
            <p className="text-[11px] text-[#1B211D]/50">Estimated monthly</p>
            <p className="text-lg font-bold text-[#015035]">{featured.monthly}</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex-1 flex items-center justify-center gap-1.5 bg-[#015035] text-white text-[12px] font-semibold py-3 rounded-lg">
              <CheckCircle2 size={14} /> Sign &amp; Accept
            </button>
            <button className="flex items-center justify-center gap-1.5 bg-white border border-black/10 text-[#1B211D]/60 text-[12px] font-semibold py-3 px-4 rounded-lg">
              <Download size={14} />
            </button>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="px-6 sm:px-10 pb-10">
          <p className="text-[10.5px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-3">Also in this pipeline</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {others.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 border border-black/5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-semibold text-[#012A1C]">{p.company}</p>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                </div>
                <p className="text-[10.5px] text-[#1B211D]/50">{p.title} — {p.monthly}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
