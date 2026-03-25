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
  userType: 'staff' | 'client'
  company?: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  addUser: (params: { name: string; email: string; role: AuthUser['role']; unit: AuthUser['unit'] }) => void
  // Super Admin impersonation
  impersonatedBy: AuthUser | null
  loginAs: (member: AuthUser) => void
  exitImpersonation: () => void
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
    unit:     row.unit ?? 'Delivery/Operations',
    isAdmin:  row.is_admin ?? false,
    avatar,
    userType: 'staff',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientToAuthUser(row: any): AuthUser {
  const names = (row.contact ?? '').split(' ')
  return {
    id:       row.id,
    email:    row.email,
    name:     row.contact ?? row.email,
    role:     'Client',
    initials: names.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL',
    unit:     'Client',
    isAdmin:  false,
    userType: 'client',
    company:  row.company,
  }
}

/**
 * Auto-create a team_members row for an authenticated @gravissmarketing.com user
 * who has a Supabase Auth account but no profile row yet.
 */
async function autoProvisionTeamMember(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string,
): Promise<AuthUser | { __diagError: string } | null> {
  try {
    const { data: { user: authUser }, error: userErr } = await supabase.auth.getUser()
    if (userErr) return { __diagError: `getUser: ${userErr.message}` }
    if (!authUser) return { __diagError: 'getUser returned null' }

    const name = (authUser.user_metadata?.name as string) ||
      email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'

    const { error } = await supabase.from('team_members').insert({
      id:       authUser.id,
      name,
      email,
      role:     'Team Member',
      unit:     'Leadership/Admin',
      initials,
      status:   'Active',
      is_admin: false,
    })
    if (error) return { __diagError: `insert: ${error.message} (${error.code})` }

    const { data: row, error: selErr } = await supabase
      .from('team_members')
      .select('*')
      .ilike('email', email)
      .single()
    if (selErr) return { __diagError: `select: ${selErr.message}` }
    return row ? rowToAuthUser(row) : { __diagError: 'select returned no row' }
  } catch (e) { return { __diagError: `exception: ${e instanceof Error ? e.message : String(e)}` } }
}

// ── Auth cookie helpers ────────────────────────────────────────────────────
function setAuthCookie() {
  try { document.cookie = 'gravhub-auth=1; path=/; max-age=604800; SameSite=Lax' } catch {/* SSR guard */}
}
function clearAuthCookie() {
  try { document.cookie = 'gravhub-auth=; path=/; max-age=0; SameSite=Lax' } catch {/* SSR guard */}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<AuthUser | null>(null)
  const [loading, setLoading]             = useState(true)
  const [gmailToken, setGmailToken]       = useState<string | null>(null)
  const [gmailEmail, setGmailEmail]       = useState<string | null>(null)
  const [members, setMembers]             = useState<TeamMember[]>([])
  const [impersonatedBy, setImpersonatedBy] = useState<AuthUser | null>(null)

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch {/* non-blocking */}
  }, [])

  const loadProfileByEmail = useCallback(async (email: string, avatar?: string): Promise<AuthUser | null> => {
    try {
      const supabase = getSupabaseClient()
      const { data: teamData } = await supabase
        .from('team_members')
        .select('*')
        .ilike('email', email.toLowerCase())
        .single()
      if (teamData) return rowToAuthUser(teamData, avatar)

      const { data: clientData } = await supabase
        .from('portal_clients')
        .select('*')
        .ilike('email', email.toLowerCase())
        .single()
      if (clientData) return clientToAuthUser(clientData)

      return null
    } catch { return null }
  }, [])

  useEffect(() => {
    if (!isConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    const supabase = getSupabaseClient()

    // Helper: load profile and set user + cookie
    const restoreProfile = async (email: string, avatar?: string) => {
      let profile = await loadProfileByEmail(email, avatar)
      // Auto-provision on session restore for @gravissmarketing.com users
      if (!profile && email.toLowerCase().endsWith('@gravissmarketing.com')) {
        const result = await autoProvisionTeamMember(supabase, email.toLowerCase())
        if (result && !('__diagError' in result)) profile = result
      }
      if (profile) {
        setUser(profile)
        setAuthCookie()
        try { localStorage.setItem('gravhub_user', JSON.stringify(profile)) } catch {/* ignore */}
        if (profile.userType === 'staff') fetchMembers()
        // Record last login for portal clients
        if (profile.userType === 'client' && profile.id) {
          const today = new Date().toISOString().split('T')[0]
          fetch(`/api/portal-clients/${profile.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastLogin: today, access: 'Active' }),
          }).catch(() => {})
        }
      }
      return profile
    }

    // Also try to restore Google SSO users (no Supabase session, profile in localStorage)
    const tryRestoreGoogleUser = () => {
      try {
        const stored = localStorage.getItem('gravhub_user')
        if (stored) {
          const parsed = JSON.parse(stored) as AuthUser
          if (parsed?.email && parsed?.id) {
            setUser(parsed)
            setAuthCookie()
            if (parsed.userType === 'staff') fetchMembers()
            return true
          }
        }
      } catch {/* ignore */}
      return false
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        await restoreProfile(session.user.email)
      } else {
        // No Supabase session — try restoring a Google SSO user from localStorage
        tryRestoreGoogleUser()
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
        clearAuthCookie()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.email) {
          await restoreProfile(session.user.email)
        }
      }
    })

    try {
      const storedGmailEmail = localStorage.getItem('gravhub_gmail_email')
      if (storedGmailEmail) setGmailEmail(storedGmailEmail)
    } catch {/* ignore */}

    return () => subscription.unsubscribe()
  }, [fetchMembers, loadProfileByEmail])

  const loginWithGoogle = async (credential: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/google-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })

      const data = await res.json()

      if (!res.ok || !data.user) {
        return { ok: false, error: data.error ?? 'Google sign-in failed. Please try again.' }
      }

      const profile: AuthUser = data.user
      setUser(profile)
      setAuthCookie()
      try { localStorage.setItem('gravhub_user', JSON.stringify(profile)) } catch {/* ignore */}
      if (profile.userType === 'staff') fetchMembers()
      try { sessionStorage.setItem('gravhub_login_at', Date.now().toString()) } catch {/* ignore */}
      return { ok: true }
    } catch {
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }

  const addUser = useCallback(async (params: {
    name: string
    email: string
    role: AuthUser['role']
    unit: AuthUser['unit']
  }) => {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    await fetchMembers()
  }, [fetchMembers])

  // Super Admin only: impersonate a team member without changing the Supabase auth session
  const loginAs = useCallback((member: AuthUser) => {
    if (!user || user.role !== 'Super Admin') return
    setImpersonatedBy(user)
    setUser(member)
  }, [user])

  const exitImpersonation = useCallback(() => {
    if (!impersonatedBy) return
    setUser(impersonatedBy)
    setImpersonatedBy(null)
  }, [impersonatedBy])

  const logout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    setUser(null)
    setImpersonatedBy(null)
    setGmailToken(null)
    setGmailEmail(null)
    clearAuthCookie()
    try { localStorage.removeItem('gravhub_user') } catch {/* ignore */}
    try { localStorage.removeItem('gravhub_gmail_email') } catch {/* ignore */}
    try { sessionStorage.removeItem('gravhub_login_at') } catch {/* ignore */}
  }

  const connectGmail = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
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
      user, loading,
      loginWithGoogle, logout,
      addUser,
      impersonatedBy, loginAs, exitImpersonation,
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
