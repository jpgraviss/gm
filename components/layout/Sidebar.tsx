'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import {
  LayoutDashboard, Users, FileText, ScrollText, CreditCard,
  FolderKanban, Wrench, RefreshCw, Globe, BarChart3, Zap,
  Settings, ChevronRight, X, ShieldCheck, LogOut,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
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
      { label: 'Admin Panel', href: '/admin', icon: <ShieldCheck size={15} />, adminOnly: true },
      { label: 'Settings', href: '/settings', icon: <Settings size={15} /> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { closeSidebar } = useUI()

  const handleLogout = () => {
    logout()
    closeSidebar()
  }

  return (
    <aside
      style={{ background: '#012b1e', width: 230, minHeight: '100vh' }}
      className="flex flex-col flex-shrink-0 border-r border-white/5 h-screen sticky top-0"
    >
      {/* Logo + mobile close */}
      <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#015035' }}
          >
            <span
              className="text-white text-xs font-bold"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              G
            </span>
          </div>
          <div>
            <span
              className="text-white text-sm font-bold tracking-widest"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              GravHub
            </span>
            <p className="text-white/40 text-[10px] tracking-wider mt-0.5">Graviss Marketing</p>
          </div>
        </div>
        <button
          onClick={closeSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors lg:hidden"
        >
          <X size={16} className="text-white/60" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navigation.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || user?.isAdmin
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.section} className="mb-5">
              <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase px-3 mb-1.5">
                {group.section}
              </p>
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSidebar}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    >
                      <span className={isActive ? 'text-white' : 'text-white/50'}>
                        {item.icon}
                      </span>
                      <span className="flex-1 text-[13px]">{item.label}</span>
                      {item.adminOnly && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                          ADMIN
                        </span>
                      )}
                      {isActive && !item.adminOnly && (
                        <ChevronRight size={12} className="text-white/30" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/8">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: user.isAdmin ? '#f59e0b' : '#015035' }}
            >
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.name}</p>
              <p className="text-white/40 text-[10px] truncate">
                {user.isAdmin ? '★ Super Admin' : user.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={13} className="text-white/40 hover:text-white/70" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
