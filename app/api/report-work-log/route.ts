import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkLog(row: any, companyName: string, periodStart: string, periodEnd: string) {
  return {
    companyName,
    periodStart,
    periodEnd,
    categories: row?.categories ?? [],
    nextMonth: row?.next_month ?? [],
    updatedBy: row?.updated_by ?? undefined,
    updatedAt: row?.updated_at ?? undefined,
  }
}

export const GET = withErrorHandler('report-work-log GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const companyName = searchParams.get('companyName')
  const periodStart = searchParams.get('periodStart')
  const periodEnd = searchParams.get('periodEnd')
  if (!companyName || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'companyName, periodStart, and periodEnd are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('report_work_log')
    .select('*')
    .eq('company_name', companyName)
    .eq('period_start', periodStart)
    .maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapWorkLog(data, companyName, periodStart, periodEnd))
})

export const PUT = withErrorHandler('report-work-log PUT', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    companyName: { required: true, type: 'string', maxLength: 200 },
    periodStart: { required: true, type: 'string', maxLength: 10 },
    periodEnd:   { required: true, type: 'string', maxLength: 10 },
    categories:  { type: 'array' },
    nextMonth:   { type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('report_work_log')
    .upsert({
      id:           `rwl-${body.companyName}-${body.periodStart}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      company_name: body.companyName,
      company_id:   body.companyId ?? null,
      period_start: body.periodStart,
      period_end:   body.periodEnd,
      categories:   body.categories ?? [],
      next_month:   body.nextMonth ?? [],
      updated_by:   body.updatedBy ?? null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'company_name,period_start' })
    .select()
    .single()
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapWorkLog(data, body.companyName, body.periodStart, body.periodEnd))
})
