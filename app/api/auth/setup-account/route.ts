import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId, password, avatarUrl } = await req.json()

    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data: member, error: memberErr } = await db
      .from('team_members')
      .select('id, email, setup_completed, status')
      .eq('id', userId)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (member.setup_completed) {
      return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 400 })
    }

    if (member.status !== 'active') {
      return NextResponse.json({ error: 'Account has not been approved yet. Please wait for admin approval.' }, { status: 403 })
    }

    const { error: pwError } = await db.auth.admin.updateUserById(userId, {
      password,
    })

    if (pwError) {
      console.error('[setup-account] password update error:', pwError)
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
    }

    const updates: Record<string, unknown> = {
      setup_completed: true,
      verification_code: null,
      verification_expires: null,
      pending_approval: false,
    }

    if (avatarUrl) {
      updates.avatar_url = avatarUrl
    }

    await db.from('team_members').update(updates).eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[setup-account POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
