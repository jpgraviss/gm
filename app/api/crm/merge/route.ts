import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createServiceClient()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: member } = await db.from('team_members').select('is_admin').eq('email', user.email).single()
  if (!member?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    type: 'contacts' | 'companies'
    primaryId: string
    mergeIds: string[]
    fieldOverrides?: Record<string, unknown>
  }

  const { type, primaryId, mergeIds, fieldOverrides } = body

  if (!type || !primaryId || !mergeIds?.length) {
    return NextResponse.json({ error: 'type, primaryId, and mergeIds are required' }, { status: 400 })
  }

  if (mergeIds.includes(primaryId)) {
    return NextResponse.json({ error: 'primaryId must not be in mergeIds' }, { status: 400 })
  }

  if (type === 'contacts') {
    const { data: primary, error: pErr } = await db.from('crm_contacts').select('*').eq('id', primaryId).single()
    if (pErr || !primary) return NextResponse.json({ error: 'Primary contact not found' }, { status: 404 })

    const { data: mergeRecords, error: mErr } = await db.from('crm_contacts').select('*').in('id', mergeIds)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    if (!mergeRecords?.length) return NextResponse.json({ error: 'No merge records found' }, { status: 404 })

    const allEmails = new Set<string>(primary.emails ?? [])
    const allPhones = new Set<string>(primary.phones ?? [])
    const allTags = new Set<string>(primary.tags ?? [])

    for (const rec of mergeRecords) {
      for (const e of (rec.emails ?? [])) allEmails.add(e)
      for (const p of (rec.phones ?? [])) allPhones.add(p)
      for (const t of (rec.tags ?? [])) allTags.add(t)
    }

    const updates: Record<string, unknown> = {
      emails: [...allEmails],
      phones: [...allPhones],
      tags: [...allTags],
    }

    if (fieldOverrides) {
      for (const [key, value] of Object.entries(fieldOverrides)) {
        const dbKey = camelToSnake(key)
        updates[dbKey] = value
      }
    }

    const { error: updateErr } = await db.from('crm_contacts').update(updates).eq('id', primaryId)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    for (const mergeId of mergeIds) {
      await db.from('crm_activities').update({ contact_id: primaryId }).eq('contact_id', mergeId)
      await db.from('deals').update({ 'contact->>id': primaryId } as Record<string, unknown>).eq('contact->>id' as string, mergeId)
    }

    const { error: deleteErr } = await db.from('crm_contacts').delete().in('id', mergeIds)
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    await logAudit({
      userName: 'System',
      action: `Merged ${mergeIds.length} contact(s) into ${primary.full_name ?? primaryId}`,
      module: 'CRM',
      type: 'action',
      metadata: { primaryId, mergeIds, type: 'contact_merge' },
    })

    return NextResponse.json({ success: true, primaryId, mergedCount: mergeIds.length })
  }

  if (type === 'companies') {
    const { data: primary, error: pErr } = await db.from('crm_companies').select('*').eq('id', primaryId).single()
    if (pErr || !primary) return NextResponse.json({ error: 'Primary company not found' }, { status: 404 })

    const { data: mergeRecords, error: mErr } = await db.from('crm_companies').select('*').in('id', mergeIds)
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })
    if (!mergeRecords?.length) return NextResponse.json({ error: 'No merge records found' }, { status: 404 })

    const allTags = new Set<string>(primary.tags ?? [])
    const allContactIds = new Set<string>(primary.contact_ids ?? [])
    const allDealIds = new Set<string>(primary.deal_ids ?? [])

    for (const rec of mergeRecords) {
      for (const t of (rec.tags ?? [])) allTags.add(t)
      for (const cid of (rec.contact_ids ?? [])) allContactIds.add(cid)
      for (const did of (rec.deal_ids ?? [])) allDealIds.add(did)
    }

    const updates: Record<string, unknown> = {
      tags: [...allTags],
      contact_ids: [...allContactIds],
      deal_ids: [...allDealIds],
    }

    if (fieldOverrides) {
      for (const [key, value] of Object.entries(fieldOverrides)) {
        const dbKey = camelToSnake(key)
        updates[dbKey] = value
      }
    }

    const { error: updateErr } = await db.from('crm_companies').update(updates).eq('id', primaryId)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    for (const mergeId of mergeIds) {
      const mergeRec = mergeRecords.find(r => r.id === mergeId)
      if (!mergeRec) continue

      await db.from('crm_contacts').update({ company_id: primaryId, company_name: primary.name }).eq('company_id', mergeId)
      await db.from('deals').update({ company: primary.name }).eq('company', mergeRec.name)
      await db.from('contracts').update({ company: primary.name }).eq('company', mergeRec.name)
      await db.from('invoices').update({ company: primary.name }).eq('company', mergeRec.name)
      await db.from('projects').update({ company: primary.name }).eq('company', mergeRec.name)
      await db.from('proposals').update({ company: primary.name }).eq('company', mergeRec.name)
      await db.from('crm_activities').update({ company_id: primaryId, company_name: primary.name }).eq('company_id', mergeId)
    }

    const { error: deleteErr } = await db.from('crm_companies').delete().in('id', mergeIds)
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    await logAudit({
      userName: 'System',
      action: `Merged ${mergeIds.length} company(ies) into ${primary.name ?? primaryId}`,
      module: 'CRM',
      type: 'action',
      metadata: { primaryId, mergeIds, type: 'company_merge' },
    })

    return NextResponse.json({ success: true, primaryId, mergedCount: mergeIds.length })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}
