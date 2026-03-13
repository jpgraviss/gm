'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import Sidebar from './Sidebar'
import { ShieldAlert, X } from 'lucide-react'

const PUBLIC_ROUTES = ['/login']

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

function isRouteAllowed(pathname: string, user: { isAdmin: boolean; unit: string } | null): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  const match = UNIT_RESTRICTED.find(r => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
  if (!match) return true
  return match.allowedUnits.includes(user.unit)
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, impersonatedBy, exitImpersonation } = useAuth()
  const { sidebarOpen, closeSidebar } = useUI()
  const router = useRouter()
  const pathname = usePathname()

  // /book/* routes are public — clients book without logging in
  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/book/')

  // Inject brand CSS variables from settings
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const branding = data?.branding
        if (branding?.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', branding.primaryColor)
        }
        if (branding?.secondaryColor) {
          document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor)
        }
      })
      .catch(() => {/* use CSS defaults */})
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic) {
      router.replace('/login')
    } else if (user && pathname === '/login') {
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
        style={{ background: '#f4f5f7' }}
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
      <main className="flex min-h-screen flex-col" style={{ background: '#f8fafc' }}>
        {children}
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
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
        style={{ background: '#f4f5f7' }}
      >
        {/* Super Admin impersonation banner */}
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
    </div>
  )
}
