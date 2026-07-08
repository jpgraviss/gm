import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

const TODAY = '2026-06-29'

function daysUntil(dateStr: string) {
  const target = new Date(dateStr)
  const now = new Date(TODAY)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const companies = [
  { id: 'co-formetco',          name: 'Formetco',          industry: 'Outdoor Advertising',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Premium'],                  size: '51-200', description: 'Premium tier. $900 SEO + $300 mgmt = $1,200/mo. Auto-renews yearly, 30-day notice.' },
  { id: 'co-franklin-outdoor',  name: 'Franklin Outdoor',  industry: 'Outdoor Advertising',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Standard'],                 size: '11-50',  description: 'Standard tier. $750 SEO/mgmt. Renewal drafted, unsigned.' },
  { id: 'co-trailhead-media',   name: 'Trailhead Media',   industry: 'Outdoor Advertising',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Standard'],                 size: '11-50',  description: 'Standard tier. $650 SEO/mgmt. Renewal drafted, unsigned.' },
  { id: 'co-opsiq',             name: 'OpsIQ',             industry: 'Technology',              status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Standard', 'Discontinuing'],size: '11-50',  description: 'Standard tier. $750 SEO/mgmt. Discontinuing -- let lapse, no renewal.' },
  { id: 'co-capital-outdoor',   name: 'Capital Outdoor',   industry: 'Outdoor Advertising',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic'],                    size: '11-50',  description: 'Basic tier. $550 SEO + $50 mgmt = $600/mo. Tier named in signed contract. Fixed term.' },
  { id: 'co-bmv-service',       name: 'BMV Service',       industry: 'Automotive Services',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic', 'Legacy'],          size: '1-10',   description: 'Basic tier. $575 SEO/mgmt + ad spend ($150 or $75). Fixed term, legacy.' },
  { id: 'co-niche-outdoor',     name: 'Niche Outdoor',     industry: 'Outdoor Advertising',     status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic', 'Legacy'],          size: '1-10',   description: 'Basic tier (legacy, priced under Basic). $400 SEO/mgmt. Month-to-month, no end.' },
  { id: 'co-turbobrakes',       name: 'TurboBrakes',       industry: 'Automotive Parts',        status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic'],                    size: '1-10',   description: 'Basic tier. $575 SEO/mgmt. Fixed term.' },
  { id: 'co-interstate-outdoor',name: 'Interstate Outdoor', industry: 'Outdoor Advertising',    status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic', 'Onboarding'],      size: '11-50',  description: 'Onboarding/Basic. $550 SEO + $350 mgmt = $900/mo. Contract says Standard. M2M. Tier mismatch flag.' },
  { id: 'co-franklin-graphics', name: 'Franklin Graphics', industry: 'Printing/Graphics',       status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Basic', 'Onboarding'],      size: '11-50',  description: 'Onboarding/Basic. $550 SEO + $350 mgmt = $900/mo. 12-mo term starts at launch. Launch pending.' },
  { id: 'co-skydragon-designs', name: 'Skydragon Designs', industry: 'Design',                  status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Unassigned'],               size: '1-10',   description: 'Unassigned tier. $787.50 SEO/mgmt. Tier needs to be settled before renewal.' },
  { id: 'co-organized-harmony', name: 'Organized Harmony', industry: 'Professional Organizing', status: 'Active Client', owner: 'Jonathan Graviss', tags: ['Non-billing'],              size: '1-10',   description: 'Non-billing (family). Basic scope, $0. No contract. Exclude from MRR.' },
]

const contracts = [
  { id: 'c-formetco-2026',          company: 'Formetco',          status: 'Fully Executed', value: 1200,   billing_structure: 'Monthly', start_date: '2026-05-01', duration: 12, renewal_date: '2027-04-30', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-franklin-outdoor-2025',  company: 'Franklin Outdoor',  status: 'Fully Executed', value: 750,    billing_structure: 'Monthly', start_date: '2025-08-01', duration: 12, renewal_date: '2026-07-31', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-trailhead-media-2025',   company: 'Trailhead Media',   status: 'Fully Executed', value: 650,    billing_structure: 'Monthly', start_date: '2025-07-01', duration: 12, renewal_date: '2026-06-30', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-opsiq-2026',             company: 'OpsIQ',             status: 'Fully Executed', value: 750,    billing_structure: 'Monthly', start_date: '2026-02-01', duration: 12, renewal_date: '2027-01-31', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-capital-outdoor-2026',   company: 'Capital Outdoor',   status: 'Fully Executed', value: 600,    billing_structure: 'Monthly', start_date: '2026-03-01', duration: 12, renewal_date: '2027-02-28', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-bmv-service-2026',       company: 'BMV Service',       status: 'Fully Executed', value: 575,    billing_structure: 'Monthly', start_date: '2026-04-01', duration: 12, renewal_date: '2027-03-31', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-turbobrakes-2026',       company: 'TurboBrakes',       status: 'Fully Executed', value: 575,    billing_structure: 'Monthly', start_date: '2026-01-01', duration: 12, renewal_date: '2026-12-31', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
  { id: 'c-skydragon-designs-2026', company: 'Skydragon Designs', status: 'Fully Executed', value: 787.50, billing_structure: 'Monthly', start_date: '2026-02-01', duration: 12, renewal_date: '2027-01-31', assigned_rep: 'Jonathan Graviss', service_type: 'SEO' },
]

const renewals = [
  { id: 'ren-trailhead-media',   company: 'Trailhead Media',   contract_id: 'c-trailhead-media-2025',   expiration_date: '2026-06-30', renewal_value: 650,    assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-franklin-outdoor',  company: 'Franklin Outdoor',  contract_id: 'c-franklin-outdoor-2025',  expiration_date: '2026-07-31', renewal_value: 750,    assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-turbobrakes',       company: 'TurboBrakes',       contract_id: 'c-turbobrakes-2026',       expiration_date: '2026-12-31', renewal_value: 575,    assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-skydragon-designs', company: 'Skydragon Designs', contract_id: 'c-skydragon-designs-2026', expiration_date: '2027-01-31', renewal_value: 787.50, assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-opsiq',             company: 'OpsIQ',             contract_id: 'c-opsiq-2026',             expiration_date: '2027-01-31', renewal_value: 0,      assigned_rep: 'Jonathan Graviss', status: 'Discontinuing', service_type: 'SEO' },
  { id: 'ren-capital-outdoor',   company: 'Capital Outdoor',   contract_id: 'c-capital-outdoor-2026',   expiration_date: '2027-02-28', renewal_value: 600,    assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-bmv-service',       company: 'BMV Service',       contract_id: 'c-bmv-service-2026',       expiration_date: '2027-03-31', renewal_value: 575,    assigned_rep: 'Jonathan Graviss', status: 'Upcoming',      service_type: 'SEO' },
  { id: 'ren-formetco',          company: 'Formetco',          contract_id: 'c-formetco-2026',          expiration_date: '2027-04-30', renewal_value: 1200,   assigned_rep: 'Jonathan Graviss', status: 'Auto-Renew',    service_type: 'SEO' },
]

export async function POST() {
  const db = createServiceClient()
  const results: { companies: number; contracts: number; renewals: number; errors: string[] } = {
    companies: 0, contracts: 0, renewals: 0, errors: [],
  }

  for (const co of companies) {
    const { error } = await db.from('crm_companies').upsert({
      ...co, hq: '', contact_ids: [], deal_ids: [], total_deal_value: 0, created_date: TODAY,
    }, { onConflict: 'id' })
    if (error) results.errors.push(`company ${co.name}: ${error.message}`)
    else results.companies++
  }

  for (const ct of contracts) {
    const { error } = await db.from('contracts').upsert(ct, { onConflict: 'id' })
    if (error) results.errors.push(`contract ${ct.company}: ${error.message}`)
    else results.contracts++
  }

  for (const ren of renewals) {
    const { error } = await db.from('renewals').upsert({
      ...ren, days_until_expiry: daysUntil(ren.expiration_date),
    }, { onConflict: 'id' })
    if (error) results.errors.push(`renewal ${ren.company}: ${error.message}`)
    else results.renewals++
  }

  return NextResponse.json(results, { status: results.errors.length ? 207 : 201 })
}
