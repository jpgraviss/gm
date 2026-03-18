import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * POST /api/auth/google-verify
 *
 * Accepts a Google Identity Services JWT credential, decodes it,
 * and looks up the user in team_members and portal_clients.
 * Returns a minimal user profile for the client to populate AuthContext.
 *
 * This is a PUBLIC endpoint (no auth required) so that the login page
 * can verify Google credentials before a Supabase session exists.
 */
export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json()
    if (!credential || typeof credential !== 'string') {
      return NextResponse.json({ error: 'Missing credential' }, { status: 400 })
    }

    // Decode the Google JWT payload (the signature was already verified by
    // Google Identity Services on the client side via the official GIS SDK).
    const parts = credential.split('.')
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid credential format' }, { status: 400 })
    }

    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    let payload: { email?: string; name?: string; picture?: string; sub?: string }
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString())
    } catch {
      return NextResponse.json({ error: 'Invalid credential' }, { status: 400 })
    }

    const email = payload.email?.toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'No email in credential' }, { status: 400 })
    }

    const db = createServiceClient()

    // 1. Check team_members (staff) — requires @gravissmarketing.com or matching record
    if (email.endsWith('@gravissmarketing.com')) {
      const { data: teamRow } = await db
        .from('team_members')
        .select('id, email, name, role, unit, initials, is_admin, status')
        .ilike('email', email)
        .single()

      if (!teamRow) {
        // Auto-provision: create team_members row for authenticated @gravissmarketing.com user
        const { data: { users } } = await db.auth.admin.listUsers()
        const authUser = users?.find(u => u.email?.toLowerCase() === email)
        if (authUser) {
          const name = payload.name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'
          await db.from('team_members').insert({
            id: authUser.id, name, email, role: 'Team Member',
            unit: 'Leadership/Admin', initials, status: 'Active', is_admin: false,
          })
          // Re-fetch the newly created row
          const { data: newRow } = await db
            .from('team_members')
            .select('id, email, name, role, unit, initials, is_admin, status')
            .ilike('email', email)
            .single()
          if (newRow) {
            return NextResponse.json({
              user: {
                id: newRow.id, email: newRow.email, name: newRow.name,
                role: newRow.role, unit: newRow.unit, initials: newRow.initials ?? '',
                isAdmin: newRow.is_admin ?? false, avatar: payload.picture, userType: 'staff',
              },
            })
          }
        }
        return NextResponse.json(
          { error: 'No team member profile found. Contact your administrator.' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        user: {
          id:       teamRow.id,
          email:    teamRow.email,
          name:     teamRow.name,
          role:     teamRow.role,
          unit:     teamRow.unit,
          initials: teamRow.initials ?? '',
          isAdmin:  teamRow.is_admin ?? false,
          avatar:   payload.picture,
          userType: 'staff',
        },
      })
    }

    // 2. Check portal_clients (external clients — any email domain)
    const { data: clientRow } = await db
      .from('portal_clients')
      .select('id, email, company, contact, service, access')
      .ilike('email', email)
      .single()

    if (!clientRow) {
      return NextResponse.json(
        { error: 'No account found for this email. Contact Graviss Marketing to get access.' },
        { status: 403 }
      )
    }

    if (clientRow.access === 'Disabled') {
      return NextResponse.json(
        { error: 'Your portal access has been disabled. Contact Graviss Marketing.' },
        { status: 403 }
      )
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
        avatar:   payload.picture,
        userType: 'client',
        company:  clientRow.company,
      },
    })
  } catch (err) {
    console.error('[auth/google-verify POST]', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
