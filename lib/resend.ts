import { Resend } from 'resend'
import { NotConfiguredError } from '@/lib/integration-not-configured'

// AUDIT #655 — this used to cache the decrypted key in a module-level
// variable forever once resolved, with no invalidation on write. If an
// admin rotated the key in Settings, every warm serverless instance kept
// using the old key until it happened to cold-start. Not a hot path (a
// handful of email sends per request, not per-item), so dropping the
// cache and always resolving fresh is the safe fix — an extra DB
// round-trip per call is negligible next to the network cost of the
// Resend API call it precedes.
async function getApiKey(): Promise<string | null> {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY
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
      return decrypt(encryptedKey)
    }
  } catch { /* fall through */ }
  return null
}

export async function getResend(): Promise<Resend> {
  const key = await getApiKey()
  if (!key) throw new NotConfiguredError('Resend', 'Email sending is not configured. Add a Resend API key in Settings → Integrations.')
  return new Resend(key)
}
