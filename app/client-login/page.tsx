'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '667334631499-o7tofbtcbgm17vumqe33q8k5j46s9lp2.apps.googleusercontent.com'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void
          renderButton: (parent: HTMLElement, opts: { theme?: string; size?: string; width?: number | string }) => void
        }
      }
    }
  }
}

export default function ClientLoginPage() {
  const router = useRouter()
  const { user, loading, loginAs } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const gisInit = useRef(false)

  // Redirect already-logged-in clients
  useEffect(() => {
    if (!loading && user && user.userType === 'client') router.replace('/client')
  }, [user, loading, router])

  // Lookup client profile via service-role API (bypasses RLS / timing issues)
  const lookupClient = async (emailAddr: string) => {
    const res = await fetch(`/api/portal-clients/by-email?email=${encodeURIComponent(emailAddr)}`)
    if (!res.ok) return null
    return res.json() as Promise<{ id: string; email: string; name: string; company: string; service: string; access: string }>
  }

  const signInWithProfile = async (emailAddr: string) => {
    const profile = await lookupClient(emailAddr)
    if (!profile) {
      setError('No client account found for this email. Contact your account manager.')
      return false
    }
    // Build an AuthUser and inject it via loginAs (bypasses the RLS-dependent loadProfileByEmail)
    loginAs({
      id:       profile.id,
      email:    profile.email,
      name:     profile.name,
      role:     'Client',
      initials: profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL',
      unit:     'Client',
      isAdmin:  false,
      userType: 'client',
      company:  profile.company,
    })
    // Record last login
    fetch(`/api/portal-clients/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastLogin: new Date().toISOString().split('T')[0], access: 'Active' }),
    }).catch(() => {})
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setError('')
    setSubmitting(true)
    try {
      const supabase = getSupabaseClient()
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })
      if (authErr) { setError('Incorrect email or password.'); setSubmitting(false); return }
      const ok = await signInWithProfile(email.toLowerCase().trim())
      if (ok) router.replace('/client')
    } catch {
      setError('Login failed. Please try again.')
    }
    setSubmitting(false)
  }

  const handleGoogleCredential = useCallback(async ({ credential }: { credential: string }) => {
    setError('')
    try {
      const payloadB64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(payloadB64)) as { email: string; sub: string }
      const supabase = getSupabaseClient()
      const { error: authErr } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential })
        .catch(() => ({ error: new Error('Google auth failed') }))
      if (authErr) {
        // Try signing in with Google via OAuth exchange
        await supabase.auth.signInWithOAuth({ provider: 'google' })
      }
      const ok = await signInWithProfile(payload.email.toLowerCase())
      if (ok) router.replace('/client')
      else setError('No client account found for this Google account. Contact your account manager.')
    } catch {
      setError('Google sign-in failed. Please use email/password instead.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const initGIS = () => {
      if (gisInit.current || !window.google || !googleBtnRef.current) return
      gisInit.current = true
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, auto_select: false })
      window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: googleBtnRef.current.offsetWidth || 360 })
    }
    if (window.google) initGIS()
    else document.getElementById('google-gsi')?.addEventListener('load', initGIS)
  }, [handleGoogleCredential])

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    setSubmitting(true)
    await fetch('/api/email/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    }).catch(() => {})
    setSubmitting(false)
    setMode('sent')
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #012b1e 0%, #015035 100%)' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>G</span>
            </div>
            <span className="text-white text-lg font-bold tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>GRAVISS MARKETING</span>
          </div>
          <p className="text-white/60 text-sm">Client Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {mode === 'sent' ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Mail size={22} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-6">If an account exists for <strong>{forgotEmail}</strong>, a password reset link has been sent.</p>
              <button onClick={() => setMode('login')} className="text-sm font-semibold" style={{ color: '#015035' }}>
                ← Back to login
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleForgot} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    placeholder="your@email.com" autoFocus
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-700"
                  />
                </div>
                <button type="submit" disabled={!forgotEmail || submitting}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: '#015035' }}>
                  {submitting ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => setMode('login')} className="text-sm text-gray-500 hover:text-gray-700">
                  ← Back to login
                </button>
              </form>
            </div>
          ) : (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500 mb-6">Sign in to your client portal</p>

              {/* Google SSO */}
              <div ref={googleBtnRef} className="w-full mb-4" />

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                  </div>
                )}

                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" autoComplete="email" autoFocus
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-700"
                  />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Password" autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-700"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div className="text-right">
                  <button type="button" onClick={() => setMode('forgot')} className="text-xs font-semibold" style={{ color: '#015035' }}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={!email || !password || submitting}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: '#015035' }}>
                  {submitting ? 'Signing in…' : <><span>Sign In</span><ArrowRight size={15} /></>}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Issues accessing your portal? Email{' '}
          <a href="mailto:info@gravissmarketing.com" className="text-white/60 hover:text-white underline">
            info@gravissmarketing.com
          </a>
        </p>
      </div>
    </div>
  )
}
