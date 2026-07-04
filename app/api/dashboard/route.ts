import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { RECURRING_STATUSES } from '@/lib/metrics'

export async function GET() {
  try {
  const db = createServiceClient()

  const [dealsRes, invoicesRes, contractsRes, renewalsRes, revenueRes, activityRes, automationsRes] = await Promise.all([
    db.from('deals').select('id,stage,value,company,assigned_rep,last_activity,service_type,close_date,created_at').order('created_at', { ascending: false }),
    db.from('invoices').select('id,company,amount,status,due_date,issued_date,paid_date,service_type,contract_id,created_at').order('created_at', { ascending: false }),
    db.from('contracts').select('id,company,status,value,renewal_date,service_type,assigned_rep,billing_structure').order('created_at', { ascending: false }),
    db.from('renewals').select('id,company,status,days_until_expiry,expiration_date').order('expiration_date', { ascending: true }),
    db.from('revenue_months').select('*').order('month', { ascending: true }),
    db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('automations').select('id,name,status,runs').order('created_at', { ascending: false }).limit(10),
  ])

  const deals     = dealsRes.data    ?? []
  const invoices  = invoicesRes.data ?? []
  const contracts = contractsRes.data ?? []
  const renewals  = renewalsRes.data ?? []
  const revenueMonths = revenueRes.data ?? []
  const auditLogs = activityRes.data ?? []

  const activeClients   = contracts.filter(c => RECURRING_STATUSES.includes(c.status)).length
  const openDeals       = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).length
  const pipelineValue   = deals.filter(d => !['Closed Won','Closed Lost'].includes(d.stage)).reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
  const totalCollected  = invoices.filter((i: { status: string }) => i.status === 'Paid').reduce((s: number, i: { amount: number }) => s + (i.amount ?? 0), 0)
  const overdueInvoices = invoices.filter((i: { status: string }) => i.status === 'Overdue').length

  const now = Date.now()
  const upcomingRenewals = renewals.filter((r: { expiration_date: string; days_until_expiry: number; status: string }) => {
    if (r.status === 'Renewed') return false
    const days = r.expiration_date ? Math.ceil((new Date(r.expiration_date).getTime() - now) / 86400000) : r.days_until_expiry
    return days >= 0 && days <= 60
  }).length

  const closedWon = deals.filter(d => d.stage === 'Closed Won')
  const closedLost = deals.filter(d => d.stage === 'Closed Lost')
  const decidedDeals = closedWon.length + closedLost.length
  const winRate = decidedDeals > 0 ? Math.round((closedWon.length / decidedDeals) * 100) : 0
  const totalDealValue = closedWon.reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
  const avgDealSize = closedWon.length > 0 ? Math.round(totalDealValue / closedWon.length) : 0

  const totalInvoiced = invoices.reduce((s: number, i: { amount: number }) => s + (i.amount ?? 0), 0)
  const totalOverdue = invoices.filter((i: { status: string }) => i.status === 'Overdue').reduce((s: number, i: { amount: number }) => s + (i.amount ?? 0), 0)
  const totalPending = invoices.filter((i: { status: string }) => i.status === 'Sent' || i.status === 'Viewed').reduce((s: number, i: { amount: number }) => s + (i.amount ?? 0), 0)

  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString()
  const deals30d = deals.filter(d => d.created_at >= thirtyDaysAgo).length
  const contracts30d = contracts.filter(c => c.renewal_date >= thirtyDaysAgo || false).length
  const invoices30d = invoices.filter(i => i.created_at >= thirtyDaysAgo).length

  const recentDeals     = deals.slice(0, 5).map((d: Record<string, unknown>) => ({ id: d.id, company: d.company, stage: d.stage, value: d.value, serviceType: d.service_type, lastActivity: d.last_activity }))
  const recentContracts = contracts.slice(0, 5).map((c: Record<string, unknown>) => ({ id: c.id, company: c.company, status: c.status, value: c.value, renewalDate: c.renewal_date, serviceType: c.service_type }))
  const recentInvoices  = invoices.slice(0, 5).map((i: Record<string, unknown>) => ({ id: i.id, company: i.company, amount: i.amount, status: i.status, dueDate: i.due_date, serviceType: i.service_type, contractId: i.contract_id }))

  const activityFeed = auditLogs.map((a: Record<string, unknown>) => ({
    id: a.id, user: a.user_name, action: a.action, module: a.module, type: a.type,
    timestamp: a.created_at,
  }))

  const revenueByMonth = revenueMonths.map((r: Record<string, unknown>) => ({ month: r.month, revenue: r.revenue, recurring: r.recurring }))

  const automations = (automationsRes.data ?? []).map((a: Record<string, unknown>) => ({
    name: a.name, status: a.status, runs: a.runs ?? 0,
  }))

  return NextResponse.json({
    metrics: {
      activeClients, openDeals, pipelineValue, overdueInvoices, upcomingRenewals,
      totalCollected, totalInvoiced, totalOverdue, totalPending,
      winRate, avgDealSize, totalDealValue,
      deals30d, contracts30d, invoices30d,
    },
    recentDeals,
    recentContracts,
    recentInvoices,
    activityFeed,
    revenueByMonth,
    automations,
  })
  } catch (err) {
    console.error('[dashboard GET]', err)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
