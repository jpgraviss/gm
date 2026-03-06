import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Lazy singleton — only created when env vars are present
let _client: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    if (!isConfigured) throw new Error('Supabase env vars not set')
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

// Server-side client using service role key (for API routes only)
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
  return createClient(url, serviceKey)
}
