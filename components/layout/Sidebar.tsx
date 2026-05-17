'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import { useSettings } from '@/lib/useSettings'
import {
  LayoutDashboard, Users, FileText, ScrollText, CreditCard,
  FolderKanban, Wrench, RefreshCw, Globe, BarChart3, Zap,
  Settings, X, ShieldCheck, LogOut, TrendingUp, Building2, Mail, MessageSquare, CheckSquare, Inbox,
  CalendarDays, CalendarCheck, Clock, Activity, Plug, BookOpen, GraduationCap,
  Share2, ClipboardList, Search, FileBarChart, MessageCircle, Smartphone, Star, Layers, PackageCheck,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  allowedUnits?: string[]
  contractorVisible?: boolean
  billingVisible?: boolean
}

export interface NavSection {
  section: string
  items: NavItem[]
}

export interface NavConfigItem {
  href: string
  visible: boolean
  order: number
}

export interface NavConfigSection {
  id: string
  label: string
  visible: boolean
  order: number
  items: NavConfigItem[]
}

export interface NavConfig {
  sections: NavConfigSection[]
}

export const NAV_ROLES = ['Leadership/Admin', 'Sales', 'Delivery/Operations', 'Billing/Finance', 'contractor'] as const
export type NavRoleKey = typeof NAV_ROLES[number]

export interface RoleNavConfig {
  global: NavConfig
  roles: Partial<Record<NavRoleKey, NavConfig>>
}

