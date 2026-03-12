// ─────────────────────────────────────────────────────────────────────────────
// One-time setup: creates the two base Supabase Auth users and their
// team_members profile rows.
//
// Call once after deploying:
//   POST /api/admin/setup
//   Header: x-setup-secret: <SETUP_SECRET env var>
//
// After this endpoint succeeds you can delete or disable it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const BASE_USERS = [
  {
    email:    'jonathan@gravissmarketing.com',
    password: process.env.JONATHAN_PASSWORD ?? '',
    name:     'Jonathan Graviss',
    role:     'Super Admin',
    unit:     'Leadership/Admin',
    initials: 'JON',
    isAdmin:  true,
    tmId:     't0',
  },
  {
    email:    'jgraviss@gravissmarketing.com',
    password: process.env.JG_PASSWORD ?? '',
    name:     'JG Graviss',
    role:     'Super Admin',
    unit:     'Leadership/Admin',
    initials: 'JG',
    isAdmin:  true,
    tmId:     't1',
  },
  {
    email:    'ssarkar@gravissmarketing.com',
    password: process.env.SHIHAB_PASSWORD ?? '',
    name:     'Shihab Sarkar',
    role:     'Team Member',
    unit:     'Delivery/Operations',
    initials: 'SS',
    isAdmin:  false,
    tmId:     't3',
  },
  {
    email:    'seo@gravissmarketing.com',
    password: process.env.SEO_PASSWORD ?? '',
    name:     'Team SEO',
    role:     'Team Member',
    unit:     'Delivery/Operations',
    initials: 'SE',
    isAdmin:  false,
    tmId:     't4',
  },
  {
    email:    'billing@gravissmarketing.com',
    password: process.env.BILLING_PASSWORD ?? '',
    name:     'Graviss Billing',
    role:     'Department Manager',
    unit:     'Billing/Finance',
    initials: 'GB',
    isAdmin:  true,
    tmId:     't5',
  },
  {
    email:    'test@gravissmarketing.com',
    password: process.env.TEST_PASSWORD ?? '',
    name:     'Graviss Marketing',
    role:     'Team Member',
    unit:     'Leadership/Admin',
    initials: 'GM',
    isAdmin:  false,
    tmId:     't2',
  },
]

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const results: { email: string; status: string; detail?: string }[] = []

  for (const u of BASE_USERS) {
    if (!u.password) {
      results.push({ email: u.email, status: 'skipped', detail: 'password env var not set' })
      continue
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email:             u.email,
      password:          u.password,
      email_confirm:     true,
      user_metadata:     { name: u.name, role: u.role, unit: u.unit },
    })

    if (authError && !authError.message.includes('already been registered')) {
      results.push({ email: u.email, status: 'error', detail: authError.message })
      continue
    }

    const userId = authData?.user?.id ?? u.tmId

    // Upsert team_members row
    const { error: tmError } = await db.from('team_members').upsert({
      id:       userId,
      name:     u.name,
      email:    u.email,
      role:     u.role,
      unit:     u.unit,
      initials: u.initials,
      status:   'Active',
      is_admin: u.isAdmin,
    }, { onConflict: 'email' })

    if (tmError) {
      results.push({ email: u.email, status: 'auth_ok_profile_error', detail: tmError.message })
    } else {
      results.push({ email: u.email, status: 'ok' })
    }
  }

  return NextResponse.json({ results })
}
