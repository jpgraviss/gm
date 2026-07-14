import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { getCompanyRelatedCounts, hasBlockingRelatedRecords, describeRelatedCounts, deleteCompanyActivities } from '@/lib/crm-cascade'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompany(row: any) {
  return {
    id:             row.id,
    name:           row.name,
    industry:       row.industry,
    website:        row.website ?? undefined,
    phone:          row.phone ?? undefined,
    hq:             row.hq,
    size:           row.size,
    annualRevenue:  row.annual_revenue ?? undefined,
    status:         row.status,
    owner:          row.owner,
    description:    row.description ?? undefined,
    tags:           row.tags ?? [],
    contactIds:     row.contact_ids ?? [],
    dealIds:        row.deal_ids ?? [],
    totalDealValue: row.total_deal_value ?? 0,
    createdDate:    row.created_date ?? '',
    lastActivity:   row.last_activity ?? undefined,
    notes:          row.notes ?? undefined,
  }
}

export const PUT = withErrorHandler('crm/companies/[id] PUT', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    name:     { required: true, type: 'string', maxLength: 200 },
    industry: { type: 'string', maxLength: 100 },
    website:  { type: 'string', maxLength: 500 },
    phone:    { type: 'string', maxLength: 50 },
    size:     { type: 'string', maxLength: 50 },
    status:   { type: 'string', enum: ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned'] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_companies')
    .update({
      name:             body.name,
      industry:         body.industry,
      website:          body.website ?? null,
      phone:            body.phone ?? null,
      hq:               body.hq,
      size:             body.size,
      annual_revenue:   body.annualRevenue ?? null,
      status:           body.status,
      owner:            body.owner,
      description:      body.description ?? null,
      tags:             body.tags ?? [],
      contact_ids:      body.contactIds ?? [],
      deal_ids:         body.dealIds ?? [],
      total_deal_value: body.totalDealValue ?? 0,
      last_activity:    body.lastActivity ?? null,
      notes:            body.notes ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to update company')
  }
  return NextResponse.json(mapCompany(data))
})

export const PATCH = withErrorHandler('crm/companies/[id] PATCH', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    status: { type: 'string', enum: ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned'] },
    tags:   { type: 'array' },
    notes:  { type: 'string', maxLength: 20000 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const updates: Record<string, unknown> = {}
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.status !== undefined) updates.status = body.status
  if (body.lastActivity !== undefined) updates.last_activity = body.lastActivity
  if (body.notes !== undefined) updates.notes = body.notes
  const { data, error } = await db
    .from('crm_companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to update company')
  }
  return NextResponse.json(mapCompany(data))
})

export const DELETE = withErrorHandler('crm/companies/[id] DELETE', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const db = createServiceClient()

  const { data: company } = await db.from('crm_companies').select('id, name').eq('id', id).single()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // AUDIT #96: block rather than cascade-destroy real business records —
  // irreversible data loss outweighs the inconvenience of requiring
  // reassignment first. The company's own activity log is the one
  // exception (see deleteCompanyActivities) since it has no independent
  // value once the company itself is gone.
  const counts = await getCompanyRelatedCounts(db, company.id, company.name)
  if (hasBlockingRelatedRecords(counts)) {
    return NextResponse.json({
      error: `Cannot delete "${company.name}" — it still has ${describeRelatedCounts(counts)}. Reassign or remove these first.`,
      relatedCounts: counts,
    }, { status: 409 })
  }

  await deleteCompanyActivities(db, company.id, company.name)

  const { error } = await db.from('crm_companies').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete company')
  }
  logAudit({ userName: 'system', action: 'deleted_company', module: 'crm', type: 'warning', metadata: { companyId: id, companyName: company.name } })
  return NextResponse.json({ success: true })
})
