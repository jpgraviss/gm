'use client'

import { useEffect, useState, useRef, Suspense, type PointerEvent as ReactPointerEvent } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import { useSettings } from '@/lib/useSettings'
import Sidebar from './Sidebar'
import AssistantPanel from '@/components/ai/AssistantPanel'
import CommandPalette from '@/components/ui/CommandPalette'
import { ShieldAlert, X, Sparkles } from 'lucide-react'
import PushNotificationBanner from '@/components/ui/PushNotificationBanner'
import PageLoadingOverlay from './PageLoadingOverlay'

// /setup-account (staff onboarding) and /portal/setup + /portal/auth/verify
// (client onboarding) are the actual pages every real invite email links
// to (see app/api/email/invite, app/api/email/portal-invite,
// app/api/portal-clients/invite) — a brand-new invitee has no session yet,
// so leaving these off this list means the redirect effect below bounces
// them to /login before the token/code-verification UI ever renders,
// breaking every real onboarding link.
const PUBLIC_ROUTES = ['/login', '/team-login', '/setup-account', '/portal/setup', '/portal/auth/verify']

// Pages restricted to specific units. Admins (isAdmin=true) always have full access.
// If a route prefix is listed, users whose unit is NOT in the allowed list get redirected to /.
const UNIT_RESTRICTED: { prefix: string; allowedUnits: string[] }[] = [
  { prefix: '/proposals',   allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
  { prefix: '/contracts',   allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
  { prefix: '/billing',     allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
  { prefix: '/reports',     allowedUnits: ['Leadership/Admin', 'Billing/Finance', 'Sales'] },
  { prefix: '/automation',  allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
  { prefix: '/portal',      allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
  { prefix: '/settings',    allowedUnits: ['Leadership/Admin', 'Billing/Finance'] },
  { prefix: '/admin',       allowedUnits: [] }, // handled separately by adminOnly
]

// Settings sub-routes that are open to all authenticated users
const SETTINGS_OPEN_ROUTES = ['/settings/calendar']

function isRouteAllowed(pathname: string, user: { isAdmin: boolean; unit: string } | null): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  if (SETTINGS_OPEN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) return true
  const match = UNIT_RESTRICTED.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
  if (!match) return true
  return match.allowedUnits.includes(user.unit)
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, impersonatedBy, exitImpersonation } = useAuth()
  const { sidebarOpen, closeSidebar } = useUI()
  const settings = useSettings()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Draggable AI Assistant FAB position — previously hardcoded to a fixed
  // corner with no way to move it. null = default bottom-right corner
  // (via CSS); once dragged, an explicit {x,y} takes over and persists
  // across sessions/devices via localStorage.
  const FAB_SIZE = 48
  const FAB_STORAGE_KEY = 'gravhub-assistant-fab-pos'
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null)
  const [fabDragging, setFabDragging] = useState(false)
  const fabDragMoved = useRef(false)
  const fabDragOffset = useRef({ x: 0, y: 0 })

  function clampFabPos(pos: { x: number; y: number }): { x: number; y: number } {
    const margin = 8
    const maxX = window.innerWidth - FAB_SIZE - margin
    const maxY = window.innerHeight - FAB_SIZE - margin
    return {
      x: Math.min(Math.max(margin, pos.x), Math.max(margin, maxX)),
      y: Math.min(Math.max(margin, pos.y), Math.max(margin, maxY)),
    }
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(FAB_STORAGE_KEY)
    if (!saved) return
    try {
      setFabPos(clampFabPos(JSON.parse(saved)))
    } catch { /* ignore corrupt saved position */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A saved position can end up off-screen after a viewport resize (window
  // resize, device rotation) — re-clamp whenever that happens, not just on
  // initial load.
  useEffect(() => {
    function handleResize() {
      setFabPos(prev => (prev ? clampFabPos(prev) : prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFabPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    fabDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    fabDragMoved.current = false
    setFabDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleFabPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!fabDragging) return
    fabDragMoved.current = true
    setFabPos(clampFabPos({ x: e.clientX - fabDragOffset.current.x, y: e.clientY - fabDragOffset.current.y }))
  }

  function handleFabPointerUp() {
    setFabDragging(false)
    setFabPos(prev => {
      if (prev) window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(prev))
      return prev
    })
  }

  function handleFabClick() {
    // A drag ends with a pointerup, which also fires a click — only treat
    // it as "open the assistant" when the pointer never actually moved.
    if (fabDragMoved.current) {
      fabDragMoved.current = false
      return
    }
    setAssistantOpen(true)
  }

  // /go/* routes are public — clients access booking pages, forms, and funnels without logging in
  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/book/') || pathname.startsWith('/unsubscribe/') || pathname.startsWith('/go/') 
  // Inject brand CSS variables from shared settings (no duplicate fetch)
  useEffect(() => {
    const branding = settings?.branding
    if (branding?.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor)
    }
    if (branding?.secondaryColor) {
      document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor)
    }
  }, [settings])

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic) {
      router.replace('/login')
    } else if (user && pathname === '/login') {
      router.replace(user.userType === 'client' ? '/client' : '/')
    } else if (user && pathname === '/team-login') {
      router.replace(user.userType === 'client' ? '/client' : '/')
    } else if (user && user.userType === 'client' && pathname !== '/client') {
      router.replace('/client')
    } else if (user && !isPublic && !isRouteAllowed(pathname, user)) {
      router.replace('/')
    }
  }, [user, loading, isPublic, router, pathname])

  // Close mobile sidebar on route change
  useEffect(() => {
    closeSidebar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--page-bg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#015035', borderTopColor: 'transparent' }}
          />
          <p
            className="text-xs font-semibold tracking-widest text-gray-400"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            LOADING GRAVHUB...
          </p>
        </div>
      </div>
    )
  }

  // Public routes — no shell
  if (isPublic) return <>{children}</>

  // Not authenticated — returning null while redirect runs
  if (!user) return null

  // Client users — no sidebar, bare shell
  if (user.userType === 'client') {
    return (
      <main className="flex min-h-screen flex-col" style={{ background: 'var(--page-bg)' }}>
        <Suspense fallback={null}><PageLoadingOverlay /></Suspense>
        {children}
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}><PageLoadingOverlay /></Suspense>
      <CommandPalette />
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        className={`
          fixed top-0 left-0 z-50 h-full transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto lg:h-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-x-hidden"
        style={{ background: 'var(--page-bg)' }}
      >
        <PushNotificationBanner />
        {impersonatedBy && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 flex-shrink-0" style={{ background: '#7c3aed', color: '#fff' }}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert size={15} />
              <span>Super Admin view — logged in as <strong>{user?.name}</strong> ({user?.role})</span>
              <span className="text-purple-200 text-xs font-normal ml-1">· Your session is still active as {impersonatedBy.name}</span>
            </div>
            <button
              onClick={exitImpersonation}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <X size={12} /> Exit — Return as {impersonatedBy.name}
            </button>
          </div>
        )}
        {children}
      </main>

      {/* AI Assistant FAB — draggable; position persists in localStorage */}
      {!assistantOpen && (
        <button
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          onClick={handleFabClick}
          className={`fixed z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 touch-none ${fabDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={
            fabPos
              ? { left: fabPos.x, top: fabPos.y, background: '#015035' }
              : { bottom: '1.5rem', right: '1.5rem', background: '#015035' }
          }
          title="Open AI Assistant (drag to move)"
        >
          <Sparkles size={20} className="text-white" />
        </button>
      )}

      {/* AI Assistant Panel */}
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  )
}
