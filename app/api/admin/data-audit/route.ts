import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

export const GET = withErrorHandler('data-audit GET', async () => {
  const db = createServiceClient()

  const [
    { count: contactCount },
    { count: companyCount },
    { count: dealCount },
    { count: contractCount },
    { count: invoiceCount },
    { count: projectCount },
  ] = await Promise.all([
    db.from('crm_contacts').select('*', { count: 'exact', head: true }),
    db.from('crm_companies').select('*', { count: 'exact', head: true }),
    db.from('deals').select('*', { count: 'exact', head: true }),
    db.from('contracts').select('*', { count: 'exact', head: true }),
    db.from('invoices').select('*', { count: 'exact', head: true }),
    db.from('projects').select('*', { count: 'exact', head: true }),
  ])

  const { data: allContacts } = await db.from('crm_contacts').select('id, first_name, last_name, emails, company_id, company_name')
  const { data: allCompanies } = await db.from('crm_companies').select('id, name')
  const { data: allDeals } = await db.from('deals').select('id, company, company_id')
  const { data: allContracts } = await db.from('contracts').select('id, company, company_id')
  const { data: allInvoices } = await db.from('invoices').select('id, company, company_id')
  const { data: allProjects } = await db.from('projects').select('id, company, company_id')

  const companyIds = new Set((allCompanies ?? []).map(c => c.id))
  const companyNames = new Set((allCompanies ?? []).map(c => c.name?.toLowerCase()))
  const contactCompanyIds = new Set((allContacts ?? []).filter(c => c.company_id).map(c => c.company_id))

  const contactsMissingEmail = (allContacts ?? []).filter(c => !c.emails || c.emails.length === 0)
  const contactsMissingCompany = (allContacts ?? []).filter(c => !c.company_id)
  const companiesNoContacts = (allCompanies ?? []).filter(c => !contactCompanyIds.has(c.id))

  const dealsMissingCompanyId = (allDeals ?? []).filter(d => !d.company_id)
  const contractsMissingCompanyId = (allContracts ?? []).filter(c => !c.company_id)
  const invoicesMissingCompanyId = (allInvoices ?? []).filter(i => !i.company_id)
  const projectsMissingCompanyId = (allProjects ?? []).filter(p => !p.company_id)

  const orphanNames = new Set<string>()
  for (const list of [allDeals, allContracts, allInvoices, allProjects]) {
    for (const row of list ?? []) {
      if (row.company && !row.company_id && !companyNames.has(row.company.toLowerCase())) {
        orphanNames.add(row.company)
      }
    }
  }

  const scores: Record<string, number> = {}
  const total = (contactCount ?? 0) + (companyCount ?? 0) + (dealCount ?? 0) + (contractCount ?? 0)
  const issues = contactsMissingEmail.length + contactsMissingCompany.length +
    dealsMissingCompanyId.length + contractsMissingCompanyId.length
  scores.overall = total > 0 ? Math.round(((total - issues) / total) * 100) : 100
  scores.contacts = (contactCount ?? 0) > 0
    ? Math.round((((contactCount ?? 0) - contactsMissingEmail.length - contactsMissingCompany.length) / (contactCount ?? 1)) * 100)
    : 100
  scores.deals = (dealCount ?? 0) > 0
    ? Math.round((((dealCount ?? 0) - dealsMissingCompanyId.length) / (dealCount ?? 1)) * 100)
    : 100
  scores.contracts = (contractCount ?? 0) > 0
    ? Math.round((((contractCount ?? 0) - contractsMissingCompanyId.length) / (contractCount ?? 1)) * 100)
    : 100

  return NextResponse.json({
    totals: {
      contacts: contactCount ?? 0,
      companies: companyCount ?? 0,
      deals: dealCount ?? 0,
      contracts: contractCount ?? 0,
      invoices: invoiceCount ?? 0,
      projects: projectCount ?? 0,
    },
    issues: {
      contactsMissingEmail: contactsMissingEmail.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() })),
      contactsMissingCompany: contactsMissingCompany.map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), companyName: c.company_name })),
      companiesNoContacts: companiesNoContacts.map(c => ({ id: c.id, name: c.name })),
      dealsMissingCompanyId: dealsMissingCompanyId.map(d => ({ id: d.id, company: d.company })),
      contractsMissingCompanyId: contractsMissingCompanyId.map(c => ({ id: c.id, company: c.company })),
      invoicesMissingCompanyId: invoicesMissingCompanyId.map(i => ({ id: i.id, company: i.company })),
      projectsMissingCompanyId: projectsMissingCompanyId.map(p => ({ id: p.id, company: p.company })),
      orphanCompanyNames: Array.from(orphanNames),
    },
    scores,
  })
})

export const POST = withErrorHandler('data-audit POST', async (req) => {
  const body = await req.json()
  const db = createServiceClient()

  if (body.action === 'create_missing_companies') {
    const names: string[] = body.names ?? []
    let created = 0
    for (const name of names) {
      const id = `co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const { error } = await db.from('crm_companies').insert({
        id,
        name,
        status: 'Prospect',
        owner: 'Jonathan Graviss',
        tags: [],
        contact_ids: [],
        deal_ids: [],
        created_date: new Date().toISOString().split('T')[0],
      })
      if (!error) created++
    }
    return NextResponse.json({ created })
  }

  if (body.action === 'backfill_company_ids') {
    const tables = ['deals', 'contracts', 'invoices', 'projects', 'maintenance_records', 'renewals', 'app_tasks', 'tickets'] as const
    const results: Record<string, number> = {}
    const { data: companies } = await db.from('crm_companies').select('id, name')
    const nameMap = new Map((companies ?? []).map(c => [c.name?.toLowerCase(), c.id]))

    for (const table of tables) {
      const { data: rows } = await db.from(table).select('id, company, company_id').is('company_id', null)
      let updated = 0
      for (const row of rows ?? []) {
        const companyId = nameMap.get(row.company?.toLowerCase())
        if (companyId) {
          await db.from(table).update({ company_id: companyId }).eq('id', row.id)
          updated++
        }
      }
      results[table] = updated
    }
    return NextResponse.json({ updated: results })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
})
