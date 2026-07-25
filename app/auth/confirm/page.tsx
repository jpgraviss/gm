'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, AlertCircle } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Magic-link + OAuth callback page.
 *
 * Handles three session-delivery formats:
 *   1. Implicit flow — #access_token=... in URL fragment (default)
 *   2. PKCE flow — ?code=... in URL query (fallback via exchangeCodeForSession)
 *   3. Already-established session — page refresh after sign-in
 *
 * AUDIT.md #343 — this page makes its own explicit POST /api/auth/session
 * call right after a fresh magic-link sign-in so it can show a 2FA
 * code-entry step inline, the same way the Google Sign-In path already
 * does. The actual 2FA gate lives server-side in
 * app/api/auth/session/route.ts (it checks whether the request already
 * carries a valid signed session cookie for the same email — see that
 * route's comment). The sessionStorage marker set below is only a UX
 * nicety, avoiding a redundant duplicate call/2FA email from
 * contexts/AuthContext.tsx's shared onAuthStateChange listener firing for
 * the same sign-in — see the matching comment there.
 */
const FRESH_LOGIN_FLAG = 'gravhub_magic_link_pending'

export default function AuthConfirmPage() {
  const router = useRouter()
  const { verify2FACode } = useAuth()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verifying your sign-in link…')
  const [twoFAEmail, setTwoFAEmail] = useState('')
  const [twoFACode, setTwoFACode] = useState('')
  const [twoFASubmitting, setTwoFASubmitting] = useState(false)
  const [twoFAError, setTwoFAError] = useState('')

  useEffect(() => {
    // Must be set before anything below can trigger Supabase's SIGNED_IN
    // event (the implicit-flow hash is parsed asynchronously by the client,
    // but as early as possible removes any doubt) — see the flag comment
    // above and in AuthContext.tsx.
    try { sessionStorage.setItem(FRESH_LOGIN_FLAG, '1') } catch {/* ignore */}

    let cancelled = false
    // The implicit flow can trigger both the "already-established session"
    // branch below AND the onAuthStateChange SIGNED_IN listener for the
    // same sign-in (this raced harmlessly in the original /api/auth/profile-
    // only version) — now that a fresh sign-in can send a real 2FA email,
    // a double-fire would send two codes and invalidate the first
    // (sendTwoFactorCode overwrites the stored code), so guard against it.
    let resolving = false
    const supabase = getSupabaseClient()

    function clearFreshFlag() {
      try { sessionStorage.removeItem(FRESH_LOGIN_FLAG) } catch {/* ignore */}
    }

    async function resolveProfileAndRedirect(email: string, accessToken: string) {
      if (cancelled || resolving) return
      resolving = true
      setStatus('Loading your profile…')
      try {
        // Explicit session establishment — separate from (and racing ahead
        // of) AuthContext's own suppressed listener. If 2FA is required,
        // this returns requires2FA instead of setting the cookie, exactly
        // like /api/auth/google-verify already does.
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (cancelled) return
        const sessionData = await sessionRes.json().catch(() => ({}))

        if (sessionRes.ok && sessionData.requires2FA) {
          setStatus('')
          setTwoFAEmail(sessionData.email || email)
          return
        }
        if (!sessionRes.ok) {
          clearFreshFlag()
          setError(sessionData?.error || 'We could not establish your session. Please try again.')
          return
        }

        // Cookie is set. Look up userType for the redirect target, same as
        // before.
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ email }),
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          clearFreshFlag()
          // Full navigation, not client-side router.replace — AuthContext's
          // listener was deliberately suppressed for this sign-in (above),
          // so its `user` state was never populated; a fresh page load
          // re-triggers AuthProvider's normal initial-mount session restore,
          // which is unaffected by the fresh-login flag.
          window.location.href = data.user?.userType === 'client' ? '/client' : '/'
          return
        }
        const data = await res.json().catch(() => ({}))
        clearFreshFlag()
        setError(data?.error || 'We could not find your account. Please contact your administrator.')
      } catch {
        if (!cancelled) {
          clearFreshFlag()
          setError('Network error while loading your profile. Please try again.')
        }
      }
    }

    // 1. Subscribe to auth state changes (implicit flow + OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' && session?.user?.email && session.access_token) {
        await resolveProfileAndRedirect(session.user.email.toLowerCase(), session.access_token)
      }
    })

    // 2. Manual PKCE code exchange for ?code=... URLs
    async function handlePkceCode() {
      const search = new URLSearchParams(window.location.search)
      const code = search.get('code')
      const codeError = search.get('error_description') || search.get('error')
      if (codeError) {
        clearFreshFlag()
        setError(codeError)
        return
      }
      if (!code) return

      try {
        const { data, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeErr) {
          clearFreshFlag()
          setError(
            `Sign-in link expired or invalid (${exchangeErr.message}). ` +
            'Request a new link on the login page.',
          )
          return
        }
        if (data?.session?.user?.email && data.session.access_token) {
          await resolveProfileAndRedirect(data.session.user.email.toLowerCase(), data.session.access_token)
        }
      } catch (err) {
        if (!cancelled) {
          clearFreshFlag()
          setError(err instanceof Error ? err.message : 'Failed to verify sign-in link')
        }
      }
    }

    // 3. Already-established session + timeout fallback
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (session?.user?.email && session.access_token) {
        await resolveProfileAndRedirect(session.user.email.toLowerCase(), session.access_token)
        return
      }
      await handlePkceCode()

      setTimeout(() => {
        if (cancelled) return
        supabase.auth.getSession().then(({ data }) => {
          if (cancelled) return
          if (!data.session) {
            clearFreshFlag()
            setError((prev) => prev || 'Sign-in link expired or your browser blocked cookies. Request a new link.')
          }
        }).catch(() => {/* non-fatal */})
      }, 6000)
    }).catch((err) => {
      if (!cancelled) {
        clearFreshFlag()
        setError(err instanceof Error ? err.message : 'Failed to check session')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      // Safety net for navigating away mid-flow (e.g. browser back) — a
      // stuck flag would only suppress one future onAuthStateChange
      // SIGNED_IN listener call in this tab; AuthContext's own unconditional
      // initial-mount session restore is unaffected either way, but there's
      // no reason to leave it set once this page is gone.
      clearFreshFlag()
    }
  }, [router])

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault()
    if (twoFACode.trim().length !== 6) return
    setTwoFAError('')
    setTwoFASubmitting(true)
    const result = await verify2FACode(twoFAEmail, twoFACode.trim())
    setTwoFASubmitting(false)
    if (result.ok) {
      try { sessionStorage.removeItem(FRESH_LOGIN_FLAG) } catch {/* ignore */}
      // verify2FACode() already populated AuthContext's user state via
      // finalizeLogin(), so a client-side redirect is enough here (unlike
      // the non-2FA path above, which needs a full reload). Always '/' —
      // /api/auth/session's 2FA gate only ever fires for the teamRow
      // (staff) branch, never portal clients.
      router.replace('/')
    } else {
      setTwoFAError(result.error || 'Verification failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFF3EA', fontFamily: 'var(--font-body)' }}>
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
        ) : twoFAEmail ? (
          <div>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#e6f0ec' }}>
              <Mail size={24} style={{ color: '#015035' }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}>
              ENTER YOUR CODE
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              We sent a 6-digit code to <strong>{twoFAEmail}</strong>
            </p>
            <form onSubmit={handleVerify2FA} className="flex flex-col gap-4">
              <input
                type="text"
                inputMode="numeric"
                value={twoFACode}
                onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.5em] font-semibold py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-300 bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                autoComplete="one-time-code"
                autoFocus
                disabled={twoFASubmitting}
              />
              {twoFAError && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{twoFAError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={twoFASubmitting || twoFACode.length !== 6}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                {twoFASubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Verifying...</>
                ) : 'Verify & Sign In'}
              </button>
            </form>
          </div>
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
