'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, LayoutDashboard, Users, TrendingUp, Building2, FileText,
  ScrollText, FolderKanban, CheckSquare, Clock, CalendarDays, Wrench,
  RefreshCw, Mail, MessageSquare, CreditCard, Settings, Zap,
  Globe, BarChart3, Plug, Share2, ClipboardList, Inbox, ArrowRight,
  BookOpen, ShieldCheck, UserCircle, Briefcase, SlidersHorizontal,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  section: string
  href: string
  icon: React.ReactNode
  keywords?: string[]
}

interface SearchResult {
  id: string
  type: 'contact' | 'company' | 'deal' | 'project' | 'ticket' | 'task' | 'proposal' | 'contract'
  name: string
  subtitle: string
  href: string
}

const TYPE_META: Record<string, { icon: React.ReactNode; badge: string; badgeClass: string }> = {
  contact:  { icon: <UserCircle size={15} />,   badge: 'Contact',  badgeClass: 'bg-blue-100 text-blue-700' },
  company:  { icon: <Building2 size={15} />,    badge: 'Company',  badgeClass: 'bg-indigo-100 text-indigo-700' },
  deal:     { icon: <TrendingUp size={15} />,   badge: 'Deal',     badgeClass: 'bg-amber-100 text-amber-700' },
  project:  { icon: <FolderKanban size={15} />, badge: 'Project',  badgeClass: 'bg-purple-100 text-purple-700' },
  ticket:   { icon: <MessageSquare size={15} />,badge: 'Ticket',   badgeClass: 'bg-pink-100 text-pink-700' },
  task:     { icon: <CheckSquare size={15} />,  badge: 'Task',     badgeClass: 'bg-cyan-100 text-cyan-700' },
  proposal: { icon: <FileText size={15} />,     badge: 'Proposal', badgeClass: 'bg-teal-100 text-teal-700' },
  contract: { icon: <ScrollText size={15} />,   badge: 'Contract', badgeClass: 'bg-orange-100 text-orange-700' },
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard',      label: 'Dashboard',        section: 'Navigate',   href: '/',                icon: <LayoutDashboard size={15} />,  keywords: ['home', 'overview'] },
  { id: 'inbox',          label: 'Inbox',            section: 'Navigate',   href: '/inbox/unified',   icon: <Inbox size={15} />,            keywords: ['email', 'messages'] },
  { id: 'pipeline',       label: 'Pipeline',         section: 'CRM',        href: '/crm/pipeline',    icon: <TrendingUp size={15} />,       keywords: ['deals', 'sales', 'kanban'] },
  { id: 'companies',      label: 'Companies',        section: 'CRM',        href: '/crm/companies',   icon: <Building2 size={15} />,        keywords: ['accounts', 'organizations'] },
  { id: 'contacts',       label: 'Contacts',         section: 'CRM',        href: '/crm/contacts',    icon: <Users size={15} />,            keywords: ['people', 'leads'] },
  { id: 'sequences',      label: 'Sequences',        section: 'CRM',        href: '/crm/sequences',   icon: <Zap size={15} />,              keywords: ['drip', 'nurture', 'automation'] },
  { id: 'proposals',      label: 'Proposals',        section: 'Sales',      href: '/proposals',       icon: <FileText size={15} />,         keywords: ['quotes', 'estimates'] },
  { id: 'contracts',      label: 'Contracts',        section: 'Sales',      href: '/contracts',       icon: <ScrollText size={15} />,       keywords: ['agreements'] },
  { id: 'enablement',     label: 'Sales Enablement', section: 'Sales',      href: '/sales-enablement',icon: <BookOpen size={15} /> },
  { id: 'broadcasts',     label: 'Broadcasts',       section: 'Marketing',  href: '/marketing',       icon: <Mail size={15} />,             keywords: ['email', 'campaigns', 'newsletter'] },
  { id: 'social',         label: 'Social Media',     section: 'Marketing',  href: '/social',          icon: <Share2 size={15} />,           keywords: ['posts', 'facebook', 'instagram'] },
  { id: 'forms',          label: 'Forms',            section: 'Marketing',  href: '/forms',           icon: <ClipboardList size={15} />,    keywords: ['surveys', 'lead capture'] },
  { id: 'projects',       label: 'Projects',         section: 'Operations', href: '/projects',        icon: <FolderKanban size={15} />,     keywords: ['delivery', 'work'] },
  { id: 'tasks',          label: 'Tasks',            section: 'Operations', href: '/tasks',           icon: <CheckSquare size={15} />,      keywords: ['todo', 'assignments'] },
  { id: 'time-tracking',  label: 'Time Tracking',    section: 'Operations', href: '/time-tracking',   icon: <Clock size={15} />,            keywords: ['hours', 'timesheet'] },
  { id: 'calendar',       label: 'Calendar',         section: 'Operations', href: '/calendar',        icon: <CalendarDays size={15} />,     keywords: ['schedule', 'meetings', 'booking'] },
  { id: 'maintenance',    label: 'Maintenance',      section: 'Operations', href: '/maintenance',     icon: <Wrench size={15} />,           keywords: ['hosting', 'websites'] },
  { id: 'renewals',       label: 'Renewals',         section: 'Operations', href: '/renewals',        icon: <RefreshCw size={15} /> },
  { id: 'tickets',        label: 'Tickets',          section: 'Clients',    href: '/tickets',         icon: <MessageSquare size={15} />,    keywords: ['support', 'issues'] },
  { id: 'portal',         label: 'Client Portal',    section: 'Clients',    href: '/portal',          icon: <Globe size={15} /> },
  { id: 'billing',        label: 'Billing',          section: 'Analytics',  href: '/billing',         icon: <CreditCard size={15} />,       keywords: ['invoices', 'payments'] },
  { id: 'reports',        label: 'Reports',          section: 'Analytics',  href: '/reports',         icon: <BarChart3 size={15} />,        keywords: ['analytics', 'metrics'] },
  { id: 'integrations',   label: 'Integrations',     section: 'Analytics',  href: '/integrations',    icon: <Plug size={15} />,             keywords: ['google', 'meta', 'api'] },
  { id: 'automation',     label: 'Automation',       section: 'System',     href: '/automation',      icon: <Zap size={15} />,              keywords: ['workflows', 'triggers'] },
  { id: 'settings',       label: 'Settings',         section: 'System',     href: '/settings',        icon: <Settings size={15} /> },
  { id: 'admin',          label: 'Admin',            section: 'System',     href: '/admin',           icon: <ShieldCheck size={15} />,      keywords: ['users', 'team'] },
  { id: 'audit-log',      label: 'Audit Log',        section: 'System',     href: '/admin/audit-log', icon: <Briefcase size={15} />,        keywords: ['activity', 'history'] },
  { id: 'portal-mgmt',   label: 'Portal Management', section: 'System',    href: '/admin/portal-management', icon: <Globe size={15} />, keywords: ['portal', 'clients', 'companies'] },
  { id: 'document-templates', label: 'Document Templates', section: 'System', href: '/admin/document-templates', icon: <FileText size={15} />, keywords: ['proposal', 'contract', 'addendum', 'template'] },
  { id: 'custom-fields',  label: 'Custom Fields',    section: 'System',     href: '/admin/custom-fields', icon: <SlidersHorizontal size={15} />, keywords: ['fields', 'contacts', 'companies', 'deals'] },
]

