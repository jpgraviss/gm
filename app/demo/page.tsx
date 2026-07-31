import Link from 'next/link'
import { Users, ScrollText, Monitor, BarChart3, ArrowRight } from 'lucide-react'

const SECTIONS = [
  {
    href: '/demo/pipeline',
    icon: Users,
    title: 'Pipeline & CRM',
    body: 'Every deal, staged and valued, with companies and contacts behind each one.',
  },
  {
    href: '/demo/proposals',
    icon: ScrollText,
    title: 'Proposals & Contracts',
    body: 'What a proposal looks like when it goes out — and what happens after it is sent.',
  },
  {
    href: '/demo/portal',
    icon: Monitor,
    title: 'Client Portal',
    body: 'The branded space a client logs into — their SEO progress, invoice, and approvals.',
  },
  {
    href: '/demo/reporting',
    icon: BarChart3,
    title: 'Reporting',
    body: 'Pipeline, revenue, and win-rate, computed from the same records the team works in.',
  },
]

export default function DemoOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#CC7853] mb-4">
        GravHub Demo
      </p>
      <h1
        className="text-3xl sm:text-4xl font-bold text-[#012A1C] leading-tight"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Walk through GravHub.
      </h1>
      <p className="mt-5 text-[#1B211D]/70 max-w-xl leading-relaxed">
        Pipeline, proposals, the client portal, and reporting — pick a section below to see
        it in action.
      </p>

      <div className="mt-12 grid sm:grid-cols-2 gap-4">
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="group bg-white rounded-2xl p-6 border border-black/5 hover:border-[#015035]/25 hover:shadow-[0_12px_30px_-15px_rgba(1,42,28,0.25)] transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-xl bg-[#015035]/10 flex items-center justify-center mb-5">
              <s.icon size={20} className="text-[#015035]" />
            </div>
            <h3 className="font-bold text-[#012A1C] mb-2 flex items-center gap-1.5">
              {s.title}
              <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-[#CC7853]" />
            </h3>
            <p className="text-sm text-[#1B211D]/65 leading-relaxed">{s.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
