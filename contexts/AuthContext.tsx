'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { teamMembers as defaultTeamMembers } from '@/lib/data'
import type { TeamMember } from '@/lib/types'

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

interface DynamicUser {
  password: string
  mustChangePassword: boolean
  user: AuthUser
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  mustChangePassword: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  changePassword: (email: string, newPassword: string) => void
  addUser: (params: { name: string; email: string; role: AuthUser['role']; unit: AuthUser['unit']; password: string }) => void
  // Gmail
  gmailToken: string | null
  gmailEmail: string | null
  connectGmail: () => void
  disconnectGmail: () => void
  // Team members
  members: TeamMember[]
}

// Hardcoded base users (Graviss Marketing leadership)
const BASE_USERS: Record<string, { password: string; mustChangePassword: boolean; user: AuthUser }> = {
  'jonathan@gravissmarketing.com': {
    password: 'Gr@v!ss32603',
    mustChangePassword: false,
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
    password: '3asy2c0nn3xt',
    mustChangePassword: false,
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
    mustChangePassword: false,
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
    mustChangePassword: false,
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
    mustChangePassword: false,
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
    mustChangePassword: false,
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

const DYNAMIC_USERS_KEY = 'gravhub_dynamic_users'
const SESSION_KEY = 'gravhub_session'
const MUST_CHANGE_KEY = 'gravhub_must_change_pw'

function loadDynamicUsers(): Record<string, DynamicUser> {
  try {
    const raw = localStorage.getItem(DYNAMIC_USERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveDynamicUsers(users: Record<string, DynamicUser>) {
  localStorage.setItem(DYNAMIC_USERS_KEY, JSON.stringify(users))
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [gmailToken, setGmailToken] = useState<string | null>(null)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [members, setMembers] = useState<TeamMember[]>(defaultTeamMembers)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) setUser(JSON.parse(stored))
      const mustChange = localStorage.getItem(MUST_CHANGE_KEY)
      if (mustChange === 'true') setMustChangePassword(true)
      const storedGmailEmail = localStorage.getItem('gravhub_gmail_email')
      if (storedGmailEmail) setGmailEmail(storedGmailEmail)
    } catch {/* ignore */}
    setLoading(false)
  }, [])

  function getAllUsers() {
    return { ...BASE_USERS, ...loadDynamicUsers() }
  }

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }> => {
    const all = getAllUsers()
    const entry = all[email.toLowerCase().trim()]
    if (!entry) return { ok: false, error: 'No account found with that email address.' }
    if (entry.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' }

    localStorage.setItem(SESSION_KEY, JSON.stringify(entry.user))
    setUser(entry.user)

    if (entry.mustChangePassword) {
      localStorage.setItem(MUST_CHANGE_KEY, 'true')
      setMustChangePassword(true)
      return { ok: true, mustChangePassword: true }
    }

    localStorage.removeItem(MUST_CHANGE_KEY)
    setMustChangePassword(false)
    return { ok: true }
  }

  const loginWithGoogle = async (credential: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const payloadB64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(payloadB64)) as {
        email: string; name: string; picture?: string; sub: string
      }
      const email = payload.email.toLowerCase()

      const all = getAllUsers()
      const entry = all[email]
      if (entry) {
        const authedUser: AuthUser = { ...entry.user, avatar: payload.picture }
        localStorage.setItem(SESSION_KEY, JSON.stringify(authedUser))
        setUser(authedUser)
        return { ok: true }
      }

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
        localStorage.setItem(SESSION_KEY, JSON.stringify(newUser))
        setUser(newUser)
        return { ok: true }
      }

      return { ok: false, error: 'Access is restricted to Graviss Marketing team members.' }
    } catch {
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }

  const changePassword = useCallback((email: string, newPassword: string) => {
    const dynamic = loadDynamicUsers()
    const key = email.toLowerCase().trim()

    if (dynamic[key]) {
      dynamic[key] = { ...dynamic[key], password: newPassword, mustChangePassword: false }
      saveDynamicUsers(dynamic)
    } else if (BASE_USERS[key]) {
      // Store override in dynamic store
      dynamic[key] = { ...BASE_USERS[key], password: newPassword, mustChangePassword: false }
      saveDynamicUsers(dynamic)
    }

    localStorage.removeItem(MUST_CHANGE_KEY)
    setMustChangePassword(false)
  }, [])

  const addUser = useCallback((params: {
    name: string
    email: string
    role: AuthUser['role']
    unit: AuthUser['unit']
    password: string
  }) => {
    const initials = params.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    const newUser: AuthUser = {
      id: `dyn_${Date.now()}`,
      email: params.email,
      name: params.name,
      role: params.role,
      initials,
      unit: params.unit,
      isAdmin: params.role === 'Super Admin',
    }
    const dynamic = loadDynamicUsers()
    dynamic[params.email] = { password: params.password, mustChangePassword: true, user: newUser }
    saveDynamicUsers(dynamic)

    // Add to team members list
    const newMember: TeamMember = {
      id: `tm_${Date.now()}`,
      name: params.name,
      email: params.email,
      role: params.role as TeamMember['role'],
      unit: params.unit as TeamMember['unit'],
      initials,
    }
    setMembers(prev => [...prev, newMember])
  }, [])

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(MUST_CHANGE_KEY)
    localStorage.removeItem('gravhub_gmail_email')
    setUser(null)
    setMustChangePassword(false)
    setGmailToken(null)
    setGmailEmail(null)
  }

  const connectGmail = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    const g = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (cfg: object) => { requestAccessToken: () => void } } } } }).google
    if (!g?.accounts?.oauth2) {
      console.error('Google Identity Services not loaded')
      return
    }

    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) return
        setGmailToken(resp.access_token)
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${resp.access_token}` },
        })
          .then(r => r.json())
          .then((info: { email?: string }) => {
            if (info.email) {
              setGmailEmail(info.email)
              localStorage.setItem('gravhub_gmail_email', info.email)
            }
          })
          .catch(() => {/* non-blocking */})
      },
    })

    tokenClient.requestAccessToken()
  }, [])

  const disconnectGmail = useCallback(() => {
    const g = (window as unknown as { google?: { accounts?: { oauth2?: { revoke: (token: string, cb: () => void) => void } } } }).google
    if (gmailToken && g?.accounts?.oauth2) {
      g.accounts.oauth2.revoke(gmailToken, () => {/* revoked */})
    }
    setGmailToken(null)
    setGmailEmail(null)
    localStorage.removeItem('gravhub_gmail_email')
  }, [gmailToken])

  return (
    <AuthContext.Provider value={{
      user, loading, mustChangePassword,
      login, loginWithGoogle, logout,
      changePassword, addUser,
      gmailToken, gmailEmail, connectGmail, disconnectGmail,
      members,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
