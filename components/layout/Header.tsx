'use client'

import { useState } from 'react'
import { Bell, Search, Plus, Menu, X, LogOut, ShieldCheck, User, CheckCircle2, AlertCircle, FileText, DollarSign, RefreshCw, MessageSquare } from 'lucide-react'
import { useUI } from '@/contexts/UIContext'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

// ─── Notifications data ───────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { id: 'n1', type: 'alert',    icon: <AlertCircle size={13} />,  color: '#ef4444', title: 'Overdue invoice',    body: 'Summit Capital — $12,500 is 12 days past due',          time: '2h ago',  href: '/billing',    unread: true },
  { id: 'n2', type: 'contract', icon: <FileText size={13} />,     color: '#015035', title: 'Contract signed',    body: 'BlueStar Logistics signed the SEO agreement',          time: '5h ago',  href: '/contracts',  unread: true },
  { id: 'n3', type: 'renewal',  icon: <RefreshCw size={13} />,    color: '#8b5cf6', title: 'Renewal coming up',  body: 'ProVenture LLC renews in 12 days — action needed',     time: '1d ago',  href: '/renewals',   unread: true },
  { id: 'n4', type: 'invoice',  icon: <DollarSign size={13} />,   color: '#22c55e', title: 'Payment received',   body: 'Coastal Realty paid INV-2024-005 ($27,500)',           time: '2d ago',  href: '/billing',    unread: false },
  { id: 'n5', type: 'ticket',   icon: <MessageSquare size={13} />,color: '#f59e0b', title: 'New support ticket', body: 'Harvest Foods — Email footer link is broken',          time: '2d ago',  href: '/tickets',    unread: false },
  { id: 'n6', type: 'deal',     icon: <CheckCircle2 size={13} />, color: '#3b82f6', title: 'Proposal viewed',    body: 'Summit Capital opened your $52,000 proposal',          time: '3d ago',  href: '/proposals',  unread: false },
]

interface HeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick?: () => void
  }
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  const { toggleSidebar } = useUI()
  const { user, logout } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState(NOTIFICATIONS)

  const unreadCount = notifications.filter(n => n.unread).length

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
  }

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-white border-b border-gray-200 sticky top-0 z-20">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0 lg:hidden"
        >
          <Menu size={18} className="text-gray-600" />
        </button>

        <div className="min-w-0">
          <h1
            className="font-bold text-gray-900 tracking-widest uppercase truncate"
            style={{ fontFamily: 'var(--font-heading)', fontSize: '13px' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-0.5 hidden sm:block truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search — expandable on mobile */}
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <Search size={13} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-36"
          />
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Search size={16} className="text-gray-500" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Bell size={16} className="text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-[calc(100vw-2rem)] sm:w-80 max-w-[320px] bg-white rounded-xl border border-gray-200 shadow-xl z-40 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-green-700 hover:text-green-800 font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
                  {notifications.map(n => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => {
                        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x))
                        setNotificationsOpen(false)
                      }}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${n.unread ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Icon badge */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: n.color + '18', color: n.color }}
                      >
                        {n.icon}
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                      </div>
                      {/* Unread dot */}
                      {n.unread && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </Link>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                  <Link
                    href="/tasks"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-green-700 hover:text-green-800 font-medium transition-colors"
                  >
                    View all tasks →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action button */}
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        )}

        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: user?.isAdmin ? '#f59e0b' : '#015035' }}
            >
              {user?.initials || '?'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-gray-900 leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-400">{user?.isAdmin ? '★ Super Admin' : user?.role}</p>
            </div>
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-lg z-40 py-1 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  {user?.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <ShieldCheck size={14} />
                      Admin Panel
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={14} />
                    My Profile
                  </Link>
                  <button
                    onClick={() => { logout(); setUserMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile search bar — expands below */}
      {searchOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 md:hidden flex items-center gap-2 z-10">
          <Search size={15} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search GravHub..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            autoFocus
          />
          <button onClick={() => setSearchOpen(false)}>
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      )}
    </header>
  )
}
