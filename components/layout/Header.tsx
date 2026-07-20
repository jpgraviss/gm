'use client'

import { useState, useEffect } from 'react'
import { Bell, Search, Plus, Menu, LogOut, ShieldCheck, User, CheckCircle2, AlertCircle, FileText, DollarSign, RefreshCw, MessageSquare, Moon, Sun, Phone, StickyNote, CalendarDays } from 'lucide-react'
import { useUI } from '@/contexts/UIContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import Link from 'next/link'

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  call:     <Phone size={13} />,
  email:    <MessageSquare size={13} />,
  meeting:  <CalendarDays size={13} />,
  note:     <StickyNote size={13} />,
  task:     <CheckCircle2 size={13} />,
  deal:     <DollarSign size={13} />,
  contract: <FileText size={13} />,
  invoice:  <DollarSign size={13} />,
  proposal: <FileText size={13} />,
}

interface Notification {
  id: string
  type: string
  color: string
  title: string
  body: string
  time: string
  href: string
  unread: boolean
}

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
  const { theme, toggleTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : [])
      .then((data: Notification[]) => setNotifications(data))
      .catch(() => {})
  }, [])

  const unreadCount = notifications.filter(n => n.unread).length

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
  }

  function openCommandPalette() {
    window.dispatchEvent(new Event('gravhub:open-command-palette'))
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
        {/* Search — expandable on mobile. Both inputs just open the real
            search (CommandPalette, Cmd+K) rather than being a second,
            parallel search implementation. */}
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <Search size={13} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            readOnly
            onFocus={e => { e.target.blur(); openCommandPalette() }}
            onClick={openCommandPalette}
            className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-36 cursor-pointer"
          />
        </div>
        <button
          onClick={openCommandPalette}
          className="md:hidden p-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Search size={16} className="text-gray-500" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-50 transition-colors"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={16} className="text-gray-500" /> : <Sun size={16} className="text-gray-400" />}
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
                        {NOTIF_ICONS[n.type] ?? <AlertCircle size={13} />}
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
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
                  <Link
                    href="/tasks"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-green-700 hover:text-green-800 font-medium transition-colors"
                  >
                    View all tasks →
                  </Link>
                  <Link
                    href="/settings?tab=notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  >
                    <Bell size={11} />
                    Preferences
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

    </header>
  )
}
