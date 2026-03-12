import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()

  // Find the Supabase auth user by email
  const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) return NextResponse.json({ error: 'No auth account found for this email' }, { status: 404 })

  const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase()

  const { error: updateErr } = await db.auth.admin.updateUserById(authUser.id, { password: tempPassword })
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ tempPassword })
}
