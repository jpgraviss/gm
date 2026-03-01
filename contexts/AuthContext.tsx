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
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

// Registered platform users
const USERS: Record<string, { password: string; user: AuthUser }> = {
  'jonathan@gravissmarketing.com': {
    password: 'Gr@v!ss32603',
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
  'jgraviss@gravissmarketing.com': {
    password: '3asy2c0nn3ct',
    user: {
      id: 'u7',
      email: 'jgraviss@gravissmarketing.com',
      name: 'J. Graviss',
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

  const loginWithGoogle = async (credential: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      // Decode JWT payload (signature verification handled server-side in M2 with Supabase)
      const payloadB64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(payloadB64)) as {
        email: string; name: string; picture?: string; sub: string
      }
      const email = payload.email.toLowerCase()

      // Match a known registered user first
      const entry = USERS[email]
      if (entry) {
        const authedUser: AuthUser = { ...entry.user, avatar: payload.picture }
        localStorage.setItem('gravhub_session', JSON.stringify(authedUser))
        setUser(authedUser)
        return { ok: true }
      }

      // Allow any @gravissmarketing.com Google Workspace account
      if (email.endsWith('@gravissmarketing.com')) {
        const initials = payload.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        const newUser: AuthUser = {
          id: `google_${payload.sub}`,
          email: payload.email,
          name: payload.name,
          role: 'Team Member',
          initials,
          unit: 'Delivery/Operations',
          isAdmin: false,
          avatar: payload.picture,
        }
        localStorage.setItem('gravhub_session', JSON.stringify(newUser))
        setUser(newUser)
        return { ok: true }
      }

      return { ok: false, error: 'Access is restricted to Graviss Marketing team members.' }
    } catch {
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }

  const logout = () => {
    localStorage.removeItem('gravhub_session')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
