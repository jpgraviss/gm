import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

const SETTINGS_ID = 'global'

export const POST = withErrorHandler('crm/duplicates/ignore POST', async (req) => {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { type, groupKey } = body as { type?: string; groupKey?: string }
  if (!type || !groupKey) {
    return NextResponse.json({ error: 'type and groupKey are required' }, { status: 400 })
  }
  if (type !== 'contacts' && type !== 'companies') {
    return NextResponse.json({ error: 'type must be "contacts" or "companies"' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch current dismissed_duplicates
  const { data: settings } = await db
    .from('app_settings')
    .select('dismissed_duplicates')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  const dismissed: Record<string, string[]> = (settings?.dismissed_duplicates as Record<string, string[]>) ?? {}
  const list = dismissed[type] ?? []
  if (!list.includes(groupKey)) {
    list.push(groupKey)
  }
  dismissed[type] = list

  const { error } = await db
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, dismissed_duplicates: dismissed }, { onConflict: 'id' })

  if (error) {
    throw new Error(error.message || 'Failed to ignore duplicate')
  }

  return NextResponse.json({ ok: true })
})
