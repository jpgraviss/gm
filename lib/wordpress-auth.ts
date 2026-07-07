import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

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
      const wp = data.wordpress as { apiKeys?: string[] } | null
      if (wp && Array.isArray(wp.apiKeys) && wp.apiKeys.includes(key)) return null
    }

    if (key === process.env.WORDPRESS_API_KEY) return null
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const email = await getAuthenticatedEmail(req)
  if (email) return null

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}
