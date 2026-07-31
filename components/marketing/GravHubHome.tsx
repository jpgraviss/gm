import Image from 'next/image'
import Link from 'next/link'
import {
  Users, ScrollText, FolderKanban, Clock, Monitor, TrendingUp,
  Zap, BarChart3, Sparkles, ArrowRight, CheckCircle2, Mail,
  LayoutGrid, ShieldCheck, Wrench,
} from 'lucide-react'
import DemoShowcase, { HeroMockup } from './DemoShowcase'

const PILLARS = [
  {
    icon: Users,
    title: 'Sales & CRM',
    body: 'Companies, contacts, and deals in one pipeline. Every call, email, and meeting logged against the account it belongs to — not scattered across inboxes and spreadsheets.',
  },
  {
    icon: ScrollText,
    title: 'Proposals & Contracts',
    body: 'AI-assisted proposal drafting from an intake form straight to a branded PDF, e-signature acceptance, and a contract record that tracks services, value, renewals, and addendums for the life of the account.',
  },
  {
    icon: FolderKanban,
    title: 'Delivery & Projects',
    body: 'A signed contract becomes a real project with tasks and a team assigned — so delivery starts from what was actually sold, not a guess at what the client bought.',
  },
  {
    icon: Clock,
    title: 'Time & Billing',
    body: 'Time tracked against the work, invoices generated from it, and payment collected through Stripe — with bank activity reconciled so finance isn’t chasing numbers across three tools.',
  },
  {
    icon: Monitor,
    title: 'Client Portal',
    body: 'A dedicated, branded space for every client — approve deliverables and social posts, watch SEO progress, pay an invoice, message support. Clients see real data, not a status update someone typed up.',
  },
  {
    icon: TrendingUp,
    title: 'SEO Operations',
    body: 'Rank tracking, site audits, and a purpose-built WordPress plugin that scores on-page SEO, catches broken links, and suggests internal linking — reading real content, including pages built in Elementor.',
  },
  {
    icon: Zap,
    title: 'Marketing Automation',
    body: 'Email sequences, landing-page funnels, forms, and review campaigns that fire off real triggers — a stage change, an inbound form, an overdue invoice — instead of living in a separate tool nobody checks.',
  },
  {
    icon: BarChart3,
    title: 'Reporting',
    body: 'Pipeline, revenue, and delivery reporting that reads from the same records everyone else is working in — so a report reflects what’s actually true today, not a snapshot from whenever someone last updated a deck.',
  },
  {
    icon: Sparkles,
    title: 'AI, where it earns its place',
    body: 'AI drafts the first pass of a proposal, summarizes activity, and surfaces what needs attention — assisting the team using it, not replacing the judgment call at the end.',
  },
]

const LIFECYCLE = [
  'Lead comes in',
  'Proposal goes out',
  'Contract gets signed',
  'Work gets delivered',
  'Invoice gets paid',
  'Renewal comes due',
]

const STAT_STRIP = [
  { icon: LayoutGrid, label: '9 modules, 1 system' },
  { icon: ShieldCheck, label: 'Role-based access, built in' },
  { icon: Wrench, label: 'Built and maintained in-house' },
]

const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'GravHub',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'The operating system for running an agency end to end — pipeline, proposals, delivery, billing, SEO operations, and the client relationship, all in one place.',
  creator: {
    '@type': 'Organization',
    name: 'Graviss Marketing',
    url: 'https://www.gravissmarketing.com',
  },
}

