'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import {
  LayoutDashboard, Users, FileText, ScrollText, CreditCard,
  FolderKanban, Wrench, RefreshCw, Globe, BarChart3, Zap,
  Settings, X, ShieldCheck, LogOut, TrendingUp, Building2, Mail, MessageSquare, CheckSquare, Inbox,
  CalendarDays, Clock,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  /** If set, only users whose unit is in this list (or admins) can see/access this item */
  allowedUnits?: string[]
  /** If true, this item is visible to contractors */
  contractorVisible?: boolean
}

interface NavSection {
  section: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',     href: '/',              icon: <LayoutDashboard size={16} />, contractorVisible: true },
      { label: 'Tasks',         href: '/tasks',         icon: <CheckSquare size={16} />,     contractorVisible: true },
      { label: 'Calendar',      href: '/calendar',      icon: <CalendarDays size={16} /> },
      { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={16} />,           contractorVisible: true },
    ],
  },
  {
    section: 'CRM',
    items: [
      { label: 'Pipeline', href: '/crm/pipeline', icon: <TrendingUp size={16} /> },
      { label: 'Companies', href: '/crm/companies', icon: <Building2 size={16} /> },
      { label: 'Contacts', href: '/crm/contacts', icon: <Users size={16} /> },
      { label: 'Sequences', href: '/crm/sequences', icon: <Mail size={16} /> },
      { label: 'Inbox', href: '/inbox', icon: <Inbox size={16} /> },
    ],
  },
  {
    section: 'Revenue',
    items: [
      { label: 'Proposals', href: '/proposals', icon: <FileText size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
      { label: 'Contracts', href: '/contracts', icon: <ScrollText size={16} />, allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
      { label: 'Billing',   href: '/billing',   icon: <CreditCard size={16} />, allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { label: 'Projects',    href: '/projects',    icon: <FolderKanban size={16} />, contractorVisible: true },
      { label: 'Maintenance', href: '/maintenance', icon: <Wrench size={16} />,       contractorVisible: true },
      { label: 'Renewals',    href: '/renewals',    icon: <RefreshCw size={16} /> },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Client Portal', href: '/portal', icon: <Globe size={16} /> },
      { label: 'Tickets', href: '/tickets', icon: <MessageSquare size={16} />, contractorVisible: true },
    ],
  },
  {
    section: 'Intel',
    items: [
      { label: 'Reports',    href: '/reports',    icon: <BarChart3 size={16} />, allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
      { label: 'Automation', href: '/automation', icon: <Zap size={16} />,       allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Admin Panel', href: '/admin',    icon: <ShieldCheck size={16} />, adminOnly: true },
      { label: 'Settings',    href: '/settings', icon: <Settings size={16} />,    allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
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
      style={{ background: '#012b1e' }}
      className="group flex flex-col flex-shrink-0 border-r border-white/5 h-screen sticky top-0
                 w-[230px] lg:w-14 lg:hover:w-[230px] transition-[width] duration-200 overflow-hidden"
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/[0.08] flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--brand-primary, #015035)' }}
        >
          <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-heading)' }}>G</span>
        </div>
        {/* Logo text — always visible mobile, fades in on desktop hover */}
        <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
          <span className="text-white text-sm font-bold tracking-widest block" style={{ fontFamily: 'var(--font-heading)' }}>
            GravHub
          </span>
          <p className="text-white/40 text-[10px] tracking-wider">Graviss Marketing</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={closeSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors lg:hidden flex-shrink-0"
        >
          <X size={16} className="text-white/60" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {navigation.map((group) => {
          const isContractor = user?.role === 'Contractor' || user?.unit === 'Contractors'
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !user?.isAdmin) return false
            if (item.allowedUnits && !user?.isAdmin && !item.allowedUnits.includes(user?.unit ?? '')) return false
            if (isContractor && !item.contractorVisible) return false
            return true
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={group.section} className="mb-3">
              {/* Section label: visible on mobile, visible on desktop hover */}
              <p className="block lg:hidden lg:group-hover:block text-white/30 text-[10px] font-semibold tracking-widest uppercase px-3 mb-1.5 whitespace-nowrap overflow-hidden">
                {group.section}
              </p>
              {/* Divider shown only in collapsed desktop mode */}
              <div className="hidden lg:block lg:group-hover:hidden h-px bg-white/[0.06] mx-2 mb-2" />

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
                      title={item.label}
                      className={`sidebar-nav-item ${isActive ? 'active' : ''} justify-start`}
                    >
                      <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-white/50'}`}>
                        {item.icon}
                      </span>
                      {/* Label */}
                      <span className="flex-1 text-[13px] whitespace-nowrap overflow-hidden
                                       lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
                        {item.label}
                      </span>
                      {/* Admin badge */}
                      {item.adminOnly && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap
                                         lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
                          ADMIN
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-2 py-3 border-t border-white/[0.08] flex-shrink-0">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: user.isAdmin ? '#f59e0b' : 'var(--brand-primary, #015035)' }}
            >
              {user.initials}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap
                           lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
              <p className="text-white text-xs font-medium">{user.name}</p>
              <p className="text-white/40 text-[10px]">{user.isAdmin ? '★ Super Admin' : user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0
                         lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150"
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
