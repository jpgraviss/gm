import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: member, error } = await db
      .from('team_members')
      .select('id, verification_code, verification_expires, setup_completed')
      .ilike('email', email.toLowerCase().trim())
      .single()

    if (error || !member) {
      return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
    }

    if (member.setup_completed) {
      return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 400 })
    }

    if (!member.verification_code) {
      return NextResponse.json({ error: 'No verification code found. Request a new invite.' }, { status: 400 })
    }

    if (member.verification_expires && new Date(member.verification_expires) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Request a new invite.' }, { status: 400 })
    }

    if (member.verification_code !== code.toString().trim()) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    const setupToken = crypto.randomBytes(32).toString('hex')

    await db
      .from('team_members')
      .update({ pending_approval: true })
      .eq('id', member.id)

    return NextResponse.json({ success: true, setupToken, userId: member.id })
  } catch (err) {
    console.error('[verify-code POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
