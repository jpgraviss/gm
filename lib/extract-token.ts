import { NextRequest } from 'next/server'

export function extractSupabaseToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)

  const sbCookie = req.cookies.getAll().find(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!sbCookie) return null

  try {
    const parsed = JSON.parse(Buffer.from(sbCookie.value, 'base64').toString())
    return parsed?.access_token ?? parsed?.[0]?.access_token ?? null
  } catch {
    return sbCookie.value || null
  }
}
