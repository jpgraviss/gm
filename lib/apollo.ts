import { createServiceClient } from '@/lib/supabase'

export async function getApolloApiKey(): Promise<string | undefined> {
  if (process.env.APOLLO_API_KEY) return process.env.APOLLO_API_KEY

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('apollo')
      .eq('id', 'global')
      .maybeSingle()
    return (data?.apollo as { apiKey?: string })?.apiKey || undefined
  } catch {
    return undefined
  }
}

export async function testApolloConnection(apiKey: string): Promise<{ connected: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
    })

    if (res.ok) {
      return { connected: true }
    }

    const text = await res.text().catch(() => '')
    return { connected: false, error: `Apollo responded with ${res.status}: ${text}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return { connected: false, error: message }
  }
}
