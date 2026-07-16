import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

const TYPE_META: Record<string, { color: string; href: string }> = {
  call:     { color: '#3b82f6', href: '/crm/contacts' },
  email:    { color: '#f59e0b', href: '/crm/contacts' },
  meeting:  { color: '#8b5cf6', href: '/crm/contacts' },
  note:     { color: '#6b7280', href: '/crm/contacts' },
  task:     { color: '#f97316', href: '/tasks' },
  deal:     { color: '#3b82f6', href: '/deals' },
  contract: { color: '#015035', href: '/contracts' },
  invoice:  { color: '#22c55e', href: '/billing' },
  proposal: { color: '#8b5cf6', href: '/proposals' },
}

export const GET = withErrorHandler('notifications GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_activities')
    .select('id, type, title, body, company_name, contact_name, timestamp, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[notifications GET]', error)
    return NextResponse.json([])
  }

  const now = Date.now()
  const notifications = (data ?? []).map(row => {
    const meta = TYPE_META[row.type] ?? { color: '#6b7280', href: '/crm/contacts' }
    const age = now - new Date(row.created_at).getTime()
    const mins = Math.floor(age / 60000)
    let time = 'just now'
    if (mins >= 525600) time = `${Math.floor(mins / 525600)}y ago`
    else if (mins >= 43200) time = `${Math.floor(mins / 43200)}mo ago`
    else if (mins >= 1440) time = `${Math.floor(mins / 1440)}d ago`
    else if (mins >= 60) time = `${Math.floor(mins / 60)}h ago`
    else if (mins >= 1) time = `${mins}m ago`

    const subject = row.contact_name || row.company_name || ''
    const bodyText = subject
      ? `${subject}${row.body ? ' — ' + row.body : ''}`
      : row.body || ''

    return {
      id: row.id,
      type: row.type,
      color: meta.color,
      title: row.title,
      body: bodyText.slice(0, 120),
      time,
      href: meta.href,
      unread: age < 86400000,
    }
  })

  return NextResponse.json(notifications)
})
