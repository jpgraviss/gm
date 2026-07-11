import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'

const SERVICE_TYPES = ['Website', 'SEO', 'PPC', 'Social Media', 'Branding', 'Maintenance', 'Custom']

const STEP_NAMES = [
  'Contract Signed',
  'Invoice & Payment',
  'Welcome Email',
  'Portal Access',
  'Strategy Call',
  'Usage Guide & Resources',
  'Deliverables',
  'Reporting & Analytics',
]

const STEP_STATUS_COLUMNS = [
  'step_01_agreement', 'step_02_invoice', 'step_03_welcome', 'step_04_portal',
  'step_05_strategy_call', 'step_06_usage_guide', 'step_07_fulfillment', 'step_08_monthly_report',
]

const STEP_COMPLETED_AT_COLUMNS: Record<number, string | null> = {
  1: 'step_01_completed_at',
  2: 'step_02_completed_at',
  3: null,
  4: null,
  5: 'step_05_completed_at',
  6: null,
  7: 'step_07_completed_at',
  8: null,
}

function toStepStatus(raw: string | null | undefined): 'completed' | 'in_progress' | 'pending' {
  if (raw === 'Completed' || raw === 'Skipped') return 'completed'
  if (raw === 'In Progress') return 'in_progress'
  return 'pending'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkflow(row: any) {
  const steps = STEP_NAMES.map((name, i) => {
    const stepNum = i + 1
    const status = toStepStatus(row[STEP_STATUS_COLUMNS[i]])
    const completedAtCol = STEP_COMPLETED_AT_COLUMNS[stepNum]
    return {
      step: stepNum,
      name,
      status,
      completedDate: completedAtCol ? (row[completedAtCol] ?? undefined) : undefined,
    }
  })
  const currentStep = steps.find(s => s.status !== 'completed')?.step ?? STEP_NAMES.length

  return {
    id: row.id,
    company: row.company_name,
    companyId: row.company_id ?? undefined,
    service: row.service_type,
    projectId: row.project_id ?? undefined,
    currentStep,
    steps,
    startedDate: row.created_at,
    lastUpdated: row.updated_at ?? row.created_at,
  }
}

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

  return NextResponse.json(mapWorkflow(data), { status: 201 })
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
  return paginatedJson(rows.map(mapWorkflow), nextCursor)
})
