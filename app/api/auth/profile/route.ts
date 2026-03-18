// Server-side profile lookup for email/password login.
// Uses the service role key to bypass RLS, matching how Google SSO works.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const db = createServiceClient()
    const emailLower = email.toLowerCase().trim()

    // Check team_members (staff)
    const { data: teamRow } = await db
      .from('team_members')
      .select('id, email, name, role, unit, initials, is_admin, status')
      .eq('email', emailLower)
      .single()

    if (teamRow) {
      return NextResponse.json({
        user: {
          id:       teamRow.id,
          email:    teamRow.email,
          name:     teamRow.name,
          role:     teamRow.role,
          unit:     teamRow.unit,
          initials: teamRow.initials ?? '',
          isAdmin:  teamRow.is_admin ?? false,
          userType: 'staff',
        },
      })
    }

    // Check portal_clients
    const { data: clientRow } = await db
      .from('portal_clients')
      .select('id, email, company, contact, service, access')
      .eq('email', emailLower)
      .single()

    if (clientRow) {
      if (clientRow.access === 'Disabled') {
        return NextResponse.json({ error: 'Portal access disabled' }, { status: 403 })
      }
      const names = (clientRow.contact ?? '').split(' ')
      return NextResponse.json({
        user: {
          id:       clientRow.id,
          email:    clientRow.email,
          name:     clientRow.contact ?? clientRow.email,
          role:     'Client',
          unit:     'Client',
          initials: names.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL',
          isAdmin:  false,
          userType: 'client',
          company:  clientRow.company,
        },
      })
    }

    // Auto-provision for @gravissmarketing.com
    if (emailLower.endsWith('@gravissmarketing.com')) {
      const { data: { users } } = await db.auth.admin.listUsers()
      const authUser = users?.find((u: { email?: string }) => u.email?.toLowerCase() === emailLower)
      if (authUser) {
        const metaName = authUser.user_metadata?.name as string | undefined
        const name = metaName || emailLower.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'

        const { error: insertErr } = await db.from('team_members').insert({
          id: authUser.id, name, email: emailLower, role: 'Team Member',
          unit: 'Leadership/Admin', initials, status: 'Active', is_admin: false,
        })

        if (!insertErr) {
          return NextResponse.json({
            user: {
              id: authUser.id, email: emailLower, name, role: 'Team Member',
              unit: 'Leadership/Admin', initials, isAdmin: false, userType: 'staff',
            },
          })
        }
        return NextResponse.json({ error: `Auto-provision insert failed: ${insertErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'No account found' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Profile lookup failed' }, { status: 500 })
  }
}
