import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRecommendations } from '@/lib/ai/recommendations'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('ai/recommendations GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const companyId = req.nextUrl.searchParams.get('companyId') ?? undefined
  const db = createServiceClient()

  if (companyId) {
    const [companyRes, contactsRes, dealsRes, contractsRes, activitiesRes] = await Promise.all([
      db.from('crm_companies').select('id, name, status, industry, owner, total_deal_value, description, hq, size, annual_revenue').eq('id', companyId).single(),
      db.from('crm_contacts').select('full_name, company_id, company_name, title, last_activity, lifecycle_stage, emails').eq('company_id', companyId),
      db.from('deals').select('company, stage, value, last_activity, service_type, close_date, probability').eq('company_id', companyId).order('created_at', { ascending: false }),
      db.from('contracts').select('company, status, renewal_date, value, billing_structure').eq('company_id', companyId).order('created_at', { ascending: false }),
      db.from('crm_activities').select('company_name, contact_name, type, title, timestamp').eq('company_id', companyId).order('timestamp', { ascending: false }).limit(20),
    ])

    const company = companyRes.data
    if (!company) {
      return NextResponse.json([])
    }

    const recommendations = await getRecommendations({
      companyId,
      companies: [{
        id: company.id,
        name: company.name,
        status: company.status ?? 'Prospect',
        industry: company.industry ?? '',
        owner: company.owner ?? '',
        totalDealValue: company.total_deal_value ?? 0,
        description: company.description ?? '',
        hq: company.hq ?? '',
        size: company.size ?? '',
        annualRevenue: company.annual_revenue ?? 0,
      }],
      contacts: (contactsRes.data ?? []).map(c => ({
        fullName: c.full_name,
        companyName: c.company_name ?? '',
        title: c.title ?? '',
        lastActivity: c.last_activity,
        lifecycleStage: c.lifecycle_stage,
      })),
      deals: (dealsRes.data ?? []).map(d => ({
        company: d.company ?? '',
        stage: d.stage ?? 'Lead',
        value: d.value ?? 0,
        lastActivity: d.last_activity ?? '',
        serviceType: d.service_type ?? '',
        closeDate: d.close_date ?? '',
        probability: d.probability ?? 0,
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
        title: a.title ?? '',
        timestamp: a.timestamp ?? '',
      })),
    })

    return NextResponse.json(recommendations)
  }

  const [companiesRes, contactsRes, dealsRes, contractsRes, activitiesRes] = await Promise.all([
    db.from('crm_companies').select('id, name, status, industry, owner, total_deal_value').order('name').limit(50),
    db.from('crm_contacts').select('full_name, company_name, last_activity, lifecycle_stage').order('full_name').limit(100),
    db.from('deals').select('company, stage, value, last_activity').order('created_at', { ascending: false }).limit(50),
    db.from('contracts').select('company, status, renewal_date, value').order('created_at', { ascending: false }).limit(50),
    db.from('crm_activities').select('company_name, contact_name, type, timestamp').order('timestamp', { ascending: false }).limit(200),
  ])

  const recommendations = await getRecommendations({
    companies: (companiesRes.data ?? []).map(c => ({
      id: c.id, name: c.name, status: c.status ?? 'Prospect', industry: c.industry ?? '',
      owner: c.owner ?? '', totalDealValue: c.total_deal_value ?? 0,
    })),
    contacts: (contactsRes.data ?? []).map(c => ({
      fullName: c.full_name, companyName: c.company_name ?? '', lastActivity: c.last_activity, lifecycleStage: c.lifecycle_stage,
    })),
    deals: (dealsRes.data ?? []).map(d => ({
      company: d.company ?? '', stage: d.stage ?? 'Lead', value: d.value ?? 0, lastActivity: d.last_activity ?? '',
    })),
    contracts: (contractsRes.data ?? []).map(c => ({
      company: c.company ?? '', status: c.status ?? '', renewalDate: c.renewal_date ?? '', value: c.value ?? 0,
    })),
    activities: (activitiesRes.data ?? []).map(a => ({
      companyName: a.company_name, contactName: a.contact_name, type: a.type ?? '', timestamp: a.timestamp ?? '',
    })),
  })

  return NextResponse.json(recommendations)
})
