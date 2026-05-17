import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const db = createServiceClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: client, error } = await db
      .from('portal_clients')
      .select('id, verification_code, verification_expires')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (error || !client) {
      return NextResponse.json({ error: 'No portal account found for this email' }, { status: 404 })
    }

    if (!client.verification_code) {
      return NextResponse.json({ error: 'No verification code has been issued' }, { status: 400 })
    }

    if (client.verification_expires && new Date(client.verification_expires) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please contact your administrator for a new invite.' }, { status: 400 })
    }

    if (client.verification_code !== code.trim()) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    return NextResponse.json({ success: true, clientId: client.id })
  } catch (err) {
    console.error('[verify-code POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
