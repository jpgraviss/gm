'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'

// Minimal type shim for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string
              size?: string
              width?: number | string
              text?: string
              shape?: string
              logo_alignment?: string
            }
          ) => void
          prompt: (callback?: (notification: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

export default function LoginPage() {
  const { login, loginWithGoogle, user, loading, mustChangePassword, changePassword } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'forgot' | 'sent' | 'change-password'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const gisInitialized = useRef(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  // Stable callback ref so the GIS callback doesn't go stale
  const handleGoogleCredential = useCallback(async ({ credential }: { credential: string }) => {
    setGoogleLoading(true)
    setError('')
    const result = await loginWithGoogle(credential)
    setGoogleLoading(false)
    if (result.ok) {
      router.push('/')
    } else {
      setError(result.error ?? 'Google sign-in failed. Ensure you are using a @gravissmarketing.com account.')
    }
  }, [loginWithGoogle, router])

  // Initialize Google Identity Services and render the official button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const initGIS = () => {
      if (gisInitialized.current || !window.google || !googleBtnRef.current) return
      gisInitialized.current = true

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      // Render the official Google button inside our container div
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 400,
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
    }

    if (window.google) {
      initGIS()
    } else {
      const script = document.getElementById('google-gsi')
      script?.addEventListener('load', initGIS)
      return () => script?.removeEventListener('load', initGIS)
    }
  }, [handleGoogleCredential])

  // If user is logged in and needs to change password, show that mode
  useEffect(() => {
    if (!loading && user && mustChangePassword) {
      setEmail(user.email)
      setMode('change-password')
    }
  }, [user, loading, mustChangePassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setSubmitting(true)
    const result = await login(email, password)
    if (result.ok) {
      if (result.mustChangePassword) {
        setMode('change-password')
        setSubmitting(false)
      } else {
        router.push('/')
      }
    } else {
      setError(result.error ?? 'Login failed.')
      setSubmitting(false)
    }
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    changePassword(email, newPassword)
    router.push('/')
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    setSubmitting(true)
    setError('')
    try {
      await fetch('/api/email/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
    } catch {
      // Fail silently — always show confirmation
    }
    setSubmitting(false)
    setMode('sent')
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Left brand panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ background: '#012b1e' }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#015035' }}>
            <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>G</span>
          </div>
          <span className="text-white text-base font-bold tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>GRAVHUB</span>
        </div>

        {/* Hero */}
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-5"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', lineHeight: 1.15 }}>
            EVERY DOLLAR.<br />EVERY PROJECT.<br />EVERY RENEWAL.
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            GravHub is the unified internal operating system for Graviss Marketing —
            connecting every lead to every renewal with zero gaps.
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-3">
          {[
            'Full revenue lifecycle control',
            'Real-time pipeline & contract tracking',
            'Automated billing & project delivery',
            'Renewal forecasting & retention',
          ].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#015035' }}>
                <span className="text-white text-[9px] font-bold">✓</span>
              </div>
              <span className="text-white/70 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: '#f4f5f7' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#015035' }}>
              <span className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>G</span>
            </div>
            <span className="text-gray-900 text-base font-bold tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>GRAVHUB</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">

            {/* ── Forgot Password: email entry ── */}
            {mode === 'forgot' && (
              <>
                <button
                  onClick={() => { setMode('login'); setError(''); setForgotEmail('') }}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors"
                >
                  ← Back to Sign In
                </button>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-1"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                    RESET PASSWORD
                  </h2>
                  <p className="text-gray-500 text-sm">Enter your email and we'll send a reset link.</p>
                </div>
                <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="you@gravissmarketing.com"
                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                        autoFocus
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !forgotEmail}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: '#015035' }}
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</>
                    ) : (
                      <>Send Reset Link <ArrowRight size={15} /></>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* ── Forgot Password: confirmation ── */}
            {mode === 'sent' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
                  <Mail size={24} style={{ color: '#015035' }} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                  CHECK YOUR EMAIL
                </h2>
                <p className="text-gray-500 text-sm mb-2">
                  If <strong>{forgotEmail}</strong> has a GravHub account, a reset link is on its way.
                </p>
                <p className="text-gray-400 text-xs mb-6">The link expires in 24 hours. Check your spam folder if it doesn't arrive.</p>
                <button
                  onClick={() => { setMode('login'); setForgotEmail('') }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ background: '#015035' }}
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {/* ── Change Password (first login) ── */}
            {mode === 'change-password' && (
              <>
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: '#e6f0ec' }}>
                    <Lock size={20} style={{ color: '#015035' }} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                    SET YOUR PASSWORD
                  </h2>
                  <p className="text-gray-500 text-sm">Your account was created with a temporary password. Please set a new password to continue.</p>
                </div>
                <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">New Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full pl-9 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                        autoFocus
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowNewPw(v => !v)} tabIndex={-1}>
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity mt-1"
                    style={{ background: '#015035' }}
                  >
                    Set Password & Continue <ArrowRight size={15} />
                  </button>
                </form>
              </>
            )}

            {/* ── Normal login ── */}
            {mode === 'login' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-1"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                    SIGN IN
                  </h2>
                  <p className="text-gray-500 text-sm">Access the Graviss Marketing operating system</p>
                </div>

                {/* ── Google Sign-In (official GIS rendered button) ── */}
                <div className="mb-5">
                  {!GOOGLE_CLIENT_ID ? (
                    <div className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-sm">
                      Google Sign-In not configured
                    </div>
                  ) : (
                    <div className="relative w-full">
                      <div ref={googleBtnRef} className="w-full" style={{ minHeight: 44 }} />
                      {googleLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">or sign in with email</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* ── Email/password form ── */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@gravissmarketing.com"
                        className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                        autoComplete="email"
                        autoFocus
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setForgotEmail(email); setError('') }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••"
                        className="w-full pl-9 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                        autoComplete="current-password"
                        disabled={submitting}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => setShowPassword(v => !v)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity mt-1"
                    style={{ background: submitting ? '#6b7280' : '#015035' }}
                  >
                    {submitting ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Signing in...</>
                    ) : (
                      <>Sign In to GravHub <ArrowRight size={15} /></>
                    )}
                  </button>
                </form>
              </>
            )}

          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            GravHub &copy; 2026 · Graviss Marketing · Internal Platform
          </p>
        </div>
      </div>
    </div>
  )
}
