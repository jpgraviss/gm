import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

export interface TimelineEntry {
  id: string
  type: 'email_sent' | 'email_opened' | 'link_clicked' | 'proposal_sent' | 'proposal_viewed' |
        'contract_signed' | 'contract_created' | 'invoice_paid' | 'invoice_sent' |
        'ticket_created' | 'deal_updated' | 'note_added' | 'task_completed' |
        'call' | 'meeting' | 'activity'
  title: string
  description?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export const GET = withErrorHandler('crm/contacts/[id]/timeline GET', async (_req, ctx) => {
  const { id } = await ctx!.params
  const db = createServiceClient()

  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, company_name, company_id, emails')
    .eq('id', id)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const companyName = contact.company_name ?? ''
  const contactEmails: string[] = contact.emails ?? []
  const timeline: TimelineEntry[] = []

  const [
    activitiesRes,
    broadcastRes,
    proposalsRes,
    contractsRes,
    invoicesRes,
    ticketsRes,
  ] = await Promise.all([
    db.from('crm_activities')
      .select('*')
      .or(`contact_id.eq.${id},company_id.eq.${contact.company_id}`)
      .order('timestamp', { ascending: false })
      .limit(100),

    contactEmails.length > 0
      ? db.from('broadcast_recipients')
          .select('id, broadcast_id, email, status, sent_at, opened_at, clicked_at')
          .in('email', contactEmails)
          .order('sent_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),

    companyName
      ? db.from('proposals')
          .select('id, company, status, value, service_type, created_date, sent_date, viewed_date, responded_date')
          .eq('company', companyName)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),

    companyName
      ? db.from('contracts')
          .select('id, company, status, value, service_type, start_date, client_signed')
          .eq('company', companyName)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),

    companyName
      ? db.from('invoices')
          .select('id, company, amount, status, due_date, issued_date, paid_date, service_type')
          .eq('company', companyName)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null }),

    db.from('tickets')
      .select('id, subject, company, contact_name, contact_email, status, priority, created_date')
      .or(
        [
          contact.company_name ? `company.eq.${contact.company_name}` : '',
          ...contactEmails.map(e => `contact_email.eq.${e}`),
        ].filter(Boolean).join(',')
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  for (const act of (activitiesRes.data ?? [])) {
    const typeMap: Record<string, TimelineEntry['type']> = {
      call: 'call', email: 'email_sent', meeting: 'meeting', note: 'note_added',
      task: 'task_completed', deal: 'deal_updated', contract: 'contract_created',
      invoice: 'invoice_sent', proposal: 'proposal_sent',
    }
    timeline.push({
      id: act.id,
      type: typeMap[act.type] ?? 'activity',
      title: act.title,
      description: act.body ?? undefined,
      timestamp: act.timestamp,
      metadata: { user: act.user_name, outcome: act.outcome, duration: act.duration },
    })
  }

  for (const r of (broadcastRes.data ?? [])) {
    if (r.sent_at) {
      timeline.push({
        id: `br-${r.id}-sent`,
        type: 'email_sent',
        title: 'Broadcast email sent',
        description: `Sent to ${r.email}`,
        timestamp: r.sent_at,
        metadata: { broadcastId: r.broadcast_id, email: r.email },
      })
    }
    if (r.opened_at) {
      timeline.push({
        id: `br-${r.id}-opened`,
        type: 'email_opened',
        title: 'Email opened',
        description: `${r.email} opened the email`,
        timestamp: r.opened_at,
        metadata: { broadcastId: r.broadcast_id },
      })
    }
    if (r.clicked_at) {
      timeline.push({
        id: `br-${r.id}-clicked`,
        type: 'link_clicked',
        title: 'Link clicked',
        description: `${r.email} clicked a link`,
        timestamp: r.clicked_at,
        metadata: { broadcastId: r.broadcast_id },
      })
    }
  }

  for (const p of (proposalsRes.data ?? [])) {
    timeline.push({
      id: `prop-${p.id}`,
      type: 'proposal_sent',
      title: `Proposal: ${p.service_type}`,
      description: `${p.status} · $${(p.value ?? 0).toLocaleString()}`,
      timestamp: p.sent_date ?? p.created_date ?? '',
      metadata: { proposalId: p.id, value: p.value, status: p.status },
    })
    if (p.viewed_date) {
      timeline.push({
        id: `prop-${p.id}-viewed`,
        type: 'proposal_viewed',
        title: `Proposal viewed: ${p.service_type}`,
        timestamp: p.viewed_date,
        metadata: { proposalId: p.id },
      })
    }
  }

  for (const c of (contractsRes.data ?? [])) {
    timeline.push({
      id: `con-${c.id}`,
      type: c.client_signed ? 'contract_signed' : 'contract_created',
      title: `Contract: ${c.service_type}`,
      description: `${c.status} · $${(c.value ?? 0).toLocaleString()}`,
      timestamp: c.client_signed ?? c.start_date ?? '',
      metadata: { contractId: c.id, value: c.value, status: c.status },
    })
  }

  for (const inv of (invoicesRes.data ?? [])) {
    timeline.push({
      id: `inv-${inv.id}`,
      type: inv.status === 'Paid' ? 'invoice_paid' : 'invoice_sent',
      title: `Invoice: ${inv.service_type}`,
      description: `$${(inv.amount ?? 0).toLocaleString()} · ${inv.status}`,
      timestamp: inv.paid_date ?? inv.issued_date ?? inv.due_date ?? '',
      metadata: { invoiceId: inv.id, amount: inv.amount, status: inv.status },
    })
  }

  for (const t of (ticketsRes.data ?? [])) {
    timeline.push({
      id: `tkt-${t.id}`,
      type: 'ticket_created',
      title: t.subject,
      description: `${t.priority} priority · ${t.status}`,
      timestamp: t.created_date ?? '',
      metadata: { ticketId: t.id, status: t.status, priority: t.priority },
    })
  }

  timeline.sort((a, b) => {
    const da = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const db = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return db - da
  })

  const { data: settings } = await db
    .from('app_settings')
    .select('engagement')
    .eq('id', 'global')
    .maybeSingle()

  const pts = {
    emailOpened: 5,
    linkClicked: 10,
    proposalViewed: 15,
    meetingHeld: 20,
    ...((settings?.engagement as Record<string, unknown> | null)?.points as Record<string, number> | undefined),
  }

  const emailsOpened = (broadcastRes.data ?? []).filter(r => r.opened_at).length
  const linksClicked = (broadcastRes.data ?? []).filter(r => r.clicked_at).length
  const proposalsViewed = (proposalsRes.data ?? []).filter(p => p.viewed_date).length
  const meetings = (activitiesRes.data ?? []).filter(a => a.type === 'meeting').length
  const engagementScore = (emailsOpened * pts.emailOpened) + (linksClicked * pts.linkClicked) + (proposalsViewed * pts.proposalViewed) + (meetings * pts.meetingHeld)

  return NextResponse.json({
    timeline,
    engagementScore,
    engagementBreakdown: { emailsOpened, linksClicked, proposalsViewed, meetings },
    engagementPoints: pts,
  })
})