export default function GravHubHome() {
  return (
    <div className="min-h-screen bg-white text-[#1B211D] overflow-x-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#012A1C]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-192.png" alt="GravHub" width={30} height={30} className="rounded-md" />
            <span
              className="text-white text-sm tracking-[0.15em] font-bold"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              GRAVHUB
            </span>
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-white/80 hover:text-white px-3.5 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-colors"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#012A1C] text-white overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-40 w-[36rem] h-[36rem] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #CC7853 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute top-40 -left-40 w-[28rem] h-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #01673f 0%, transparent 70%)' }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28 md:pt-28 md:pb-36">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            <div>
              <p className="text-[#CC7853] text-xs font-bold tracking-[0.2em] uppercase mb-5">
                Built by{' '}
                <a
                  href="https://www.gravissmarketing.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#b8694a] underline decoration-[#CC7853]/30 hover:decoration-[#b8694a] transition-colors"
                >
                  Graviss Marketing
                </a>
              </p>
              <h1
                className="text-4xl md:text-6xl leading-[1.05] font-bold"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                One system to run the whole agency.
              </h1>
              <p className="mt-7 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
                GravHub is the operating system we built for ourselves — pipeline, proposals,
                delivery, billing, SEO operations, and the client relationship, all reading from
                the same set of records instead of a dozen disconnected tools.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href="#showcase"
                  className="inline-flex items-center gap-2 bg-[#CC7853] hover:bg-[#b8694a] text-white text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors"
                >
                  See it in action
                  <ArrowRight size={15} />
                </a>
                <a
                  href="mailto:jonathan@gravissmarketing.com"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white px-2 py-3.5 transition-colors"
                >
                  <Mail size={15} />
                  Ask us about it
                </a>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
                {STAT_STRIP.map(s => (
                  <div key={s.label} className="flex items-center gap-2 text-white/60 text-xs font-medium">
                    <s.icon size={14} className="text-[#CC7853]" />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div
                className="absolute -inset-6 rounded-[2rem] opacity-40 blur-2xl"
                style={{ background: 'radial-gradient(circle, #015035 0%, transparent 75%)' }}
              />
              <div className="relative lg:rotate-[1.5deg] lg:hover:rotate-0 transition-transform duration-500">
                <HeroMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why it exists */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <div>
            <h2
              className="text-2xl md:text-3xl font-bold text-[#012A1C]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Why we built it
            </h2>
            <p className="mt-5 text-[#1B211D]/75 leading-relaxed">
              Most agencies run on a stack of tools that don&apos;t talk to each other — a CRM for
              deals, a separate doc tool for proposals, a project tracker for delivery, a
              spreadsheet for time, an invoicing tool for billing, and a status update for
              whatever the client actually sees. Nothing agrees with anything else, and keeping
              them in sync becomes its own job.
            </p>
            <p className="mt-4 text-[#1B211D]/75 leading-relaxed">
              GravHub replaces that stack with one system where a deal, a proposal, a contract,
              a project, and an invoice are the same underlying record moving through its
              lifecycle — not five separate copies of the truth that someone has to reconcile
              by hand.
            </p>
          </div>
          <div className="bg-[#FFF3EA] rounded-2xl p-8">
            <p className="text-xs font-bold tracking-[0.15em] uppercase text-[#CC7853] mb-6">
              The lifecycle GravHub tracks
            </p>
            <div className="flex flex-col gap-3">
              {LIFECYCLE.map((step, i) => (
                <div key={step} className="flex items-center gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-[#015035] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-[#1B211D]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo showcase */}
      <section id="showcase" className="bg-[#F7F5F2] py-20 md:py-24 scroll-mt-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#CC7853] text-center mb-4">
            See it in action
          </p>
          <h2
            className="text-2xl md:text-3xl font-bold text-[#012A1C] text-center"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            What it actually looks like
          </h2>
          <p className="mt-4 text-[#1B211D]/60 text-center max-w-xl mx-auto">
            Four screens, the real design language of the app.
          </p>
          <div className="mt-12">
            <DemoShowcase />
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section id="what-it-does" className="py-20 md:py-24 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            className="text-2xl md:text-3xl font-bold text-[#012A1C] text-center"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            What&apos;s actually in it
          </h2>
          <p className="mt-4 text-[#1B211D]/60 text-center max-w-xl mx-auto">
            Nine parts of the agency, working off the same data.
          </p>
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PILLARS.map(p => (
              <div
                key={p.title}
                className="bg-white rounded-2xl p-7 border border-black/5 hover:border-[#015035]/25 hover:shadow-[0_12px_30px_-15px_rgba(1,42,28,0.25)] transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-[#015035]/10 flex items-center justify-center mb-5">
                  <p.icon size={20} className="text-[#015035]" />
                </div>
                <h3 className="font-bold text-[#012A1C] mb-2.5">{p.title}</h3>
                <p className="text-sm text-[#1B211D]/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built in-house */}
      <section className="bg-[#F7F5F2] py-20 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 md:gap-16 items-center">
            <div>
              <h2
                className="text-2xl md:text-3xl font-bold text-[#012A1C]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Built in-house, running our own agency on it
              </h2>
              <p className="mt-5 text-[#1B211D]/75 leading-relaxed">
                GravHub isn&apos;t a template we bought and skinned — it&apos;s built for how Graviss
                Marketing actually works, and it changes as that changes. When a workflow doesn&apos;t
                fit, we don&apos;t work around the software. We fix the software.
              </p>
              <p className="mt-4 text-[#1B211D]/75 leading-relaxed">
                That means it&apos;s opinionated in ways an off-the-shelf tool never is: it knows what
                a Graviss proposal looks like, what a Graviss contract tracks, and what a Graviss
                client should see when they log in.
              </p>
            </div>
            <div className="flex flex-col gap-3.5">
              {[
                'One record per deal, from first contact through renewal',
                'A real client portal — not a shared folder or a PDF email',
                'SEO tooling built for how we actually audit and report on sites',
                'Integrates with the tools already in use — Calendar, Drive, Gmail, Stripe',
              ].map(line => (
                <div key={line} className="flex items-start gap-3 bg-white rounded-xl p-4">
                  <CheckCircle2 size={17} className="text-[#015035] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#1B211D]/85 leading-relaxed">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative bg-[#012A1C] overflow-hidden">
        <div
          className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #CC7853 0%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Want to see it running for real?
          </h2>
          <p className="mt-5 text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
            Happy to walk through it live — pipeline to renewal, in the actual app.
          </p>
          <a
            href="mailto:jonathan@gravissmarketing.com"
            className="mt-9 inline-flex items-center gap-2 bg-[#CC7853] hover:bg-[#b8694a] text-white text-sm font-semibold px-7 py-4 rounded-xl transition-colors"
          >
            <Mail size={15} />
            jonathan@gravissmarketing.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#012A1C] text-white/70 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/icon-192.png" alt="GravHub" width={22} height={22} className="rounded-md" />
            <span className="text-xs">
              <span className="text-white font-semibold">GravHub</span> — built by{' '}
              <a
                href="https://www.gravissmarketing.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white underline decoration-white/20 hover:decoration-white/50 transition-colors"
              >
                Graviss Marketing
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
