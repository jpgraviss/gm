'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

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
  // Gmail
  gmailToken: string | null
  gmailEmail: string | null
  connectGmail: () => void
  disconnectGmail: () => void
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
  const [gmailToken, setGmailToken] = useState<string | null>(null)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gravhub_session')
      if (stored) {
        setUser(JSON.parse(stored))
      }
      const storedGmailEmail = localStorage.getItem('gravhub_gmail_email')
      if (storedGmailEmail) {
        setGmailEmail(storedGmailEmail)
        // Note: access tokens expire — token itself is not persisted; user reconnects if expired
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
    localStorage.removeItem('gravhub_gmail_email')
    setUser(null)
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
        // Fetch the connected email address
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
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout, gmailToken, gmailEmail, connectGmail, disconnectGmail }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
