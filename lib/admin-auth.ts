import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Verify the request comes from an admin user. Supports:
 * - Authorization: Bearer <token> (API clients)
 * - Supabase sb-*-auth-token cookie (browser SSR)
 * - gravhub-auth bridge cookie (trusted — proxy already validated)
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const db = createServiceClient()

  // 1. Try Authorization header
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // 2. Try Supabase auth cookie
  if (!token) {
    const sbCookie = req.cookies.getAll().find(c =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    )
    if (sbCookie) {
      try {
        const parsed = JSON.parse(Buffer.from(sbCookie.value, 'base64').toString())
        token = parsed?.access_token ?? parsed?.[0]?.access_token ?? null
      } catch {
        token = sbCookie.value || null
      }
    }
  }

  // 3. Check gravhub-auth bridge cookie
  const hasGravhub = req.cookies.has('gravhub-auth')

  if (!token && !hasGravhub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Supabase token and check admin role
  if (token) {
    const { data: { user }, error } = await db.auth.getUser(token)
    if (!error && user?.email) {
      const { data: member } = await db
        .from('team_members')
        .select('is_admin')
        .eq('email', user.email)
        .single()
      if (!member?.is_admin) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
      }
      return null // Authorized as admin
    }
    // Token invalid — fall through to gravhub-auth check
    if (!hasGravhub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // gravhub-auth cookie present — proxy already validated auth
  return null
}
