'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

/**
 * Magic-link + OAuth callback page.
 *
 * Handles three session-delivery formats:
 *   1. Implicit flow — #access_token=... in URL fragment (default)
 *   2. PKCE flow — ?code=... in URL query (fallback via exchangeCodeForSession)
 *   3. Already-established session — page refresh after sign-in
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verifying your sign-in link…')

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabaseClient()

    async function resolveProfileAndRedirect(email: string) {
      if (cancelled) return
      setStatus('Loading your profile…')
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          if (data.user?.userType === 'client') {
            router.replace('/client')
          } else {
            router.replace('/')
          }
          return
        }
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'We could not find your account. Please contact your administrator.')
      } catch {
        if (!cancelled) setError('Network error while loading your profile. Please try again.')
      }
    }

    // 1. Subscribe to auth state changes (implicit flow + OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' && session?.user?.email) {
        await resolveProfileAndRedirect(session.user.email.toLowerCase())
      }
    })

    // 2. Manual PKCE code exchange for ?code=... URLs
    async function handlePkceCode() {
      const search = new URLSearchParams(window.location.search)
      const code = search.get('code')
      const codeError = search.get('error_description') || search.get('error')
      if (codeError) {
        setError(codeError)
        return
      }
      if (!code) return

      try {
        const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeErr) {
          setError(
            `Sign-in link expired or invalid (${exchangeErr.message}). ` +
            'Request a new link on the login page.',
          )
          return
        }
        if (data?.session?.user?.email) {
          await resolveProfileAndRedirect(data.session.user.email.toLowerCase())
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to verify sign-in link')
      }
    }

    // 3. Already-established session + timeout fallback
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (session?.user?.email) {
        await resolveProfileAndRedirect(session.user.email.toLowerCase())
        return
      }
      await handlePkceCode()

      setTimeout(() => {
        if (cancelled) return
        supabase.auth.getSession().then(({ data }) => {
          if (cancelled) return
          if (!data.session) {
            setError((prev) => prev || 'Sign-in link expired or your browser blocked cookies. Request a new link.')
          }
        }).catch(() => {/* non-fatal */})
      }, 6000)
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to check session')
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router])

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
              Signing you in...
            </h2>
            <p className="text-gray-400 text-sm">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
