import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
  const db = createServiceClient()

  const [dealsRes, invoicesRes, contractsRes, renewalsRes, revenueRes, activityRes] = await Promise.all([
    db.from('deals').select('id,stage,value,company,assigned_rep,last_activity,service_type,close_date').order('created_at', { ascending: false }),
    db.from('invoices').select('id,company,amount,status,due_date,issued_date,paid_date,service_type,contract_id').order('created_at', { ascending: false }),
    db.from('contracts').select('id,company,status,value,renewal_date,service_type,assigned_rep').order('created_at', { ascending: false }),
    db.from('renewals').select('id,company,status,days_until_expiry,expiration_date').order('expiration_date', { ascending: true }),
    db.from('revenue_months').select('*').order('month', { ascending: true }),
    db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  const deals     = dealsRes.data    ?? []
  const invoices  = invoicesRes.data ?? []
  const contracts = contractsRes.data ?? []
  const renewals  = renewalsRes.data ?? []
  const revenueMonths = revenueRes.data ?? []
  const auditLogs = activityRes.data ?? []

  const activeClients   = contracts.filter(c => c.status === 'Fully Executed').length
  const openDeals       = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).length
  const pipelineValue   = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
  const monthlyRevenue  = invoices.filter((i: { status: string }) => i.status === 'Paid').reduce((s: number, i: { amount: number }) => s + (i.amount ?? 0), 0)
  const overdueInvoices = invoices.filter((i: { status: string }) => i.status === 'Overdue').length
  const upcomingRenewals = renewals.filter((r: { days_until_expiry: number, status: string }) => r.days_until_expiry <= 60 && r.status !== 'Renewed').length

  const recentDeals     = deals.slice(0, 5).map((d: Record<string, unknown>) => ({ id: d.id, company: d.company, stage: d.stage, value: d.value, serviceType: d.service_type, lastActivity: d.last_activity }))
  const recentContracts = contracts.slice(0, 5).map((c: Record<string, unknown>) => ({ id: c.id, company: c.company, status: c.status, value: c.value, renewalDate: c.renewal_date, serviceType: c.service_type }))
  const recentInvoices  = invoices.slice(0, 5).map((i: Record<string, unknown>) => ({ id: i.id, company: i.company, amount: i.amount, status: i.status, dueDate: i.due_date, serviceType: i.service_type, contractId: i.contract_id }))

  const activityFeed = auditLogs.map((a: Record<string, unknown>) => ({
    id: a.id, user: a.user_name, action: a.action, module: a.module, type: a.type,
    timestamp: a.created_at,
  }))

  const revenueByMonth = revenueMonths.map((r: Record<string, unknown>) => ({ month: r.month, revenue: r.revenue, recurring: r.recurring }))

  return NextResponse.json({
    metrics: { activeClients, openDeals, pipelineValue, monthlyRevenue, overdueInvoices, upcomingRenewals },
    recentDeals,
    recentContracts,
    recentInvoices,
    activityFeed,
    revenueByMonth,
  })
  } catch (err) {
    console.error('[dashboard GET]', err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
