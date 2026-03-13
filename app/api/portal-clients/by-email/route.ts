import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/portal-clients/by-email?email=...
// Service-role lookup — bypasses RLS, used by the client login page
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('portal_clients')
    .select('*')
    .ilike('email', email) // case-insensitive match
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({
    id:        data.id,
    email:     data.email,
    name:      data.contact ?? data.email,
    company:   data.company,
    service:   data.service,
    access:    data.access,
  })
}
