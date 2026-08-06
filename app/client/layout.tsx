'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useClientCompany, previewFetch } from '@/lib/useClientCompany'
import { formatDate } from '@/lib/utils'
import { Bell, X, LogOut, Eye, ArrowLeft } from 'lucide-react'

// Batch 0 of the /portal → /client merge. This layout owns the chrome shared
// by every /client/* route (the header — company identity, notifications,
// logout). app/client/page.tsx keeps its own internal tab bar + all 7 tabs'
// content, since that's Overview-page-specific, not shared chrome.
//
// CLIENT_ROUTES — extension point for portal capabilities becoming real
// route segments under app/client/* (agreement e-signature, help center,
// SEO strategy, delivery workflow, per-service pages — see the batch plan).
// Renders as a slim nav strip below the header, above whatever the active
// route (page.tsx's tabs, or a sub-route) renders. Batch 1 added the first
// two real routes: app/client/agreement/page.tsx and app/client/help/page.tsx.
// Batch 2 added app/client/approvals/page.tsx (also fixes AUDIT #155 —
// the captured e-signature is now actually persisted, not discarded).
// Batch 3 added app/client/seo/page.tsx and app/client/workflow/page.tsx
// (SEO Strategy, Delivery Timeline — labels match each page's own <h1>).
// Batch 4 added app/client/services/page.tsx (Services hub) + the dynamic
// app/client/services/[slug]/page.tsx per-service pages. Gated to each
// client's own contracted services — see the audit notes in
// app/client/services/page.tsx for what's real, what's dead, and why
// Email Marketing was deliberately not ported (cross-tenant leak risk).
interface ClientRouteLink {
  href: string
  label: string
}
const CLIENT_ROUTES: ClientRouteLink[] = [
  { href: '/client/agreement', label: 'Agreement' },
  { href: '/client/approvals', label: 'Approvals' },
  { href: '/client/services', label: 'Services' },
  { href: '/client/seo', label: 'SEO Strategy' },
  { href: '/client/workflow', label: 'Delivery Timeline' },
  { href: '/client/help', label: 'Help Center' },
]

interface ClientNotification {
  id: string
  title: string
  message?: string
  link?: string
  read: boolean
  createdAt: string
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { company, contactName, isPreview } = useClientCompany()
  // Preview mode has no real client id to fetch notifications for — a
  // previewing admin has no portal_clients row of their own.
  const notificationsClientId = isPreview ? undefined : user?.id

  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Fetch notifications on mount
  useEffect(() => {
    if (!notificationsClientId) return
    fetch(`/api/portal-clients/notifications?clientId=${encodeURIComponent(notificationsClientId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
      .catch(() => {/* non-fatal */})
  }, [notificationsClientId])

  async function markNotificationRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    // AUDIT.md #473 — this used to fire-and-forget with a bare
    // `.catch(() => {})`: no `res.ok` check and no revert on failure, so a
    // failed PATCH left the client believing a notification was read (bell
    // badge cleared) while it silently reappeared unread on next load, with
    // no explanation. Revert the optimistic flip whenever the request
    // doesn't actually succeed.
    try {
      // AUDIT #763 — was a raw fetch(), so an admin previewing a client who
      // clicked a notification marked that client's REAL notification read
      // and they never saw it. previewFetch() blocks it before the network.
      const res = await previewFetch(isPreview, '/api/portal-clients/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], read: true }),
      })
      if (!res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n))
      }
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n))
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#f8fafc' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-sm" style={{ background: '#012b1e' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
            {company?.[0] ?? ''}
          </div>
          <div>
            <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{company}</p>
            <p className="text-white/50 text-[11px]">{user?.service ?? 'Client Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative">
          <div>
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bell size={16} className="text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              // Mobile fix: this used to be positioned relative to the bell's
              // own (narrow) wrapper, which sits to the LEFT of the avatar
              // chip and sign-out/back button in this flex row — so
              // `right-0` anchored to the bell's right edge, not the
              // header's, and the fixed w-80 (320px) panel could overflow
              // off the left edge of a ~375px phone viewport. The `relative`
              // context now lives on the whole icon-group row above instead,
              // so `right-0` anchors to the actual right edge of the header
              // content; max-w-[calc(100vw-1.5rem)] is a safety net so it
              // never exceeds the viewport even on the narrowest phones.
              <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Notifications</p>
                  <button onClick={() => setShowNotifications(false)} className="p-1 rounded hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <button
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-emerald-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                            {n.message && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              {contactName.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-white/80 text-xs font-medium hidden sm:block">{contactName}</span>
          </div>
          {isPreview ? (
            <Link
              href="/admin/portal-management"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white text-xs font-medium"
            >
              <ArrowLeft size={14} /> Back to Admin
            </Link>
          ) : (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white text-xs font-medium"
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
        </div>
      </div>

      {/* Staff "View as Client" preview banner — see lib/useClientCompany.tsx.
          Mirrors the old app/portal/preview/page.tsx banner, now pointing
          back at the real staff destination (Portal Management) instead of
          the deleted /portal/* tree. */}
      {isPreview && (
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100 border-b border-amber-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-amber-600" />
            <span>Previewing client portal as <strong>{company}</strong> — this is what your client sees</span>
          </div>
          <Link
            href="/admin/portal-management"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 transition-colors text-amber-900"
          >
            <ArrowLeft size={12} /> Exit Preview
          </Link>
        </div>
      )}

      {/* Cross-route nav strip — only renders once CLIENT_ROUTES has entries */}
      {CLIENT_ROUTES.length > 0 && (
        <div className="flex-shrink-0 flex gap-4 px-3 sm:px-6 py-2 border-b border-gray-100 bg-white/60 overflow-x-auto">
          {CLIENT_ROUTES.map(route => (
            <Link
              key={route.href}
              href={isPreview ? `${route.href}?company=${encodeURIComponent(company)}` : route.href}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap flex-shrink-0"
            >
              {route.label}
            </Link>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
