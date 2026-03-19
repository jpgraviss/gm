import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()

  // Find the Supabase auth user by email
  const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
  if (listErr) {
    console.error('[portal-clients/reset-password POST]', listErr)
    return NextResponse.json({ error: listErr?.message || 'Failed to look up user' }, { status: 500 })
  }

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) return NextResponse.json({ error: 'No auth account found for this email' }, { status: 404 })

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase()

  const { error: updateErr } = await db.auth.admin.updateUserById(authUser.id, { password: tempPassword })
  if (updateErr) {
    console.error('[portal-clients/reset-password POST]', updateErr)
    return NextResponse.json({ error: updateErr?.message || 'Failed to reset password' }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'client_password_reset', module: 'portal', type: 'warning', metadata: { email } })
  return NextResponse.json({ tempPassword })
}
