'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { getSupabaseClient, isConfigured } from '@/lib/supabase'
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

const AuthContext = createContext<AuthContextType | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAuthUser(row: any, avatar?: string): AuthUser {
  return {
    id:       row.id,
    email:    row.email,
    name:     row.name,
    role:     row.role,
    initials: row.initials ?? '',
    unit:     row.unit,
    isAdmin:  row.is_admin ?? false,
    avatar,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<AuthUser | null>(null)
  const [loading, setLoading]             = useState(true)
  const [gmailToken, setGmailToken]       = useState<string | null>(null)
  const [gmailEmail, setGmailEmail]       = useState<string | null>(null)
  const [members, setMembers]             = useState<TeamMember[]>([])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch {/* non-blocking */}
  }, [])

  const loadProfileByEmail = useCallback(async (email: string, avatar?: string): Promise<AuthUser | null> => {
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', email.toLowerCase())
        .single()
      return data ? rowToAuthUser(data, avatar) : null
    } catch { return null }
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    const supabase = getSupabaseClient()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const profile = await loadProfileByEmail(session.user.email)
        if (profile) {
          setUser(profile)
          fetchMembers()
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) setUser(null)
    })

    try {
      const storedGmailEmail = localStorage.getItem('gravhub_gmail_email')
      if (storedGmailEmail) setGmailEmail(storedGmailEmail)
    } catch {/* ignore */}

    return () => subscription.unsubscribe()
  }, [fetchMembers, loadProfileByEmail])

  const login = async (email: string, password: string): Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }> => {
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      if (error) return { ok: false, error: 'Incorrect email or password.' }

      const profile = await loadProfileByEmail(email)
      if (!profile) return { ok: false, error: 'No team member profile found. Contact your administrator.' }

      setUser(profile)
      fetchMembers()
      try { sessionStorage.setItem('gravhub_login_at', Date.now().toString()) } catch {/* ignore */}
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      return { ok: false, error: msg }
    }
  }

  const loginWithGoogle = async (credential: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const payloadB64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(payloadB64)) as {
        email: string; name: string; picture?: string; sub: string
      }
      const email = payload.email.toLowerCase()

      if (!email.endsWith('@gravissmarketing.com')) {
        return { ok: false, error: 'Access is restricted to Graviss Marketing team members.' }
      }

      // Use the API route (service role) so RLS doesn't block unauthenticated reads
      const res = await fetch('/api/team-members')
      const members: { email: string }[] = res.ok ? await res.json() : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = members.find((m: any) => m.email?.toLowerCase() === email)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = row ? rowToAuthUser(row as any, payload.picture) : null
      if (!profile) return { ok: false, error: 'No team member profile found. Contact your administrator.' }

      setUser(profile)
      fetchMembers()
      try { sessionStorage.setItem('gravhub_login_at', Date.now().toString()) } catch {/* ignore */}
      return { ok: true }
    } catch {
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }

  const changePassword = useCallback(async (_email: string, newPassword: string) => {
    const supabase = getSupabaseClient()
    await supabase.auth.updateUser({ password: newPassword })
  }, [])

  const addUser = useCallback(async (params: {
    name: string
    email: string
    role: AuthUser['role']
    unit: AuthUser['unit']
    password: string
  }) => {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, tempPassword: params.password }),
    })
    await fetchMembers()
  }, [fetchMembers])

  const logout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    setUser(null)
    setGmailToken(null)
    setGmailEmail(null)
    try { localStorage.removeItem('gravhub_gmail_email') } catch {/* ignore */}
    try { sessionStorage.removeItem('gravhub_login_at') } catch {/* ignore */}
  }

  const connectGmail = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '667334631499-o7tofbtcbgm17vumqe33q8k5j46s9lp2.apps.googleusercontent.com'
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
              try { localStorage.setItem('gravhub_gmail_email', info.email) } catch {/* ignore */}
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
    try { localStorage.removeItem('gravhub_gmail_email') } catch {/* ignore */}
  }, [gmailToken])

  return (
    <AuthContext.Provider value={{
      user, loading, mustChangePassword: false,
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
