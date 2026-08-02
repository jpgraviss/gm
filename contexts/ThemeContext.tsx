'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { isPublicRoute } from '@/lib/public-routes'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const pathname = usePathname()
  const { user } = useAuth()

  // Public marketing/demo/pre-auth pages (app/demo, /what-we-do, the
  // logged-out "/" homepage, etc.) are styled with hardcoded brand colors,
  // not the app's dark-mode CSS variable system — applying `.dark` there
  // (globals.css's `.dark .bg-white { background: var(--card-bg) }` etc.)
  // turns their white cards near-black while the hardcoded brand text
  // colors go untouched, making them unreadable. Always render these pages
  // in light mode regardless of the visitor's stored/system preference.
  const forceLight = isPublicRoute(pathname ?? '', !!user)

  useEffect(() => {
    if (forceLight) {
      document.documentElement.classList.remove('dark')
      return
    }
    const stored = localStorage.getItem('gravhub-theme') as Theme | null
    const preferred = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(preferred)
    document.documentElement.classList.toggle('dark', preferred === 'dark')
  }, [forceLight])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('gravhub-theme', next)
    if (!forceLight) {
      document.documentElement.classList.toggle('dark', next === 'dark')
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
