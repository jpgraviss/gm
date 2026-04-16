import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBrandKit(row: any) {
  return {
    id:             row.id,
    companyId:      row.company_id ?? undefined,
    companyName:    row.company_name,
    logoUrl:        row.logo_url ?? undefined,
    primaryColor:   row.primary_color ?? undefined,
    secondaryColor: row.secondary_color ?? undefined,
    fonts:          row.fonts ?? [],
    toneOfVoice:    row.tone_of_voice ?? undefined,
    hashtags:       row.hashtags ?? [],
    notes:          row.notes ?? undefined,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('brand_kits').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 })
  return NextResponse.json(mapBrandKit(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.companyName !== undefined)    update.company_name = body.companyName
  if (body.logoUrl !== undefined)        update.logo_url = body.logoUrl
  if (body.primaryColor !== undefined)   update.primary_color = body.primaryColor
  if (body.secondaryColor !== undefined) update.secondary_color = body.secondaryColor
  if (body.fonts !== undefined)          update.fonts = body.fonts
  if (body.toneOfVoice !== undefined)    update.tone_of_voice = body.toneOfVoice
  if (body.hashtags !== undefined)       update.hashtags = body.hashtags
  if (body.notes !== undefined)          update.notes = body.notes

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('brand_kits').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[brand-kits/:id PATCH]', error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Brand kit not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(mapBrandKit(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('brand_kits').delete().eq('id', id)
  if (error) {
    console.error('[brand-kits/:id DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({
    userName: 'system',
    action: 'deleted_brand_kit',
    module: 'social_media',
    type: 'warning',
    metadata: { brandKitId: id },
  })
  return NextResponse.json({ deleted: id })
}
