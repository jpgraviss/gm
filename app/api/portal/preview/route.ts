import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  if (!company) {
    return NextResponse.json({ error: 'company param is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const [
    clientRes,
    contractsRes,
    projectsRes,
    invoicesRes,
    ticketsRes,
  ] = await Promise.all([
    db.from('portal_clients').select('*').eq('company', company).limit(1).maybeSingle(),
    db.from('contracts').select('*').eq('company', company).order('created_at', { ascending: false }),
    db.from('projects').select('*').eq('company', company).order('created_at', { ascending: false }),
    db.from('invoices').select('*').eq('company', company).order('created_at', { ascending: false }).limit(10),
    db.from('tickets').select('*').eq('company', company).order('created_at', { ascending: false }).limit(5),
  ])

  const portalClient = clientRes.data
  const portalConfig = (portalClient?.portal_config as Record<string, unknown>) ?? {}
  const services: string[] = (portalClient?.services as string[]) ?? []

  const contracts = (contractsRes.data ?? []).map((row) => ({
    id: row.id,
    company: row.company,
    status: row.status,
    value: row.value,
    serviceType: row.service_type,
    billingStructure: row.billing_structure,
    startDate: row.start_date ?? '',
    duration: row.duration,
    renewalDate: row.renewal_date ?? '',
    clientSigned: row.client_signed ?? undefined,
    internalSigned: row.internal_signed ?? undefined,
  }))

  const projects = (projectsRes.data ?? []).map((row) => ({
    id: row.id,
    company: row.company,
    serviceType: row.service_type,
    status: row.status,
    startDate: row.start_date ?? '',
    launchDate: row.launch_date ?? '',
    progress: row.progress ?? 0,
    milestones: row.milestones ?? [],
    assignedTeam: row.assigned_team ?? [],
    overview: row.overview ?? '',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices = (invoicesRes.data ?? []).map((row: any) => ({
    id: row.id,
    company: row.company,
    amount: row.amount,
    status: row.status,
    dueDate: row.due_date ?? '',
    issuedDate: row.issued_date ?? '',
    paidDate: row.paid_date ?? undefined,
    serviceType: row.service_type ?? '',
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (ticketsRes.data ?? []).map((row: any) => ({
    id: row.id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    createdDate: row.created_at ?? row.created_date ?? '',
  }))

  let recentActivity: Array<{ id: string; type: string; title: string; message: string | null; link: string | null; createdAt: string }> = []
  if (portalClient?.id) {
    const nRes = await db
      .from('portal_notifications')
      .select('*')
      .eq('portal_client_id', portalClient.id)
      .order('created_at', { ascending: false })
      .limit(10)
    recentActivity = (nRes.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      createdAt: n.created_at,
    }))
  }

  return NextResponse.json({
    portalConfig,
    services,
    company: portalClient ? {
      name: portalClient.company,
      contact: portalClient.contact,
      email: portalClient.email,
      service: portalClient.service,
      companyId: portalClient.company_id ?? null,
      createdAt: portalClient.created_at ?? null,
    } : null,
    contracts,
    projects,
    invoices,
    tickets,
    recentActivity,
  })
}
