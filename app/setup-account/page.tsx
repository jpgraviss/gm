'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Lock, Camera, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { GravissGMark } from '@/components/ui/GravissGMark'

type Step = 'verify' | 'password' | 'photo' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'verify', label: 'Verify' },
  { key: 'password', label: 'Password' },
  { key: 'photo', label: 'Photo' },
]

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.key === current)
  const done = current === 'done'
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const isActive = i === idx
        const isComplete = done || i < idx
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                style={{
                  background: isComplete ? '#015035' : isActive ? '#015035' : '#e5e7eb',
                  color: isComplete || isActive ? '#fff' : '#9ca3af',
                }}
              >
                {isComplete ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: isActive ? '#015035' : '#9ca3af' }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-12 h-px mb-4" style={{ background: i < idx || done ? '#015035' : '#e5e7eb' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SetupAccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenParam = searchParams.get('token')
  const emailParam = searchParams.get('email')

  const [step, setStep] = useState<Step>('verify')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [waitingForApproval, setWaitingForApproval] = useState(false)

  useEffect(() => {
    if (!emailParam) {
      requestAnimationFrame(() => {
        setError('Invalid setup link. Please use the link from your invitation email.')
        setValidating(false)
      })
      return
    }
    requestAnimationFrame(() => setValidating(false))
  }, [tokenParam, emailParam])

  function handleCodeChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    if (value.length > 1) {
      const digits = value.split('').slice(0, 6)
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d
      })
      setCode(newCode)
      const nextIdx = Math.min(index + digits.length, 5)
      inputRefs.current[nextIdx]?.focus()
      return
    }
    newCode[index] = value
    setCode(newCode)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function handleVerify() {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit code')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, code: fullCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setLoading(false)
        return
      }

      setWaitingForApproval(true)
      pollApproval()
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  function pollApproval() {
    // Polls a public, unauthenticated status endpoint — at this point the
    // new hire has no session yet (only an email + code), so an
    // authenticated endpoint like GET /api/team-members would always 401
    // here and leave them stuck at "AWAITING APPROVAL" forever.
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/team-members/check-approval?email=${encodeURIComponent(emailParam ?? '')}`)
        if (!res.ok) return
        const status = await res.json()

        if (status.approved) {
          clearInterval(interval)
          setWaitingForApproval(false)
          setStep('password')
        } else if (status.denied) {
          clearInterval(interval)
          setWaitingForApproval(false)
          setError('Your account setup was denied by an administrator.')
        }
      } catch { /* retry on next interval */ }
    }, 3000)

    return () => clearInterval(interval)
  }

  async function handleSetPassword() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParam,
          code: code.join(''),
          password,
          avatarUrl: photoPreview,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to set password')
        setLoading(false)
        return
      }

      setStep('photo')
    } catch {
      setError('Network error. Please try again.')
    }
    setLoading(false)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    setError('')
  }

  async function handleFinish() {
    setLoading(true)

    if (photoPreview) {
      try {
        await fetch('/api/auth/setup-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailParam, code: code.join(''), password, avatarUrl: photoPreview }),
        })
      } catch { /* non-critical */ }
    }

    setStep('done')
    setLoading(false)

    setTimeout(() => router.push('/team-login'), 2500)
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF3EA' }}>
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: '#015035' }} />
          <span className="text-sm text-gray-500">Validating setup link...</span>
        </div>
      </div>
    )
  }

  if (!emailParam) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF3EA' }}>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm max-w-md w-full mx-4 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-50">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
            INVALID LINK
          </h2>
          <p className="text-sm text-gray-500 mb-4">This setup link is invalid or has expired. Please contact your administrator for a new invitation.</p>
          <button
            onClick={() => router.push('/team-login')}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-xl"
            style={{ background: '#015035' }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#FFF3EA' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <GravissGMark size={36} />
          <span className="text-gray-900 text-base font-bold tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>GRAVHUB</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {step !== 'done' && <StepIndicator current={step} />}

          {step === 'verify' && !waitingForApproval && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
                  <Shield size={24} style={{ color: '#015035' }} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                  VERIFY YOUR IDENTITY
                </h2>
                <p className="text-sm text-gray-500">
                  Enter the 6-digit code sent to <strong>{emailParam}</strong>
                </p>
              </div>

              <div className="flex justify-center gap-2 mb-6">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className="w-11 h-13 text-center text-xl font-bold border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:border-[#015035] focus:bg-white transition-colors"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || code.join('').length !== 6}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying...</>
                ) : (
                  <>Verify Code <ArrowRight size={15} /></>
                )}
              </button>
            </>
          )}

          {step === 'verify' && waitingForApproval && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#fef3c7' }}>
                <Loader2 size={24} className="animate-spin text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                AWAITING APPROVAL
              </h2>
              <p className="text-sm text-gray-500 mb-2">
                Your code has been verified. An administrator needs to approve your account setup.
              </p>
              <p className="text-xs text-gray-400">
                This page will update automatically once approved.
              </p>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl mt-4">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {step === 'password' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
                  <Lock size={24} style={{ color: '#015035' }} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                  SET YOUR PASSWORD
                </h2>
                <p className="text-sm text-gray-500">
                  Choose a secure password for your account
                </p>
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-9 pr-12 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-[#015035] focus:bg-white transition-colors"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-[11px] text-amber-600 mt-1">Minimum 8 characters required</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 bg-gray-50 focus:outline-none focus:border-[#015035] focus:bg-white transition-colors"
                    />
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[11px] text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleSetPassword}
                disabled={loading || password.length < 8 || password !== confirmPassword}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Setting password...</>
                ) : (
                  <>Continue <ArrowRight size={15} /></>
                )}
              </button>
            </>
          )}

          {step === 'photo' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
                  <Camera size={24} style={{ color: '#015035' }} />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                  PROFILE PHOTO
                </h2>
                <p className="text-sm text-gray-500">
                  Upload a profile photo (optional)
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#015035] transition-colors overflow-hidden"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={28} className="text-gray-400" />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: '#015035' }}
                >
                  {photoPreview ? 'Change Photo' : 'Choose Photo'}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#015035' }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin" /> Finishing...</>
                  ) : (
                    <>Complete Setup <ArrowRight size={15} /></>
                  )}
                </button>
                {!photoPreview && (
                  <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
                <CheckCircle size={32} style={{ color: '#015035' }} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
                YOU&apos;RE ALL SET
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                Your account has been set up successfully.
              </p>
              <p className="text-xs text-gray-400">
                Redirecting to sign in...
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center mt-5">
          <p className="text-xs text-gray-400">
            GravHub &copy; 2026 &middot; Graviss Marketing
          </p>
        </div>
      </div>
    </div>
  )
}
