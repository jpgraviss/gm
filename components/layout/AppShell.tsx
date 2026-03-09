'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import Sidebar from './Sidebar'

const PUBLIC_ROUTES = ['/login']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { sidebarOpen, closeSidebar } = useUI()
  const router = useRouter()
  const pathname = usePathname()

  // /book/* routes are public — clients book without logging in
  const isPublic = PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/book/')

  useEffect(() => {
    if (loading) return
    if (!user && !isPublic) {
      router.replace('/login')
    } else if (user && isPublic && pathname === '/login') {
      // Only redirect away from login, not from public /book pages
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
        {children}
      </main>
    </div>
  )
}