export const defaultNavigation: NavSection[] = [
  {
    section: 'Home',
    items: [
      { label: 'Dashboard', href: '/',         icon: <LayoutDashboard size={16} />, contractorVisible: true, billingVisible: true },
      { label: 'Inbox',     href: '/inbox/unified', icon: <Inbox size={16} />,      billingVisible: true },
    ],
  },
  {
    section: 'CRM',
    items: [
      { label: 'Pipeline',  href: '/crm/pipeline',  icon: <TrendingUp size={16} />, billingVisible: true },
      { label: 'Companies', href: '/crm/companies', icon: <Building2 size={16} />,  billingVisible: true },
      { label: 'Contacts',  href: '/crm/contacts',  icon: <Users size={16} />,      billingVisible: true },
      { label: 'Sequences', href: '/crm/sequences', icon: <Zap size={16} />,        billingVisible: true },
    ],
  },
  {
    section: 'Sales',
    items: [
      { label: 'Proposals',  href: '/proposals',        icon: <FileText size={16} />,      allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Contracts',  href: '/contracts',         icon: <ScrollText size={16} />,    allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Enablement', href: '/sales-enablement',  icon: <BookOpen size={16} />,      allowedUnits: ['Leadership/Admin', 'Sales'] },
      { label: 'Courses',    href: '/courses',            icon: <GraduationCap size={16} />, allowedUnits: ['Leadership/Admin', 'Sales'] },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { label: 'Social Media', href: '/social',    icon: <Share2 size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Broadcasts',   href: '/marketing', icon: <Mail size={16} />,          allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Forms',        href: '/forms',      icon: <ClipboardList size={16} />, allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Funnels',      href: '/funnels',    icon: <Layers size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
    ],
  },
  {
    section: 'Communication',
    items: [
      { label: 'Messaging',      href: '/messaging',            icon: <MessageCircle size={16} />, allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'SMS Templates',  href: '/messaging/templates',  icon: <Smartphone size={16} />,    allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Projects',      href: '/projects',      icon: <FolderKanban size={16} />, contractorVisible: true },
      { label: 'Tasks',         href: '/tasks',         icon: <CheckSquare size={16} />,  contractorVisible: true, billingVisible: true },
      { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={16} />,        contractorVisible: true, billingVisible: true },
      { label: 'Calendar',      href: '/calendar',      icon: <CalendarDays size={16} /> },
      { label: 'Booking',       href: '/calendar/booking', icon: <CalendarCheck size={16} /> },
      { label: 'Maintenance',   href: '/maintenance',   icon: <Wrench size={16} />,       contractorVisible: true },
      { label: 'Renewals',      href: '/renewals',      icon: <RefreshCw size={16} /> },
      { label: 'Delivery',      href: '/crm/delivery-dashboard', icon: <PackageCheck size={16} /> },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Portal',         href: '/portal',          icon: <Globe size={16} />,          billingVisible: true },
      { label: 'Tickets',        href: '/tickets',         icon: <MessageSquare size={16} />,  contractorVisible: true, billingVisible: true },
      { label: 'Client Reports', href: '/reports/client',  icon: <FileBarChart size={16} />,   allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Reputation',    href: '/reputation',      icon: <Star size={16} />,          allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
    ],
  },
  {
    section: 'Analytics',
    items: [
      { label: 'Reports',      href: '/reports',      icon: <BarChart3 size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Integrations', href: '/integrations', icon: <Plug size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Rank Tracker', href: '/rank-tracker', icon: <Search size={16} />,      allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Monitoring',   href: '/monitoring',   icon: <Activity size={16} />,    allowedUnits: ['Leadership/Admin', 'Delivery/Operations'] },
      { label: 'Billing',     href: '/billing',       icon: <CreditCard size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Automation',  href: '/automation',    icon: <Zap size={16} />,         allowedUnits: ['Leadership/Admin'] },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Knowledge Base',    href: '/knowledge-base',            icon: <BookOpen size={16} /> },
      { label: 'Admin',              href: '/admin',                     icon: <ShieldCheck size={16} />, adminOnly: true },
      { label: 'Portal Management',  href: '/admin/portal-management',   icon: <Globe size={16} />,       adminOnly: true },
      { label: 'Settings',           href: '/settings',                  icon: <Settings size={16} />,    allowedUnits: ['Leadership/Admin'] },
    ],
  },
]

export function buildDefaultNavConfig(): NavConfig {
  return {
    sections: defaultNavigation.map((s, si) => ({
      id: s.section.toLowerCase().replace(/\s+/g, '-'),
      label: s.section,
      visible: true,
      order: si,
      items: s.items.map((item, ii) => ({
        href: item.href,
        visible: true,
        order: ii,
      })),
    })),
  }
}

export function buildDefaultRoleNavConfig(): RoleNavConfig {
  return { global: buildDefaultNavConfig(), roles: {} }
}

function normalizeNavConfig(raw: unknown): RoleNavConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.global && typeof obj.global === 'object' && (obj.global as NavConfig).sections?.length) {
    return obj as unknown as RoleNavConfig
  }
  if (Array.isArray((obj as unknown as NavConfig).sections) && (obj as unknown as NavConfig).sections.length) {
    return { global: obj as unknown as NavConfig, roles: {} }
  }
  return null
}

function resolveConfigForUser(config: RoleNavConfig, user: { unit: string; role: string } | null): NavConfig {
  if (!user) return config.global
  const isContractor = user.role === 'Contractor' || user.unit === 'Contractors'
  if (isContractor && config.roles.contractor) return config.roles.contractor
  const roleKey = user.unit as NavRoleKey
  if (config.roles[roleKey]) return config.roles[roleKey]!
  return config.global
}

function applyNavConfig(config: NavConfig): NavSection[] {
  const sectionMap = new Map(defaultNavigation.map(s => [s.section.toLowerCase().replace(/\s+/g, '-'), s]))
  return [...config.sections]
    .filter(cs => cs.visible)
    .sort((a, b) => a.order - b.order)
    .map(cs => {
      const original = sectionMap.get(cs.id)
      if (!original) return null
      const itemMap = new Map(original.items.map(it => [it.href, it]))
      const sortedItems = [...cs.items]
        .filter(ci => ci.visible)
        .sort((a, b) => a.order - b.order)
        .map(ci => itemMap.get(ci.href))
        .filter((it): it is NavItem => !!it)
      if (sortedItems.length === 0) return null
      return { section: cs.label, items: sortedItems }
    })
    .filter((s): s is NavSection => !!s)
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { closeSidebar } = useUI()
  const settings = useSettings()
  const [roleNavConfig, setRoleNavConfig] = useState<RoleNavConfig | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const parsed = normalizeNavConfig(d?.navigation_config)
        if (parsed) setRoleNavConfig(parsed)
      })
      .catch(() => {})
  }, [])

  const brandPrimary = settings?.branding.primaryColor ?? '#015035'
  const brandDarkBg = settings?.branding.darkBg ?? '#012b1e'
  const appName = settings?.branding.appName ?? 'GravHub'
  const companyName = settings?.company.name ?? 'Graviss Marketing'

  const activeConfig = roleNavConfig ? resolveConfigForUser(roleNavConfig, user ?? null) : null
  const resolvedNavigation = activeConfig ? applyNavConfig(activeConfig) : defaultNavigation

  const handleLogout = () => {
    logout()
    closeSidebar()
  }

  return (
    <aside
      style={{ background: brandDarkBg }}
      className="group flex flex-col flex-shrink-0 border-r border-white/5 h-screen sticky top-0
                 w-[230px] lg:w-14 lg:hover:w-[230px] transition-[width] duration-200 overflow-hidden"
    >
      {/* Logo */}
      <div className="px-3 py-4 border-b border-white/[0.08] flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: brandPrimary }}
        >
          <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{appName[0]}</span>
        </div>
        <div className="flex-1 min-w-0 overflow-hidden whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
          <span className="text-white text-sm font-bold tracking-widest block" style={{ fontFamily: 'var(--font-heading)' }}>
            {appName}
          </span>
          <p className="text-white/40 text-[10px] tracking-wider">{companyName}</p>
        </div>
        <button
          onClick={closeSidebar}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors lg:hidden flex-shrink-0"
        >
          <X size={16} className="text-white/60" />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {resolvedNavigation.map((group) => {
          const isContractor = user?.role === 'Contractor' || user?.unit === 'Contractors'
          const isBilling = user?.unit === 'Billing/Finance'
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !user?.isAdmin) return false
            if (item.allowedUnits && !user?.isAdmin && !item.allowedUnits.includes(user?.unit ?? '')) return false
            if (isContractor && !item.contractorVisible) return false
            if (isBilling && !user?.isAdmin && !item.billingVisible) return false
            return true
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={group.section} className="mb-3">
              <p className="block lg:hidden lg:group-hover:block text-white/30 text-[10px] font-semibold tracking-widest uppercase px-3 mb-1.5 whitespace-nowrap overflow-hidden">
                {group.section}
              </p>
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
                      <span className="flex-1 text-[13px] whitespace-nowrap overflow-hidden
                                       lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
                        {item.label}
                      </span>
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
