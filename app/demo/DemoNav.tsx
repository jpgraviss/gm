'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutGrid, Users, ScrollText, Monitor, BarChart3, ArrowLeft,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/demo', label: 'Overview', icon: LayoutGrid },
  { href: '/demo/pipeline', label: 'Pipeline & CRM', icon: Users },
  { href: '/demo/proposals', label: 'Proposals & Contracts', icon: ScrollText },
  { href: '/demo/portal', label: 'Client Portal', icon: Monitor },
  { href: '/demo/reporting', label: 'Reporting', icon: BarChart3 },
]

function isActive(pathname: string, href: string) {
  return href === '/demo' ? pathname === '/demo' : pathname.startsWith(href)
}

export function DemoSidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-[#012A1C] min-h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <Image src="/icon-192.png" alt="GravHub" width={26} height={26} className="rounded-md" />
        <span className="text-white text-sm tracking-[0.15em] font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          GRAVHUB
        </span>
      </div>
      <div className="px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase text-[#CC7853] bg-[#CC7853]/10 border border-[#CC7853]/30 rounded-full px-2.5 py-1">
          Demo &middot; sample data
        </span>
      </div>
      <nav className="flex-1 px-3 py-6 flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-[#015035] text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 pb-6">
        <Link
          href="/what-we-do"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} />
          Exit demo
        </Link>
      </div>
    </aside>
  )
}

export function DemoMobileNav() {
  const pathname = usePathname()
  return (
    <div className="lg:hidden sticky top-0 z-20 bg-[#012A1C] border-b border-white/10">
      <div className="flex items-center gap-2.5 px-4 h-14">
        <Image src="/icon-192.png" alt="GravHub" width={22} height={22} className="rounded-md" />
        <span className="text-white text-xs tracking-[0.15em] font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          GRAVHUB
        </span>
        <span className="ml-auto text-[9px] font-bold tracking-[0.1em] uppercase text-[#CC7853] bg-[#CC7853]/10 border border-[#CC7853]/30 rounded-full px-2 py-0.5">
          Demo
        </span>
      </div>
      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
        {NAV_ITEMS.map(item => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-[#015035] text-white' : 'bg-white/5 text-white/60'
              }`}
            >
              <item.icon size={12} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
