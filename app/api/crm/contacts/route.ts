import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'
import { crmContacts as seedContacts } from '@/lib/data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')

  if (!isConfigured) {
    const results = companyId
      ? seedContacts.filter(c => c.companyId === companyId)
      : seedContacts
    return NextResponse.json(results)
  }

  const db = createServiceClient()
  let query = db.from('crm_contacts').select('*').order('full_name')
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ ...body, id: `ct-${Date.now()}` })
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_contacts')
    .insert({
      id:           `ct-${Date.now()}`,
      company_id:   body.companyId,
      company_name: body.companyName,
      first_name:   body.firstName,
      last_name:    body.lastName,
      full_name:    body.fullName ?? `${body.firstName} ${body.lastName}`,
      title:        body.title,
      emails:       body.emails ?? [],
      phones:       body.phones ?? [],
      is_primary:   body.isPrimary ?? false,
      owner:        body.owner,
      tags:         body.tags ?? [],
      notes:        body.notes,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
