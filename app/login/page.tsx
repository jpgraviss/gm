'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Shield } from 'lucide-react'

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
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

export default function LoginPage() {
  const { login, loginWithGoogle, user, loading } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const gisInitialized = useRef(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) router.replace('/')
  }, [user, loading, router])

  // Initialize Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const initGIS = () => {
      if (gisInitialized.current || !window.google || !googleBtnRef.current) return
      gisInitialized.current = true

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setGoogleLoading(true)
          setError('')
          const result = await loginWithGoogle(credential)
          setGoogleLoading(false)
          if (result.ok) {
            router.push('/')
          } else {
            setError(result.error ?? 'Google sign-in failed.')
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.clientWidth || 380,
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'center',
      })
    }

    if (window.google) {
      initGIS()
    } else {
      const script = document.getElementById('google-gsi')
      script?.addEventListener('load', initGIS)
      return () => script?.removeEventListener('load', initGIS)
    }
  }, [loginWithGoogle, router])

  const handleGoogleFallback = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured. Contact your administrator to add the NEXT_PUBLIC_GOOGLE_CLIENT_ID.')
    }
  }

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
      router.push('/')
    } else {
      setError(result.error ?? 'Login failed.')
      setSubmitting(false)
    }
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
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1"
                style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                SIGN IN
              </h2>
              <p className="text-gray-500 text-sm">Access the Graviss Marketing operating system</p>
            </div>

            {/* ── Google Sign-In ── */}
            <div className="mb-5">
              {GOOGLE_CLIENT_ID ? (
                /* Google renders its official button here */
                <div
                  ref={googleBtnRef}
                  className="w-full min-h-[44px] flex items-center justify-center"
                  style={{ minHeight: 44 }}
                />
              ) : (
                /* Placeholder button when client ID not yet configured */
                <button
                  type="button"
                  onClick={handleGoogleFallback}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  {googleLoading ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                  )}
                  Sign in with Google
                </button>
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
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Email Address
                </label>
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

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</label>
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
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

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity mt-1"
                style={{ background: submitting ? '#6b7280' : '#015035' }}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>Sign In to GravHub <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            {/* Admin badge */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                <Shield size={14} style={{ color: '#015035' }} className="flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#015035' }}>Admin access enabled</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    jonathan@gravissmarketing.com has full Super Admin privileges.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            GravHub &copy; 2026 · Graviss Marketing · Internal Platform
          </p>
        </div>
      </div>
    </div>
  )
}
