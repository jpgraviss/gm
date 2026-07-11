'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import { useSettings } from '@/lib/useSettings'
import {
  LayoutDashboard, Users, FileText, CreditCard,
  FolderKanban, Globe,
  Settings, X, ShieldCheck, LogOut, TrendingUp, MessageSquare, Inbox,
  BookOpen, Star, Megaphone, Bot, ChevronDown,
  ScrollText, GraduationCap, Share2, Mail, ClipboardList, Layers,
  CheckSquare, Clock, CalendarDays, CalendarCheck, Wrench, RefreshCw, PackageCheck, Zap,
  BarChart3, Plug, Search, Activity, FileSearch, Radar, Compass,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  allowedUnits?: string[]
  contractorVisible?: boolean
  billingVisible?: boolean
  children?: NavItem[]
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
      { label: 'Dashboard', href: '/',              icon: <LayoutDashboard size={16} />, contractorVisible: true, billingVisible: true },
      { label: 'My Workspace', href: '/workspace',  icon: <Compass size={16} />,         allowedUnits: ['Leadership/Admin', 'Sales'] },
      { label: 'Inbox',     href: '/inbox/unified', icon: <Inbox size={16} />,           billingVisible: true },
    ],
  },
  {
    section: 'CRM',
    items: [
      { label: 'Pipeline',  href: '/crm/pipeline',  icon: <TrendingUp size={16} />,  billingVisible: true },
      { label: 'Companies',  href: '/crm/companies',  icon: <Users size={16} />,       billingVisible: true },
      { label: 'Contacts',  href: '/crm/contacts',  icon: <Users size={16} />,       billingVisible: true },
      { label: 'Proposals',  href: '/proposals',      icon: <FileText size={16} />,    allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Contracts',  href: '/contracts',      icon: <ScrollText size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Sequences',  href: '/crm/sequences',  icon: <Zap size={16} />,         billingVisible: true },
    ],
  },
  {
    section: 'Sales',
    items: [
      { label: 'Enablement', href: '/sales-enablement', icon: <BookOpen size={16} />,     allowedUnits: ['Leadership/Admin', 'Sales'] },
      { label: 'Courses',    href: '/courses',           icon: <GraduationCap size={16} />, allowedUnits: ['Leadership/Admin', 'Sales'] },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Projects',      href: '/projects',                icon: <FolderKanban size={16} />, contractorVisible: true },
      { label: 'Tasks',         href: '/tasks',                   icon: <CheckSquare size={16} />,  contractorVisible: true, billingVisible: true },
      { label: 'Time Tracking', href: '/time-tracking',           icon: <Clock size={16} />,        contractorVisible: true, billingVisible: true },
      { label: 'Calendar',     href: '/calendar',                icon: <CalendarDays size={16} /> },
      { label: 'Booking',      href: '/calendar/booking',        icon: <CalendarCheck size={16} /> },
      { label: 'Delivery',     href: '/crm/delivery-dashboard',  icon: <PackageCheck size={16} /> },
      { label: 'Maintenance',  href: '/maintenance',             icon: <Wrench size={16} />,       contractorVisible: true },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { label: 'Broadcasts',    href: '/marketing',    icon: <Mail size={16} />,          allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Social Media',  href: '/social',       icon: <Share2 size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Forms',         href: '/forms',        icon: <ClipboardList size={16} />, allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Funnels',       href: '/funnels',      icon: <Layers size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Chatbots',      href: '/chatbots',     icon: <Bot size={16} />,           allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Rank Tracker',  href: '/rank-tracker', icon: <Search size={16} />,        allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'WordPress SEO', href: '/rank-tracker/wordpress', icon: <Globe size={16} />, allowedUnits: ['Leadership/Admin', 'Delivery/Operations'] },
      { label: 'Audits',        href: '/audits',       icon: <FileSearch size={16} />,    allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Billing',  href: '/billing',  icon: <CreditCard size={16} />, allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Renewals', href: '/renewals', icon: <RefreshCw size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
      { label: 'Reports',  href: '/reports',  icon: <BarChart3 size={16} />,  allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'], billingVisible: true },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Portal',         href: '/portal',         icon: <Globe size={16} />,          billingVisible: true },
      { label: 'Tickets',        href: '/tickets',        icon: <MessageSquare size={16} />,  contractorVisible: true, billingVisible: true },
      { label: 'Reputation',     href: '/reputation',     icon: <Star size={16} />,           allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Client Reports', href: '/reports/client', icon: <FileText size={16} />,       allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Intelligence',     href: '/intelligence',              icon: <Radar size={16} />,       allowedUnits: ['Leadership/Admin', 'Sales', 'Delivery/Operations'] },
      { label: 'Monitoring',       href: '/monitoring',                icon: <Activity size={16} />,    allowedUnits: ['Leadership/Admin', 'Delivery/Operations'] },
      { label: 'Automation',       href: '/automation',                icon: <Zap size={16} />,         allowedUnits: ['Leadership/Admin'] },
      { label: 'Knowledge Base',   href: '/knowledge-base',            icon: <BookOpen size={16} /> },
      { label: 'Integrations',     href: '/integrations',              icon: <Plug size={16} />,        allowedUnits: ['Leadership/Admin'] },
      { label: 'Portal Management', href: '/admin/portal-management',  icon: <Globe size={16} />,       adminOnly: true },
      { label: 'SOPs',             href: '/admin/sops',                icon: <FileText size={16} />,    adminOnly: true },
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

const COLLAPSIBLE_SECTIONS = new Set(['CRM', 'Sales', 'Operations', 'Marketing', 'Finance', 'Clients', 'System'])

const sectionIcons: Record<string, React.ReactNode> = {
  CRM: <Users size={16} />,
  Sales: <TrendingUp size={16} />,
  Operations: <FolderKanban size={16} />,
  Marketing: <Megaphone size={16} />,
  Finance: <CreditCard size={16} />,
  Clients: <Globe size={16} />,
  System: <Settings size={16} />,
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { closeSidebar } = useUI()
  const settings = useSettings()
  const [roleNavConfig, setRoleNavConfig] = useState<RoleNavConfig | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set())

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
  const brandDarkBg = settings?.branding.darkBg ?? '#012A1C'
  const appName = settings?.branding.appName ?? 'GravHub'
  const companyName = settings?.company.name ?? 'Graviss Marketing'

  const activeConfig = roleNavConfig ? resolveConfigForUser(roleNavConfig, user ?? null) : null
  const resolvedNavigation = activeConfig ? applyNavConfig(activeConfig) : defaultNavigation

  useEffect(() => {
    const toExpand: string[] = []
    for (const group of resolvedNavigation) {
      if (COLLAPSIBLE_SECTIONS.has(group.section)) {
        const hasActive = group.items.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))
        if (hasActive) toExpand.push(group.section)
      }
    }
    if (toExpand.length > 0) {
      requestAnimationFrame(() => setExpandedSections(prev => { const next = new Set(prev); toExpand.forEach(s => next.add(s)); return next }))
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

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

          const isCollapsible = COLLAPSIBLE_SECTIONS.has(group.section)
          const isExpanded = expandedSections.has(group.section)
          const hasActiveChild = visibleItems.some(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)))

          return (
            <div key={group.section} className="mb-3">
              {isCollapsible ? (
                <button
                  onClick={() => setExpandedSections(prev => {
                    const next = new Set(prev)
                    if (next.has(group.section)) next.delete(group.section)
                    else next.add(group.section)
                    return next
                  })}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                    ${hasActiveChild ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04]'}`}
                >
                  <span className="flex-shrink-0 lg:hidden lg:group-hover:block">
                    <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                  </span>
                  {sectionIcons[group.section] && (
                    <span className="flex-shrink-0 hidden lg:block lg:group-hover:hidden">
                      {sectionIcons[group.section]}
                    </span>
                  )}
                  <span className="text-[11px] font-semibold tracking-widest uppercase whitespace-nowrap overflow-hidden
                    lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
                    {group.section}
                  </span>
                </button>
              ) : (
                <>
                  <p className="block lg:hidden lg:group-hover:block text-white/30 text-[10px] font-semibold tracking-widest uppercase px-3 mb-1.5 whitespace-nowrap overflow-hidden">
                    {group.section}
                  </p>
                  <div className="hidden lg:block lg:group-hover:hidden h-px bg-white/[0.06] mx-2 mb-2" />
                </>
              )}

              {(!isCollapsible || isExpanded) && (
                <div className={`flex flex-col gap-0.5 ${isCollapsible ? 'mt-0.5 ml-2' : ''}`}>
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
              )}
            </div>
          )
        })}
      </nav>

      {/* Pinned: Admin & Settings */}
      <div className="px-2 py-2 border-t border-white/[0.08] flex-shrink-0 flex flex-col gap-0.5">
        {user?.isAdmin && (
          <Link
            href="/admin"
            onClick={closeSidebar}
            title="Admin"
            className={`sidebar-nav-item ${pathname.startsWith('/admin') && !pathname.startsWith('/admin/portal') && !pathname.startsWith('/admin/sops') ? 'active' : ''} justify-start`}
          >
            <span className={`flex-shrink-0 ${pathname.startsWith('/admin') && !pathname.startsWith('/admin/portal') && !pathname.startsWith('/admin/sops') ? 'text-white' : 'text-white/50'}`}>
              <ShieldCheck size={16} />
            </span>
            <span className="flex-1 text-[13px] whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
              Admin
            </span>
          </Link>
        )}
        {(!user || user.isAdmin || user.unit === 'Leadership/Admin') && (
          <Link
            href="/settings"
            onClick={closeSidebar}
            title="Settings"
            className={`sidebar-nav-item ${pathname.startsWith('/settings') ? 'active' : ''} justify-start`}
          >
            <span className={`flex-shrink-0 ${pathname.startsWith('/settings') ? 'text-white' : 'text-white/50'}`}>
              <Settings size={16} />
            </span>
            <span className="flex-1 text-[13px] whitespace-nowrap overflow-hidden lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150">
              Settings
            </span>
          </Link>
        )}
      </div>

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
