'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  initials: string
  unit: string
  isAdmin: boolean
  avatar?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

// Registered platform users
const USERS: Record<string, { password: string; user: AuthUser }> = {
  'jonathan@gravissmarketing.com': {
    password: 'Graviss2024!',
    user: {
      id: 'u0',
      email: 'jonathan@gravissmarketing.com',
      name: 'Jonathan Graviss',
      role: 'Super Admin',
      initials: 'JG',
      unit: 'Leadership/Admin',
      isAdmin: true,
    },
  },
  'amanda@gravissmarketing.com': {
    password: 'Amanda123!',
    user: {
      id: 'u6',
      email: 'amanda@gravissmarketing.com',
      name: 'Amanda Foster',
      role: 'Leadership',
      initials: 'AF',
      unit: 'Leadership/Admin',
      isAdmin: false,
    },
  },
  'sarah@gravissmarketing.com': {
    password: 'Sarah123!',
    user: {
      id: 'u1',
      email: 'sarah@gravissmarketing.com',
      name: 'Sarah Chen',
      role: 'Department Manager',
      initials: 'SC',
      unit: 'Sales',
      isAdmin: false,
    },
  },
  'marcus@gravissmarketing.com': {
    password: 'Marcus123!',
    user: {
      id: 'u2',
      email: 'marcus@gravissmarketing.com',
      name: 'Marcus Webb',
      role: 'Team Member',
      initials: 'MW',
      unit: 'Sales',
      isAdmin: false,
    },
  },
  'priya@gravissmarketing.com': {
    password: 'Priya123!',
    user: {
      id: 'u4',
      email: 'priya@gravissmarketing.com',
      name: 'Priya Patel',
      role: 'Department Manager',
      initials: 'PP',
      unit: 'Delivery/Operations',
      isAdmin: false,
    },
  },
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gravhub_session')
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch {
      // ignore parse errors
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const entry = USERS[email.toLowerCase().trim()]
    if (!entry) {
      return { ok: false, error: 'No account found with that email address.' }
    }
    if (entry.password !== password) {
      return { ok: false, error: 'Incorrect password. Please try again.' }
    }
    localStorage.setItem('gravhub_session', JSON.stringify(entry.user))
    setUser(entry.user)
    return { ok: true }
  }

  const logout = () => {
    localStorage.removeItem('gravhub_session')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
