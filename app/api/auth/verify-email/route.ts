import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * POST /api/auth/verify-email
 * Checks if an email exists in team_members or portal_clients.
 * Used before sending magic links to prevent sending emails to unknown addresses.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ exists: false })
    }

    const db = createServiceClient()
    const normalizedEmail = email.toLowerCase().trim()

    // Check team_members
    const { data: teamData } = await db
      .from('team_members')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1)

    if (teamData && teamData.length > 0) {
      return NextResponse.json({ exists: true })
    }

    // Check portal_clients
    const { data: clientData } = await db
      .from('portal_clients')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1)

    if (clientData && clientData.length > 0) {
      return NextResponse.json({ exists: true })
    }

    return NextResponse.json({ exists: false })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
