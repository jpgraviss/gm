import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRecommendations } from '@/lib/ai/recommendations'

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined
  const db = createServiceClient()

  const [companiesRes, contactsRes, dealsRes, contractsRes, activitiesRes] = await Promise.all([
    db.from('crm_companies').select('id, name, status, industry, owner, total_deal_value').order('name').limit(50),
    db.from('crm_contacts').select('full_name, company_name, last_activity, lifecycle_stage').order('full_name').limit(100),
    db.from('deals').select('company, stage, value, last_activity').order('created_at', { ascending: false }).limit(50),
    db.from('contracts').select('company, status, renewal_date, value').order('created_at', { ascending: false }).limit(50),
    db.from('crm_activities').select('company_name, contact_name, type, timestamp').order('timestamp', { ascending: false }).limit(200),
  ])

  const recommendations = await getRecommendations({
    companyId,
    companies: (companiesRes.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      status: c.status ?? 'Prospect',
      industry: c.industry ?? '',
      owner: c.owner ?? '',
      totalDealValue: c.total_deal_value ?? 0,
    })),
    contacts: (contactsRes.data ?? []).map(c => ({
      fullName: c.full_name,
      companyName: c.company_name ?? '',
      lastActivity: c.last_activity,
      lifecycleStage: c.lifecycle_stage,
    })),
    deals: (dealsRes.data ?? []).map(d => ({
      company: d.company ?? '',
      stage: d.stage ?? 'Lead',
      value: d.value ?? 0,
      lastActivity: d.last_activity ?? '',
    })),
    contracts: (contractsRes.data ?? []).map(c => ({
      company: c.company ?? '',
      status: c.status ?? '',
      renewalDate: c.renewal_date ?? '',
      value: c.value ?? 0,
    })),
    activities: (activitiesRes.data ?? []).map(a => ({
      companyName: a.company_name,
      contactName: a.contact_name,
      type: a.type ?? '',
      timestamp: a.timestamp ?? '',
    })),
  })

  return NextResponse.json(recommendations)
}
