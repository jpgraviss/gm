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
  mustChangePassword: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }>
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  changePassword: (email: string, newPassword: string) => void
  addUser: (params: { name: string; email: string; role: AuthUser['role']; unit: AuthUser['unit']; password: string }) => void
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
 * Uses the client-side authenticated session so it works from the browser.
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
      .eq('email', email)
      .single()
    if (selErr) return { __diagError: `select: ${selErr.message}` }
    return row ? rowToAuthUser(row) : { __diagError: 'select returned no row' }
  } catch (e) { return { __diagError: `exception: ${e instanceof Error ? e.message : String(e)}` } }
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
        .eq('email', email.toLowerCase())
        .single()
      if (teamData) return rowToAuthUser(teamData, avatar)

      const { data: clientData } = await supabase
        .from('portal_clients')
        .select('*')
        .eq('email', email.toLowerCase())
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        let profile = await loadProfileByEmail(session.user.email)
        // Auto-provision on session restore for @gravissmarketing.com users
        if (!profile && session.user.email.toLowerCase().endsWith('@gravissmarketing.com')) {
          const result = await autoProvisionTeamMember(supabase, session.user.email.toLowerCase())
          if (result && !('__diagError' in result)) profile = result
        }
        if (profile) {
          setUser(profile)
          if (profile.userType === 'staff') fetchMembers()
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

      let profile = await loadProfileByEmail(email)

      // Auto-provision team_members row for @gravissmarketing.com users
      if (!profile && email.toLowerCase().trim().endsWith('@gravissmarketing.com')) {
        const result = await autoProvisionTeamMember(supabase, email.toLowerCase().trim())
        if (result && '__diagError' in result) {
          return { ok: false, error: `Auto-provision failed: ${result.__diagError}` }
        }
        profile = result
      }

      if (!profile) return { ok: false, error: 'No account found for this email. Contact your administrator.' }

      setUser(profile)
      if (profile.userType === 'staff') fetchMembers()
      // Record last login date for portal clients
      if (profile.userType === 'client' && profile.id) {
        const today = new Date().toISOString().split('T')[0]
        fetch(`/api/portal-clients/${profile.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastLogin: today, access: 'Active' }),
        }).catch(() => {})
      }
      try { sessionStorage.setItem('gravhub_login_at', Date.now().toString()) } catch {/* ignore */}
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      return { ok: false, error: msg }
    }
  }

  const loginWithGoogle = async (credential: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      // Verify the Google credential server-side and look up the user profile
      // in both team_members (staff) and portal_clients (clients).
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
      if (profile.userType === 'staff') fetchMembers()
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
      user, loading, mustChangePassword: false,
      login, loginWithGoogle, logout,
      changePassword, addUser,
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
