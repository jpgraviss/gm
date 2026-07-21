import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/auth/health
 *
 * Returns presence/runtime info for the auth-critical env vars so we can
 * diagnose sign-in failures — deliberately kept public/unauthenticated
 * (a broken auth system shouldn't lock an engineer out of diagnosing it),
 * which is why AUDIT #242 fixed this route to a presence check instead of
 * gating it: real secret-prefix/suffix fragments (`first4...last4 (length)`)
 * were being returned to any unauthenticated caller for
 * SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY,
 * CRON_SECRET, RESEND_API_KEY, and GROQ_API_KEY — real disclosure, not a
 * masked one, despite the previous comment's claim.
 */
export const GET = withErrorHandler('auth/health GET', async () => {
  const present = (v: string | undefined): string => (v ? `set (${v.length} chars)` : '(not set)')

  return NextResponse.json({
    buildMarker: '2026-04-14.v5',
    nodeVersion: process.version,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
      GOOGLE_CLIENT_ID: present(process.env.GOOGLE_CLIENT_ID),
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: present(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: present(process.env.GOOGLE_CLIENT_SECRET),
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '(not set)',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
      TOKEN_ENCRYPTION_KEY: present(process.env.TOKEN_ENCRYPTION_KEY),
      CRON_SECRET: present(process.env.CRON_SECRET),
      RESEND_API_KEY: present(process.env.RESEND_API_KEY),
      GROQ_API_KEY: present(process.env.GROQ_API_KEY),
      OLLAMA_URL: process.env.OLLAMA_URL || '(default: http://localhost:11434)',
    },
    clientIdMatch:
      process.env.GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        ? process.env.GOOGLE_CLIENT_ID === process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        : null,
    timestamp: new Date().toISOString(),
  })
})
