import { NextResponse } from 'next/server'

/**
 * GET /api/auth/health
 *
 * Returns a masked view of the auth-critical env vars + runtime info so
 * we can diagnose sign-in failures without exposing secrets.
 *
 * Public endpoint — safe to expose because values are masked.
 */
export async function GET() {
  const mask = (v: string | undefined): string => {
    if (!v) return '(not set)'
    if (v.length < 8) return '***'
    return `${v.slice(0, 4)}...${v.slice(-4)} (${v.length} chars)`
  }

  return NextResponse.json({
    buildMarker: '2026-04-14.v5',
    nodeVersion: process.version,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: mask(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: mask(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY),
      GOOGLE_CLIENT_ID: mask(process.env.GOOGLE_CLIENT_ID),
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: mask(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: mask(process.env.GOOGLE_CLIENT_SECRET),
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '(not set)',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(not set)',
      TOKEN_ENCRYPTION_KEY: mask(process.env.TOKEN_ENCRYPTION_KEY),
      CRON_SECRET: mask(process.env.CRON_SECRET),
      RESEND_API_KEY: mask(process.env.RESEND_API_KEY),
      GROQ_API_KEY: mask(process.env.GROQ_API_KEY),
      OLLAMA_URL: process.env.OLLAMA_URL || '(default: http://localhost:11434)',
    },
    clientIdMatch:
      process.env.GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        ? process.env.GOOGLE_CLIENT_ID === process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        : null,
    timestamp: new Date().toISOString(),
  })
}
