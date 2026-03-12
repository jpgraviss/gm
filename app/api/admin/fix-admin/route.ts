import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// POST /api/admin/fix-admin
// Sets is_admin = true for Jonathan Graviss and JG Graviss.
// Protected by x-setup-secret header.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const adminEmails = [
    'jonathan@gravissmarketing.com',
    'jgraviss@gravissmarketing.com',
  ]

  const results: { email: string; status: string }[] = []

  for (const email of adminEmails) {
    const { error } = await db
      .from('team_members')
      .update({ is_admin: true, role: 'Super Admin' })
      .eq('email', email)

    results.push({ email, status: error ? `error: ${error.message}` : 'updated' })
  }

  return NextResponse.json({ results })
}
