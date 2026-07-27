import { Resend } from 'resend'

let client: Resend | null = null
let cachedKey: string | null = null

async function getApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY
  if (cachedKey) return cachedKey
  try {
    const { createServiceClient } = await import('@/lib/supabase')
    const { decrypt } = await import('@/lib/encryption')
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('resend')
      .eq('id', 'global')
      .maybeSingle()
    const encryptedKey = (data?.resend as { apiKey?: string })?.apiKey
    if (encryptedKey) {
      const key = decrypt(encryptedKey)
      cachedKey = key
      return key
    }
  } catch { /* fall through */ }
  return null
}

export async function getResend(): Promise<Resend> {
  const key = await getApiKey()
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  if (!client || cachedKey !== key) {
    client = new Resend(key)
  }
  return client
}
