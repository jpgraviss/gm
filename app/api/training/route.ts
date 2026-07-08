import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

const SETTINGS_ID = 'global'

export const GET = withErrorHandler('training GET', async () => {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .select('training_modules')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  if (error) {
    console.error('[training GET]', error)
    // Column might not exist yet — return empty gracefully
    return NextResponse.json({ modules: [] })
  }

  return NextResponse.json({ modules: data?.training_modules ?? [] })
})

export const PUT = withErrorHandler('training PUT', async (req) => {
  let body: { modules: unknown[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.modules)) {
    return NextResponse.json({ error: 'modules must be an array' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .upsert(
      {
        id: SETTINGS_ID,
        training_modules: body.modules,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('training_modules')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ modules: data.training_modules ?? [] })
})
