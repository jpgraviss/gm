// Auto-provision a team_members row for authenticated Supabase Auth users
// that don't yet have a profile. Only works for @gravissmarketing.com emails.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || !email.endsWith('@gravissmarketing.com')) {
      return NextResponse.json({ error: 'Not eligible for auto-provision' }, { status: 403 })
    }

    const db = createServiceClient()
    const emailLower = email.toLowerCase()

    // Check if a profile already exists
    const { data: existing } = await db
      .from('team_members')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ status: 'already_exists' })
    }

    // Look up the Supabase Auth user to get their UUID
    const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
    if (listErr) {
      return NextResponse.json({ error: listErr?.message || 'Failed to list users' }, { status: 500 })
    }
    const authUser = users?.find(u => u.email?.toLowerCase() === emailLower)
    if (!authUser) {
      return NextResponse.json({ error: 'No auth user found' }, { status: 404 })
    }

    // Derive a name and initials from the email or user metadata
    const metaName = authUser.user_metadata?.name as string | undefined
    const name = metaName || emailLower.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'

    const { error: insertErr } = await db.from('team_members').insert({
      id:       authUser.id,
      name,
      email:    emailLower,
      role:     'Team Member',
      unit:     'Leadership/Admin',
      initials,
      status:   'Active',
      is_admin: false,
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ status: 'provisioned', name })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
