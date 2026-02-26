'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  ScrollText,
  CreditCard,
  FolderKanban,
  Wrench,
  RefreshCw,
  Globe,
  BarChart3,
  Zap,
  Settings,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  section: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    section: 'Revenue',
    items: [
      { label: 'CRM & Pipeline', href: '/crm', icon: <Users size={15} /> },
      { label: 'Proposals', href: '/proposals', icon: <FileText size={15} /> },
      { label: 'Contracts', href: '/contracts', icon: <ScrollText size={15} /> },
      { label: 'Billing', href: '/billing', icon: <CreditCard size={15} /> },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { label: 'Projects', href: '/projects', icon: <FolderKanban size={15} /> },
      { label: 'Maintenance', href: '/maintenance', icon: <Wrench size={15} /> },
      { label: 'Renewals', href: '/renewals', icon: <RefreshCw size={15} /> },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Client Portal', href: '/portal', icon: <Globe size={15} /> },
    ],
  },
  {
    section: 'Intel',
    items: [
      { label: 'Reports', href: '/reports', icon: <BarChart3 size={15} /> },
      { label: 'Automation', href: '/automation', icon: <Zap size={15} /> },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: <Settings size={15} /> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{ background: '#012b1e', width: 230, minHeight: '100vh' }}
      className="flex flex-col flex-shrink-0 border-r border-white/5"
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#015035' }}
          >
            <span className="text-white text-xs font-bold font-heading">G</span>
          </div>
          <div>
            <span
              className="text-white text-sm font-bold font-heading tracking-widest"
              style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
            >
              GravHub
            </span>
            <p className="text-white/40 text-[10px] tracking-wider mt-0.5">Graviss Marketing</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navigation.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase px-3 mb-1.5">
              {group.section}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className={isActive ? 'text-white' : 'text-white/50'}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-[13px]">{item.label}</span>
                    {isActive && <ChevronRight size={12} className="text-white/30" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/8">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: '#015035' }}
          >
            AF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">Amanda Foster</p>
            <p className="text-white/40 text-[10px]">Leadership</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
