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

export const GET = withErrorHandler('monitored-sites GET', async () => {
  const db = createServiceClient()
  const { data, error } = await db
    .from('monitored_sites')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error?.message || 'Failed to fetch monitored sites')
  }
  return NextResponse.json((data ?? []).map(mapSite))
})

export const POST = withErrorHandler('monitored-sites POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()

  if (!body.companyName || typeof body.companyName !== 'string') {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }
  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  // Normalize URL — ensure it has a protocol
  let url = body.url.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  const alertEmails: string[] = Array.isArray(body.alertEmails)
    ? body.alertEmails.filter((e: unknown) => typeof e === 'string')
    : typeof body.alertEmails === 'string'
      ? body.alertEmails.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

  const db = createServiceClient()
  const { data, error } = await db
    .from('monitored_sites')
    .insert({
      id:                     `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company_id:             body.companyId ?? null,
      company_name:           body.companyName,
      url,
      check_interval_minutes: body.checkIntervalMinutes ?? 15,
      alert_emails:           alertEmails,
      status:                 'up',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error?.message || 'Failed to create monitored site')
  }

  logAudit({
    userName: 'system',
    action: 'created_monitored_site',
    module: 'monitoring',
    type: 'action',
    metadata: { siteId: data.id, url },
  })

  return NextResponse.json(mapSite(data), { status: 201 })
})
