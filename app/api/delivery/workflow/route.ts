import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'

const SERVICE_TYPES = ['Website', 'SEO', 'PPC', 'Social Media', 'Branding', 'Maintenance', 'Custom']

export const POST = withErrorHandler('delivery/workflow POST', async (req: NextRequest) => {
  const body = await req.json()
  const result = validate(body, {
    companyName: { required: true, type: 'string', maxLength: 200 },
    serviceType: { type: 'string', enum: SERVICE_TYPES },
    companyId: { type: 'string', maxLength: 100 },
    projectId: { type: 'string', maxLength: 100 },
    projectName: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const id = crypto.randomUUID()

  const { data, error } = await db
    .from('delivery_workflows')
    .insert({
      id,
      company_id: body.companyId ?? null,
      project_id: body.projectId ?? null,
      company_name: body.companyName,
      project_name: body.projectName ?? null,
      service_type: body.serviceType ?? 'Website',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create workflow')
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: id,
    company_id: body.companyId ?? null,
    step: null,
    event_type: 'workflow_created',
    description: `Delivery workflow created for ${body.companyName}`,
    metadata: { service_type: body.serviceType ?? 'Website' },
  })

  return NextResponse.json(data, { status: 201 })
})

export const GET = withErrorHandler('delivery/workflow GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id')
  const pag = parsePagination(req)

  const db = createServiceClient()
  let query = db
    .from('delivery_workflows')
    .select('*')

  if (companyId) query = query.eq('company_id', companyId)
  const company = searchParams.get('company')
  if (company) query = query.eq('company_name', company)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || 'Failed to fetch workflows')
  }

  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows, nextCursor)
})
