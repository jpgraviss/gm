'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'

type Step = 'loading' | 'invalid' | 'verify' | 'password' | 'profile' | 'waiting' | 'approved'

export default function PortalSetupPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token')
  const emailParam = searchParams.get('email')

  const [step, setStep] = useState<Step>('loading')
  const [email, setEmail] = useState(emailParam ?? '')
  const [error, setError] = useState('')

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!emailParam) {
      requestAnimationFrame(() => setStep('invalid'))
      return
    }
    requestAnimationFrame(() => setEmail(emailParam))
    fetch(`/api/portal-clients/check-approval?email=${encodeURIComponent(emailParam)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setStep('invalid')
        } else if (data.approved) {
          setStep('approved')
        } else if (data.pending) {
          setStep('waiting')
        } else if (data.setupCompleted) {
          setStep('waiting')
        } else {
          setStep('verify')
        }
      })
      .catch(() => setStep('invalid'))
  }, [emailParam, token])

  async function handleVerifyCode() {
    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/portal-clients/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setVerifying(false)
        return
      }
      setStep('password')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setVerifying(false)
  }

  function handlePasswordNext() {
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setStep('profile')
  }

  async function handleCompleteSetup() {
    setCompleting(true)
    setError('')
    try {
      const res = await fetch('/api/portal-clients/complete-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: displayName.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Setup failed')
        setCompleting(false)
        return
      }
      setStep('waiting')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setCompleting(false)
  }

  const checkApproval = useCallback(() => {
    if (!email) return
    fetch(`/api/portal-clients/check-approval?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(data => {
        if (data.approved) {
          setStep('approved')
        }
      })
      .catch(() => {})
  }, [email])

  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(checkApproval, 10000)
    return () => clearInterval(interval)
  }, [step, checkApproval])

  useEffect(() => {
    if (step === 'approved') {
      const timer = setTimeout(() => router.push('/portal'), 3000)
      return () => clearTimeout(timer)
    }
  }, [step, router])

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page-bg)' }}>
      <div className="flex-shrink-0 px-6 py-5 flex items-center justify-center" style={{ background: '#012b1e' }}>
        <div className="text-center">
          <h1 className="text-white font-bold text-lg tracking-widest" style={{ fontFamily: "'Syncopate', sans-serif" }}>
            GRAVISS MARKETING
          </h1>
          <p className="text-white/50 text-[11px] tracking-wider mt-1" style={{ fontFamily: "'Syncopate', sans-serif" }}>
            CLIENT PORTAL
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {step === 'invalid' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Setup Link</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                This setup link is invalid or has expired. Please contact your account manager for a new invitation.
              </p>
            </div>
          )}

          {step === 'verify' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-8 pt-8 pb-0">
                <div className="flex items-center gap-3 mb-1">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex-1 h-1 rounded-full" style={{ background: n === 1 ? '#015035' : '#e5e7eb' }} />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 font-semibold mb-6">STEP 1 OF 3</p>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Verify Your Identity</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter the 6-digit verification code sent to <strong>{email}</strong>.
                </p>
              </div>
              <div className="px-8 pb-8">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center text-2xl font-bold tracking-[0.3em] border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-300"
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleVerifyCode}
                    disabled={code.length !== 6 || verifying}
                    className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    {verifying ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-8 pt-8 pb-0">
                <div className="flex items-center gap-3 mb-1">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex-1 h-1 rounded-full" style={{ background: n <= 2 ? '#015035' : '#e5e7eb' }} />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 font-semibold mb-6">STEP 2 OF 3</p>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Set Your Password</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Create a secure password for your portal account.
                </p>
              </div>
              <div className="px-8 pb-8">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                    />
                  </div>
                  {password.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className={password.length >= 8 ? 'text-emerald-600' : 'text-gray-400'}>At least 8 characters</span>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handlePasswordNext}
                    disabled={password.length < 8 || !confirmPassword}
                    className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'profile' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-8 pt-8 pb-0">
                <div className="flex items-center gap-3 mb-1">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="flex-1 h-1 rounded-full" style={{ background: '#015035' }} />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 font-semibold mb-6">STEP 3 OF 3</p>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Complete Your Profile</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Optional: set a display name for your portal account.
                </p>
              </div>
              <div className="px-8 pb-8">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Display Name <span className="text-gray-400">(optional)</span></label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleCompleteSetup}
                    disabled={completing}
                    className="w-full py-3 text-sm font-bold text-white rounded-xl transition-opacity disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    {completing ? 'Setting up...' : 'Complete Setup'}
                  </button>
                  <button
                    onClick={handleCompleteSetup}
                    disabled={completing}
                    className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'waiting' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#e6f0ec' }}>
                <ShieldCheck size={32} style={{ color: '#015035' }} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Account Setup Complete!</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                An administrator will review and approve your access shortly.
                You&apos;ll receive an email once your account is approved.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span>Checking for approval...</span>
              </div>
            </div>
          )}

          {step === 'approved' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#e6f0ec' }}>
                <CheckCircle size={32} style={{ color: '#015035' }} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">You&apos;re Approved!</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Your portal access has been approved. Redirecting you to your dashboard...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span>Redirecting...</span>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="flex-shrink-0 py-4 text-center border-t border-gray-200 bg-white">
        <p className="text-[11px] text-gray-400">
          &copy; {new Date().getFullYear()} Graviss Marketing. All rights reserved.
        </p>
      </div>
    </div>
  )
}
