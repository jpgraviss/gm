'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import type { AppSettings } from '@/lib/settings'

const SettingsContext = createContext<AppSettings | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    fetch('/api/settings/resolved')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data) })
      .catch(() => {})
  }, [])

  return <SettingsContext value={settings}>{children}</SettingsContext>
}

export function useSettings(): AppSettings | null {
  return useContext(SettingsContext)
}
