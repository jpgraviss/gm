import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Home, Compass, LifeBuoy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Page not found — GravHub',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div
      className="relative min-h-screen bg-[#012A1C] text-white flex items-center justify-center px-6 overflow-hidden"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div
        className="pointer-events-none absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #CC7853 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 w-[30rem] h-[30rem] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #01673f 0%, transparent 70%)' }}
      />

      <div className="relative text-center max-w-lg">
        <div className="flex justify-center mb-8">
          <Image src="/icon-192.png" alt="GravHub" width={44} height={44} className="rounded-xl" />
        </div>
        <p className="text-[#CC7853] text-xs font-bold tracking-[0.2em] uppercase mb-4">Error 404</p>
        <h1
          className="text-6xl sm:text-7xl font-bold leading-none"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Lost the thread.
        </h1>
        <p className="mt-6 text-white/65 leading-relaxed">
          That page doesn&apos;t exist — moved, mistyped, or never was. Let&apos;s get you back
          somewhere real.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#CC7853] hover:bg-[#b8694a] text-white text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors"
          >
            <Home size={15} />
            Back to GravHub
          </Link>
          <Link
            href="/what-we-do"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white px-4 py-3.5 rounded-xl border border-white/15 hover:border-white/30 transition-colors"
          >
            <Compass size={15} />
            What is GravHub?
          </Link>
        </div>

        <a
          href="mailto:jonathan@gravissmarketing.com"
          className="mt-9 inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <LifeBuoy size={12} />
          Still stuck? jonathan@gravissmarketing.com
        </a>
      </div>
    </div>
  )
}
