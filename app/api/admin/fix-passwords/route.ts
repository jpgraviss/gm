// ─────────────────────────────────────────────────────────────────────────────
// One-time password fix for existing Supabase Auth users.
// Reads passwords from env vars and updates Supabase Auth.
//
//   POST /api/admin/fix-passwords
//   Header: x-setup-secret: <SETUP_SECRET env var>
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

const USERS_TO_FIX = [
  { email: 'jonathan@gravissmarketing.com', password: process.env.JONATHAN_PASSWORD ?? '' },
  { email: 'jgraviss@gravissmarketing.com',  password: process.env.JG_PASSWORD ?? '' },
  { email: 'ssarkar@gravissmarketing.com',   password: process.env.SHIHAB_PASSWORD ?? '' },
  { email: 'seo@gravissmarketing.com',       password: process.env.SEO_PASSWORD ?? '' },
  { email: 'billing@gravissmarketing.com',   password: process.env.BILLING_PASSWORD ?? '' },
  { email: 'test@gravissmarketing.com',      password: process.env.TEST_PASSWORD ?? '' },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const results: { email: string; status: string; detail?: string }[] = []

  for (const u of USERS_TO_FIX) {
    if (!u.password) {
      results.push({ email: u.email, status: 'skipped', detail: 'password env var not set' })
      continue
    }

    // Look up the auth user ID by querying auth.users via service client
    const { data: authUser, error: lookupError } = await db
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', u.email.toLowerCase())
      .maybeSingle()

    if (lookupError || !authUser) {
      // User doesn't exist — create them
      const { error: createError } = await db.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      })
      if (createError) {
        results.push({ email: u.email, status: 'error', detail: createError.message })
      } else {
        results.push({ email: u.email, status: 'created' })
      }
      continue
    }

    // User exists — update password by ID
    const { error: updateError } = await db.auth.admin.updateUserById(authUser.id, {
      password: u.password,
    })

    if (updateError) {
      results.push({ email: u.email, status: 'error', detail: updateError.message })
    } else {
      results.push({ email: u.email, status: 'ok' })
    }
  }

  logAudit({ userName: 'system', action: 'passwords_reset', module: 'admin', type: 'warning', metadata: { users: results.map(r => r.email) } })
  return NextResponse.json({ results })
}
