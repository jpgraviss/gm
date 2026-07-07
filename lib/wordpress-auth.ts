import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

/**
 * Validate that the request comes from the WordPress plugin (via X-GravHub-Key)
 * or from an authenticated GravHub staff member.
 */
export async function requireWordPressAuth(req: NextRequest): Promise<NextResponse | null> {
  const key = req.headers.get('x-gravhub-key')

  if (key) {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('value')
      .eq('key', 'wordpress_api_keys')
      .maybeSingle()

    if (data) {
      const keys = (data as { value: string[] }).value
      if (Array.isArray(keys) && keys.includes(key)) return null
    }

    if (key === process.env.WORDPRESS_API_KEY) return null
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const email = await getAuthenticatedEmail(req)
  if (email) return null

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}