const RECENT_KEY = 'gravhub_recent_searches'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addRecentSearch(term: string) {
  try {
    const recent = getRecentSearches().filter(r => r !== term)
    recent.unshift(term)
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch { /* noop */ }
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [entityResults, setEntityResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setEntityResults([])
      setRecentSearches(getRecentSearches())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setEntityResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : [])
        .then((data: SearchResult[]) => setEntityResults(data))
        .catch(() => setEntityResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const filtered = query.trim()
    ? COMMANDS.filter(c => {
        const q = query.toLowerCase()
        return c.label.toLowerCase().includes(q) ||
               c.section.toLowerCase().includes(q) ||
               (c.keywords ?? []).some(k => k.includes(q))
      })
    : COMMANDS

  const sections = [...new Set(filtered.map(c => c.section))]

  const totalItems = filtered.length + entityResults.length

  const handleSelectPage = useCallback((item: CommandItem) => {
    setOpen(false)
    router.push(item.href)
  }, [router])

  const handleSelectEntity = useCallback((item: SearchResult) => {
    if (query.trim()) addRecentSearch(query.trim())
    setOpen(false)
    router.push(item.href)
  }, [router, query])

  const handleSelectRecent = useCallback((term: string) => {
    setQuery(term)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (selectedIdx < filtered.length) {
        handleSelectPage(filtered[selectedIdx])
      } else {
        const entityIdx = selectedIdx - filtered.length
        if (entityResults[entityIdx]) handleSelectEntity(entityResults[entityIdx])
      }
    }
  }

  if (!open) return null

  let itemIdx = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, contacts, deals, projects..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {searching && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {!query.trim() && recentSearches.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Recent Searches</p>
              {recentSearches.map(term => (
                <button
                  key={term}
                  onClick={() => handleSelectRecent(term)}
                  className="flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Clock size={13} className="text-gray-300" />
                  <span className="text-sm text-gray-600">{term}</span>
                </button>
              ))}
            </div>
          )}

          {entityResults.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">Results</p>
              {entityResults.map((result, rIdx) => {
                const globalIdx = filtered.length + rIdx
                const meta = TYPE_META[result.type]
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelectEntity(result)}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                      selectedIdx === globalIdx ? 'bg-emerald-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={selectedIdx === globalIdx ? 'text-emerald-600' : 'text-gray-400'}>{meta?.icon}</span>
                    <span className={`text-sm font-medium flex-1 truncate ${selectedIdx === globalIdx ? 'text-emerald-800' : 'text-gray-700'}`}>
                      {result.name}
                    </span>
                    {result.subtitle && (
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">{result.subtitle}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta?.badgeClass ?? 'bg-gray-100 text-gray-600'}`}>
                      {meta?.badge}
                    </span>
                    {selectedIdx === globalIdx && <ArrowRight size={13} className="text-emerald-400 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {filtered.length === 0 && entityResults.length === 0 && query.trim() ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            sections.map(section => {
              const sectionItems = filtered.filter(c => c.section === section)
              return (
                <div key={section}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">{section}</p>
                  {sectionItems.map(item => {
                    itemIdx++
                    const idx = itemIdx
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectPage(item)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                          selectedIdx === idx ? 'bg-emerald-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className={selectedIdx === idx ? 'text-emerald-600' : 'text-gray-400'}>{item.icon}</span>
                        <span className={`text-sm font-medium flex-1 ${selectedIdx === idx ? 'text-emerald-800' : 'text-gray-700'}`}>{item.label}</span>
                        {selectedIdx === idx && <ArrowRight size={13} className="text-emerald-400" />}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">&#8593;&#8595;</kbd> navigate
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">&#8629;</kbd> open
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 ml-auto">
            <kbd className="font-mono bg-gray-100 px-1 py-0.5 rounded border border-gray-200">&#8984;K</kbd> toggle
          </div>
        </div>
      </div>
    </div>
  )
}
