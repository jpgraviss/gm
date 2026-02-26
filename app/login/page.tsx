'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Shield } from 'lucide-react'

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [user, loading, router])

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
      setError(result.error || 'Login failed.')
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Left brand panel — hidden on mobile */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: '#012b1e' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#015035' }}
          >
            <span
              className="text-white text-sm font-bold"
              style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
            >
              G
            </span>
          </div>
          <span
            className="text-white text-base font-bold tracking-widest"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            GRAVHUB
          </span>
        </div>

        {/* Hero text */}
        <div>
          <h1
            className="text-white text-4xl font-bold leading-tight mb-5"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', lineHeight: 1.15 }}
          >
            EVERY DOLLAR.<br />
            EVERY PROJECT.<br />
            EVERY RENEWAL.
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
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#015035' }}
              >
                <span className="text-white text-[9px] font-bold">✓</span>
              </div>
              <span className="text-white/70 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right login panel */}
      <div
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: '#f4f5f7' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#015035' }}
            >
              <span
                className="text-white text-sm font-bold"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                G
              </span>
            </div>
            <span
              className="text-gray-900 text-base font-bold tracking-widest"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              GRAVHUB
            </span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="mb-7">
              <h2
                className="text-xl font-bold text-gray-900 mb-1"
                style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}
              >
                SIGN IN
              </h2>
              <p className="text-gray-500 text-sm">
                Access the Graviss Marketing operating system
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => setError('')}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full pl-9 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    autoComplete="current-password"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
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
                  <>
                    Sign In to GravHub
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Admin badge */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                <Shield size={14} style={{ color: '#015035' }} className="flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#015035' }}>
                    Admin access enabled
                  </p>
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
