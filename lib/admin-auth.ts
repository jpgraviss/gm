import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSupabaseToken } from '@/lib/extract-token'

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const db = createServiceClient()
  const token = extractSupabaseToken(req)

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await db
    .from('team_members')
    .select('is_admin')
    .eq('email', user.email)
    .single()

  if (!member?.is_admin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  return null
}

export async function getAuthenticatedEmail(req: NextRequest): Promise<string | null> {
  const db = createServiceClient()
  const token = extractSupabaseToken(req)
  if (!token) return null

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user?.email) return null

  return user.email.toLowerCase()
}
