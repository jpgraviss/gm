import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/admin-auth'
import { withErrorHandler } from '@/lib/api-handler'

const ENTITY_CONFIGS: Record<string, { table: string; columns: string }> = {
  contacts:    { table: 'crm_contacts',  columns: 'id, first_name, last_name, title, company_name, created_at' },
  companies:   { table: 'crm_companies', columns: 'id, name, industry, website, phone, hq, size, status, created_at' },
  deals:       { table: 'deals',         columns: 'id, company, stage, value, service_type, close_date, assigned_rep, created_at' },
  projects:    { table: 'projects',      columns: 'id, company, service_type, status, start_date, progress, created_at' },
  contracts:   { table: 'contracts',     columns: 'id, company, status, value, start_date, renewal_date, service_type, created_at' },
  invoices:    { table: 'invoices',      columns: 'id, company, amount, status, due_date, issued_date, paid_date, service_type, created_at' },
  tasks:       { table: 'tasks',         columns: 'id, title, assigned_to, due_date, status, priority, category, created_at' },
  time_entries:{ table: 'time_entries',   columns: 'id, date, project_name, description, team_member, hours, minutes, billable, created_at' },
}

function toCsvRow(values: string[]): string {
  return values.map(v => {
    const s = v ?? ''
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }).join(',')
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  let body: { entities?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const entities = body.entities
  if (!entities || !Array.isArray(entities) || entities.length === 0) {
    return NextResponse.json({ error: 'No entities selected' }, { status: 400 })
  }

  const db = createServiceClient()
  const csvSections: string[] = []

  for (const entity of entities) {
    const config = ENTITY_CONFIGS[entity]
    if (!config) continue

    const { data, error } = await db
      .from(config.table)
      .select(config.columns)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      console.error(`[export] Error fetching ${entity}:`, error)
      continue
    }

    if (!data || data.length === 0) continue

    const cols = config.columns.split(',').map(c => c.trim())
    const header = toCsvRow(cols)
    const rows = data.map(row =>
      toCsvRow(cols.map(col => String((row as unknown as Record<string, unknown>)[col] ?? '')))
    )

    csvSections.push(`--- ${entity.toUpperCase()} ---`)
    csvSections.push(header)
    csvSections.push(...rows)
    csvSections.push('')
  }

  if (csvSections.length === 0) {
    return NextResponse.json({ error: 'No data found for selected entities' }, { status: 404 })
  }

  logAudit({
    userName: 'admin',
    action: `exported_data: ${entities.join(', ')}`,
    module: 'admin',
    type: 'action',
  })

  return new NextResponse(csvSections.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="gravhub-export-${Date.now()}.csv"`,
    },
  })
}
