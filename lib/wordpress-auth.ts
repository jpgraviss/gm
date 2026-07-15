import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

export async function requireWordPressAuth(req: NextRequest): Promise<NextResponse | null> {
  const key = req.headers.get('x-gravhub-key')

  if (key) {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('wordpress')
      .eq('id', 'global')
      .maybeSingle()

    if (data) {
      const wp = data.wordpress as { apiKeys?: Array<string | { key: string }> } | null
      if (wp && Array.isArray(wp.apiKeys)) {
        const match = wp.apiKeys.some(k => (typeof k === 'string' ? k : k.key) === key)
        if (match) return null
      }
    }

    if (key === process.env.WORDPRESS_API_KEY) return null
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // The session fallback (used by the staff SEO-manager UI, not the plugin
  // itself) previously only proved "some valid session" — getAuthenticatedEmail
  // resolves for a portal client exactly the same as staff. Any portal
  // client could read/overwrite another client's live WordPress SEO
  // settings (meta title/description/OG/schema — a real defacement
  // vector). Require real team_members membership.
  const email = await getAuthenticatedEmail(req)
  if (email && (await isStaffCaller(req))) return null

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}
