import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const db = createServiceClient()

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const [paidRes, outstandingRes, mrrRes, activeRes] = await Promise.all([
      db
        .from('invoices')
        .select('amount')
        .eq('status', 'Paid')
        .gte('paid_date', monthStart)
        .lte('paid_date', monthEnd),
      db
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'Paid'),
      db
        .from('contracts')
        .select('value')
        .eq('status', 'Fully Executed'),
      db
        .from('crm_companies')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Active Client'),
    ])

    const revenueThisMonth = (paidRes.data ?? []).reduce(
      (sum: number, inv: { amount: number }) => sum + (inv.amount ?? 0),
      0,
    )

    const outstandingInvoices = outstandingRes.count ?? 0

    const mrr = Math.round(
      (mrrRes.data ?? []).reduce(
        (sum: number, c: { value: number }) => sum + (c.value ?? 0),
        0,
      ) / 12,
    )

    const activeClients = activeRes.count ?? 0

    return NextResponse.json({
      revenueThisMonth,
      outstandingInvoices,
      mrr,
      activeClients,
    })
  } catch (err) {
    console.error('[finance/kpis GET]', err)
    return NextResponse.json({ error: 'Failed to load KPIs' }, { status: 500 })
  }
}
