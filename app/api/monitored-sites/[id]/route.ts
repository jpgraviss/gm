import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSite(row: any) {
  return {
    id:                   row.id,
    workspaceId:          row.workspace_id,
    companyId:            row.company_id ?? null,
    companyName:          row.company_name,
    url:                  row.url,
    checkIntervalMinutes: row.check_interval_minutes,
    alertEmails:          row.alert_emails ?? [],
    status:               row.status,
    lastCheckAt:          row.last_check_at,
    lastUpAt:             row.last_up_at,
    lastDownAt:           row.last_down_at,
    responseTimeMs:       row.response_time_ms,
    uptime30d:            row.uptime_30d,
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
    isWordPress:          row.is_wordpress ?? false,
  }
}

export const GET = withErrorHandler('monitored-sites/[id] GET', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('monitored_sites').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Monitored site not found' }, { status: 404 })
  }

  // Include recent checks (last 50) for convenience
  const { data: checks } = await db
    .from('uptime_checks')
    .select('*')
    .eq('site_id', id)
    .order('checked_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    ...mapSite(data),
    recentChecks: (checks ?? []).map((c: {
      id: string
      checked_at: string
      status_code: number | null
      response_time_ms: number | null
      up: boolean
      error_message: string | null
    }) => ({
      id:             c.id,
      checkedAt:      c.checked_at,
      statusCode:     c.status_code,
      responseTimeMs: c.response_time_ms,
      up:             c.up,
      errorMessage:   c.error_message,
    })),
  })
})

export const PATCH = withErrorHandler('monitored-sites/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.companyName !== undefined)          update.company_name = body.companyName
  if (body.companyId !== undefined)             update.company_id = body.companyId
  if (body.url !== undefined) {
    let url = String(body.url).trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    update.url = url
  }
  if (body.checkIntervalMinutes !== undefined) update.check_interval_minutes = body.checkIntervalMinutes
  if (body.alertEmails !== undefined) {
    update.alert_emails = Array.isArray(body.alertEmails)
      ? body.alertEmails
      : typeof body.alertEmails === 'string'
        ? body.alertEmails.split(',').map((s: string) => s.trim()).filter(Boolean)
        : []
  }
  if (body.status !== undefined)                update.status = body.status
  if (body.wpUsername !== undefined)             update.wp_username = body.wpUsername
  if (body.wpAppPassword !== undefined)          update.wp_app_password = body.wpAppPassword

  const { data, error } = await db
    .from('monitored_sites')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update monitored site')
  }
  return NextResponse.json(mapSite(data))
})

export const DELETE = withErrorHandler('monitored-sites/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('monitored_sites').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete monitored site')
  }
  logAudit({
    userName: 'system',
    action: 'deleted_monitored_site',
    module: 'monitoring',
    type: 'warning',
    metadata: { siteId: id },
  })
  return NextResponse.json({ deleted: id })
})
