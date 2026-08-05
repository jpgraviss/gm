import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/rbac'
import { contractMonthlyValue } from '@/lib/metrics'
import type { OccupationalUnit } from '@/lib/types'

/** Units that must never receive financial data */
const RESTRICTED_UNITS: OccupationalUnit[] = ['Contractors', 'Client']

function isRestrictedUnit(unit: string | null): boolean {
  return !!unit && RESTRICTED_UNITS.includes(unit as OccupationalUnit)
}

export const GET = withErrorHandler('dashboard GET', async (req) => {
  // Previously had zero auth at all, and the financial-redaction check
  // below trusted a client-supplied `unit`/`role` query param that no real
  // caller ever sent — meaning the route was both fully public AND its one
  // "protection" was dead code even for legitimate use. Derive the real
  // unit from the caller's own team_members row instead.
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const unit = user.unit
  const db = createServiceClient()

  // Capped at 5000 (not the implicit 1000-row Supabase default) — this
  // route aggregates every deal/invoice/contract/renewal for dashboard KPIs
  // (pipelineValue, winRate, totalCollected, overdueInvoices, etc.), not a
  // paginated list, so it needs an explicit generous cap rather than relying
  // on the implicit default. Same convention as app/api/reports/attribution.
  // Projects, tickets, and proposals were previously never queried here at
  // all — the executive dashboard showed a finance/pipeline-only snapshot,
  // so a company could have every ticket escalating and every project
  // stalled and the first screen anyone sees on login showed nothing.
  const [dealsRes, invoicesRes, contractsRes, renewalsRes, activityRes, automationsRes, activeClientsRes, projectsRes, ticketsRes, proposalsRes] = await Promise.all([
    db.from('deals').select('id,stage,value,company,assigned_rep,last_activity,service_type,close_date,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('invoices').select('id,company,amount,amount_paid,status,due_date,issued_date,paid_date,service_type,contract_id,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('contracts').select('id,company,status,value,renewal_date,service_type,assigned_rep,billing_structure,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('renewals').select('id,company,status,days_until_expiry,expiration_date').order('expiration_date', { ascending: true }).limit(5000),
    db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('automations').select('id,name,status,runs').order('created_at', { ascending: false }).limit(10),
    db.from('crm_companies').select('id', { count: 'exact', head: true }).eq('status', 'Active Client'),
    db.from('projects').select('id,company,status,service_type,progress,created_at').order('created_at', { ascending: false }).limit(5000),
    db.from('tickets').select('id,company,subject,status,priority,assigned_to,created_date').order('created_date', { ascending: false }).limit(5000),
    db.from('proposals').select('id,company,status,value,service_type,created_at').order('created_at', { ascending: false }).limit(5000),
  ])

  const deals     = dealsRes.data    ?? []
  const invoices  = invoicesRes.data ?? []
  const contracts = contractsRes.data ?? []
  const renewals  = renewalsRes.data ?? []
  const auditLogs = activityRes.data ?? []
  const projects  = projectsRes.data  ?? []
  const tickets   = ticketsRes.data   ?? []
  const proposals = proposalsRes.data ?? []

  // Delivery + Support + outstanding-proposal health, so the home dashboard
  // reflects the whole business rather than just money and pipeline.
  const activeProjects  = projects.filter((p: { status: string }) => p.status !== 'Completed' && p.status !== 'Cancelled').length
  const atRiskProjects  = projects.filter((p: { status: string }) => p.status === 'At Risk' || p.status === 'Blocked').length
  const openTickets     = tickets.filter((t: { status: string }) => t.status !== 'Resolved' && t.status !== 'Closed').length
  const urgentTickets   = tickets.filter((t: { status: string; priority: string }) =>
    t.status !== 'Resolved' && t.status !== 'Closed' && (t.priority === 'Urgent' || t.priority === 'High')).length
  const pendingProposals = proposals.filter((p: { status: string }) => p.status === 'Sent' || p.status === 'Viewed').length
  const pendingProposalValue = proposals
    .filter((p: { status: string }) => p.status === 'Sent' || p.status === 'Viewed')
    .reduce((s: number, p: { value: number | null }) => s + (p.value ?? 0), 0)

  const activeClients   = activeClientsRes.count ?? 0
  const openDeals       = deals.filter(d => !d.stage.startsWith('Closed')).length
  const pipelineValue   = deals.filter(d => !d.stage.startsWith('Closed')).reduce((s: number, d: { value: number }) => s + (d.value ?? 0), 0)
  // AUDIT #587 — an invoice's `amount` can be edited after Stripe payment
  // (#358); `amount_paid` records what was actually charged. Prefer it,
  // falling back to `amount` only when unset (manual/non-Stripe payments).
  const totalCollected  = invoices.filter((i: { status: string }) => i.status === 'Paid').reduce((s: number, i: { amount: number; amount_paid: number | null }) => s + (i.amount_paid ?? i.amount ?? 0), 0)
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
  const contracts30d = contracts.filter(c => c.created_at >= thirtyDaysAgo).length
  const invoices30d = invoices.filter(i => i.created_at >= thirtyDaysAgo).length

  const recentDeals     = deals.slice(0, 5).map((d: Record<string, unknown>) => ({ id: d.id, company: d.company, stage: d.stage, value: d.value, serviceType: d.service_type, lastActivity: d.last_activity }))
  const recentContracts = contracts.slice(0, 5).map((c: Record<string, unknown>) => ({ id: c.id, company: c.company, status: c.status, value: c.value, renewalDate: c.renewal_date, serviceType: c.service_type }))
  const recentInvoices  = invoices.slice(0, 5).map((i: Record<string, unknown>) => ({ id: i.id, company: i.company, amount: i.amount, status: i.status, dueDate: i.due_date, serviceType: i.service_type, contractId: i.contract_id }))

  const activityFeed = auditLogs.map((a: Record<string, unknown>) => ({
    id: a.id, user: a.user_name, action: a.action, module: a.module, type: a.type,
    timestamp: a.created_at,
  }))

  // AUDIT.md #447 — `revenue_months` is only ever written by the optional,
  // non-default 'Update Revenue Metrics' automation action (lib/automations-
  // engine.ts), and even when that automation exists it only upserts the
  // *current* month on each run — it never backfills history, so a 12-month
  // trend built from it is holed by design. Worse, what it writes as
  // "revenue" is actually contract MRR (contractMonthlyValue over 'Fully
  // Executed' contracts), not real collected revenue, and its "recurring"
  // field is always identical to "revenue" (contractMonthlyValue already
  // zeroes out non-recurring billing structures before the sum, so filtering
  // them out again changes nothing) — the two numbers carry no distinct
  // information. None of that is worth preferring over a live computation,
  // so we compute the trend directly from real data every time, the same
  // way the "Revenue Collected" KPI on the Reports pages already does
  // (paid invoices, bucketed by issuedDate — same field/status filter used
  // there), and reuse contractMonthlyValue() from lib/metrics to classify
  // which of those paid invoices are tied to a recurring contract.
  const trailingMonthKeys: string[] = (() => {
    const anchor = new Date()
    anchor.setDate(1)
    const keys: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return keys
  })()

  const contractById = new Map(contracts.map((c: Record<string, unknown>) => [c.id, c]))
  const revenueByMonthMap = new Map(
    trailingMonthKeys.map(month => [month, { month, revenue: 0, recurring: 0 }])
  )

  invoices
    .filter((i: { status: string }) => i.status === 'Paid')
    .forEach((i: Record<string, unknown>) => {
      const issuedDate = i.issued_date as string | null
      const month = issuedDate ? issuedDate.slice(0, 7) : null
      const bucket = month ? revenueByMonthMap.get(month) : undefined
      if (!bucket) return // outside the trailing 12-month window
      // AUDIT #587 — prefer amount_paid (what Stripe actually charged) over
      // the editable amount field, same fix as totalCollected above.
      const amount = Number(i.amount_paid ?? i.amount) || 0
      bucket.revenue += amount
      const contract = i.contract_id ? contractById.get(i.contract_id as string) : undefined
      if (contract && contractMonthlyValue({
        value: Number(contract.value) || 0,
        billingStructure: (contract.billing_structure as string) ?? '',
      }) > 0) {
        bucket.recurring += amount
      }
    })

  const revenueByMonth = Array.from(revenueByMonthMap.values())

  const automations = (automationsRes.data ?? []).map((a: Record<string, unknown>) => ({
    name: a.name, status: a.status, runs: a.runs ?? 0,
  }))

  // ── Role-based filtering: strip financial data for Contractors & Client ──
  if (isRestrictedUnit(unit)) {
    return NextResponse.json({
      metrics: {
        activeClients,
        openDeals,
        pipelineValue: 0,
        overdueInvoices: 0,
        upcomingRenewals,
        totalCollected: 0,
        totalInvoiced: 0,
        totalOverdue: 0,
        totalPending: 0,
        winRate: 0,
        avgDealSize: 0,
        totalDealValue: 0,
        deals30d,
        contracts30d,
        invoices30d,
        activeProjects,
        atRiskProjects,
        openTickets,
        urgentTickets,
        // Deliberately zeroed for the contractor view alongside every other
        // financial figure above.
        pendingProposals: 0,
        pendingProposalValue: 0,
      },
      recentDeals: recentDeals.map((d: Record<string, unknown>) => ({ ...d, value: 0 })),
      recentContracts: recentContracts.map((c: Record<string, unknown>) => ({ ...c, value: 0 })),
      recentInvoices: [],
      activityFeed: activityFeed.filter((a: Record<string, unknown>) => a.module !== 'invoices' && a.module !== 'billing'),
      revenueByMonth: [],
      automations,
    })
  }

  return NextResponse.json({
    metrics: {
      activeClients, openDeals, pipelineValue, overdueInvoices, upcomingRenewals,
      totalCollected, totalInvoiced, totalOverdue, totalPending,
      winRate, avgDealSize, totalDealValue,
      deals30d, contracts30d, invoices30d,
      activeProjects, atRiskProjects, openTickets, urgentTickets,
      pendingProposals, pendingProposalValue,
    },
    recentDeals,
    recentContracts,
    recentInvoices,
    activityFeed,
    revenueByMonth,
    automations,
  })
})
