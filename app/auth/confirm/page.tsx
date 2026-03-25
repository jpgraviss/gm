'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'

/**
 * Magic link callback page.
 * Supabase redirects here with token_hash and type in the URL hash fragment.
 * We exchange the token for a session, then redirect to the appropriate dashboard.
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = getSupabaseClient()

    // Supabase puts the tokens in the URL hash fragment (#access_token=...&type=magiclink)
    // The Supabase client auto-detects this on getSession() after onAuthStateChange fires.
    // We just need to wait for the session to be established.

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Check if staff or client to redirect appropriately
        const email = session.user.email.toLowerCase()

        try {
          const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.user?.userType === 'client') {
              router.replace('/client')
            } else {
              router.replace('/')
            }
          } else {
            // Profile not found — redirect to login
            router.replace('/login')
          }
        } catch {
          router.replace('/')
        }
        return
      }
    })

    // Also handle the case where session is already established (e.g., page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Session already exists — the onAuthStateChange will handle redirect
        return
      }
      // No session and no token — show error after a brief wait
      setTimeout(() => {
        setError('Invalid or expired sign-in link. Please request a new one.')
      }, 3000)
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f5f7', fontFamily: 'var(--font-body)' }}>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm max-w-sm w-full text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              Link Expired
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
            <p className="text-gray-400 text-sm">Please wait while we verify your link.</p>
          </>
        )}
      </div>
    </div>
  )
}
