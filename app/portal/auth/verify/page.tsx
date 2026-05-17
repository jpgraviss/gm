'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verifying your sign-in link...')

  useEffect(() => {
    if (!token) {
      requestAnimationFrame(() => setError('No token provided. Please request a new sign-in link.'))
      return
    }

    async function verify() {
      try {
        const res = await fetch('/api/portal-clients/magic-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await res.json()

        if (!res.ok || !data.user) {
          setError(data.error || 'Verification failed. Please request a new sign-in link.')
          return
        }

        setStatus('Signing you in...')
        try {
          localStorage.setItem('gravhub_user', JSON.stringify(data.user))
          document.cookie = 'gravhub-auth=1; path=/; max-age=604800; SameSite=Lax'
        } catch {/* ignore */}

        router.replace('/client')
      } catch {
        setError('Network error. Please try again.')
      }
    }

    verify()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f5f7', fontFamily: 'var(--font-body)' }}>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm max-w-sm w-full text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Sign-in failed
            </h2>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              Back to Sign In
            </a>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              Verifying...
            </h2>
            <p className="text-gray-400 text-sm">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function PortalAuthVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f5f7' }}>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
