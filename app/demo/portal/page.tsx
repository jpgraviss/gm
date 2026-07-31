import type { Metadata } from 'next'
import {
  TrendingUp, DollarSign, MessageSquare, CheckCircle2, ArrowUpRight, Clock,
} from 'lucide-react'
import DemoPageHeader from '../DemoPageHeader'
import { PORTAL_CLIENT } from '../data'

export const metadata: Metadata = { title: 'Client Portal — GravHub Demo' }

const TICKET_COLORS: Record<string, string> = {
  Open: 'bg-amber-50 text-amber-700',
  Resolved: 'bg-[#e6f0ec] text-[#015035]',
}

export default function DemoPortalPage() {
  const c = PORTAL_CLIENT
  const maxTrend = Math.max(...c.seoTrend)

  return (
    <div>
      <DemoPageHeader title={`Welcome back, ${c.name}`} subtitle="Sample data — this is what a client sees" />
      <div className="p-6 sm:p-10 grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp size={13} className="text-[#015035]" />
            <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide">SEO Score</p>
          </div>
          <p className="text-2xl font-bold text-[#012A1C]">{c.seoScore}</p>
          <p className="text-[10.5px] text-[#015035] font-medium flex items-center gap-0.5 mb-3">
            <ArrowUpRight size={11} /> +{c.seoScoreDelta} this month
          </p>
          <div className="flex items-end gap-1 h-10">
            {c.seoTrend.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-[#015035]" style={{ height: `${(v / maxTrend) * 100}%`, opacity: 0.4 + (i / c.seoTrend.length) * 0.6 }} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign size={13} className="text-[#CC7853]" />
            <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide">Next Invoice</p>
          </div>
          <p className="text-2xl font-bold text-[#012A1C]">{c.invoice.amount}</p>
          <p className="text-[10.5px] text-[#1B211D]/50 mb-4">Due {c.invoice.due}</p>
          <button className="w-full bg-[#015035] text-white text-[11px] font-semibold py-2.5 rounded-lg">Pay Now</button>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-3">Active Services</p>
          <div className="flex flex-col gap-2">
            {c.services.map(s => (
              <div key={s} className="flex items-center gap-2 text-[11.5px] text-[#1B211D]/80">
                <CheckCircle2 size={13} className="text-[#015035] flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-black/5">
          <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-3">Support Tickets</p>
          <div className="flex flex-col gap-2.5">
            {c.tickets.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-[#F7F5F2] rounded-xl p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#e6f0ec] flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={13} className="text-[#015035]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-[#012A1C] truncate">#{t.id} — {t.subject}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2 ${TICKET_COLORS[t.status]}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-black/5">
          <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-3">Recent Activity</p>
          <div className="flex flex-col gap-3">
            {c.activity.map(a => (
              <div key={a.text} className="flex items-start gap-2">
                <Clock size={12} className="text-[#1B211D]/30 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-[#1B211D]/80 leading-snug">{a.text}</p>
                  <p className="text-[9.5px] text-[#1B211D]/35">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-black/5">
          <p className="text-[10px] font-bold text-[#1B211D]/50 uppercase tracking-wide mb-3">Pending Your Approval</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {c.approvals.map(a => (
              <div key={a.label} className="flex items-center justify-between bg-[#F7F5F2] rounded-xl p-3.5">
                <p className="text-[11.5px] font-semibold text-[#012A1C] pr-3">{a.label}</p>
                <button className="bg-[#015035] text-white text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0">
                  <CheckCircle2 size={11} /> Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
