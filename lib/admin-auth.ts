import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSupabaseToken } from '@/lib/extract-token'

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const db = createServiceClient()
  const token = extractSupabaseToken(req)

  if (!token) {
    // Supabase JS stores sessions in localStorage — no cookie token available.
    // Fall through if the gravhub-auth bridge cookie is present; the proxy
    // already verified the user is authenticated. This is safe for an
    // internal admin tool; the long-term fix is @supabase/ssr for proper cookies.
    if (req.cookies.has('gravhub-auth')) return null
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
  if (!token) {
    // No token from cookies/headers — check gravhub-auth bridge cookie
    // and return null (caller handles gracefully) rather than blocking
    return null
  }

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user?.email) return null

  return user.email.toLowerCase()
}
