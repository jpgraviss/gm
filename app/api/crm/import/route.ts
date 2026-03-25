import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// ── HubSpot-aware field getter ──────────────────────────────────────────────
// Checks multiple possible column names (HubSpot exports vary by locale/version)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k]
    if (val !== undefined && val !== null && val !== '') return String(val).trim()
  }
  return ''
}

export async function POST(req: NextRequest) {
  const { type, rows } = await req.json() as {
    type: 'contacts' | 'companies' | 'deals'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: Record<string, any>[]
  }

  if (!type || !rows?.length) {
    return NextResponse.json({ error: 'type and rows are required' }, { status: 400 })
  }

  const db = createServiceClient()
  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  if (type === 'contacts') {
    const { data: existing } = await db.from('crm_contacts').select('emails, full_name, company_name')
    const existingEmails = new Set<string>()
    const existingNameKeys = new Set<string>()
    for (const c of existing ?? []) {
      for (const e of (c.emails ?? [])) existingEmails.add(e.toLowerCase())
      existingNameKeys.add(`${(c.full_name ?? '').toLowerCase()}|${(c.company_name ?? '').toLowerCase()}`)
    }

    for (const row of rows) {
      const firstName = get(row, 'First Name', 'firstname', 'First name', 'Firstname')
      const lastName  = get(row, 'Last Name', 'lastname', 'Last name', 'Lastname')
      if (!firstName && !lastName) { skipped++; continue }

      const email = get(row, 'Email', 'email', 'Email Address', 'email_address', 'Contact email').toLowerCase()
      const companyName = get(row, 'Company Name', 'company', 'Company', 'Associated Company', 'Company name', 'Associated company')
      const nameKey = `${(firstName + ' ' + lastName).toLowerCase().trim()}|${companyName.toLowerCase()}`

      if ((email && existingEmails.has(email)) || existingNameKeys.has(nameKey)) {
        skipped++
        continue
      }

      const phone = get(row, 'Phone Number', 'Phone', 'phone', 'Phone number', 'Mobile Phone Number', 'Mobile phone number')

      const { error } = await db.from('crm_contacts').insert({
        id:              `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        first_name:      firstName,
        last_name:       lastName,
        full_name:       `${firstName} ${lastName}`.trim(),
        company_name:    companyName,
        title:           get(row, 'Job Title', 'jobtitle', 'Job title', 'Title', 'Role') || null,
        emails:          email ? [email] : [],
        phones:          phone ? [phone] : [],
        linked_in:       get(row, 'LinkedIn URL', 'linkedin', 'LinkedIn', 'LinkedIn Bio', 'LinkedIn bio') || null,
        lifecycle_stage: normalizeLifecycle(get(row, 'Lifecycle Stage', 'lifecyclestage', 'Lifecycle stage', 'Lead Status', 'Lead status')),
        owner:           get(row, 'Contact owner', 'Owner', 'owner', 'HubSpot Owner Name', 'Record owner') || 'Jonathan Graviss',
        tags:            [],
        contact_notes:   [],
        contact_tasks:   [],
        created_date:    get(row, 'Create Date', 'Create date', 'createdate', 'Created', 'Date added') || new Date().toISOString().split('T')[0],
      })

      if (error) { console.error('[crm/import POST] contact insert', error); errors.push(`Contact ${firstName} ${lastName}: import failed`); continue }
      inserted++
      if (email) existingEmails.add(email)
      existingNameKeys.add(nameKey)
    }
  } else if (type === 'companies') {
    const { data: existing } = await db.from('crm_companies').select('name')
    const existingNames = new Set((existing ?? []).map(c => c.name.toLowerCase()))

    for (const row of rows) {
      const name = get(row, 'Company Name', 'name', 'Name', 'Company name', 'Company Domain Name', 'Company domain name')
      if (!name) { skipped++; continue }
      if (existingNames.has(name.toLowerCase())) { skipped++; continue }

      const { error } = await db.from('crm_companies').insert({
        id:             `co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        industry:       get(row, 'Industry', 'industry', 'Type') || 'Other',
        website:        get(row, 'Website URL', 'Website', 'website', 'Company Domain Name', 'Company domain name') || null,
        phone:          get(row, 'Phone Number', 'Phone', 'phone', 'Phone number', 'Company Phone') || null,
        hq:             get(row, 'City', 'HQ', 'hq', 'State/Region', 'State', 'Country/Region', 'Country') || '',
        size:           normalizeSize(get(row, 'Number of Employees', 'Company Size', 'size', 'Number of employees', 'numberofemployees')),
        annual_revenue: parseNum(get(row, 'Annual Revenue', 'annualrevenue', 'Annual revenue', 'Total Revenue', 'Total revenue')),
        status:         normalizeStatus(get(row, 'Lifecycle Stage', 'Status', 'status', 'Lead Status', 'Lead status', 'Type')),
        owner:          get(row, 'Company owner', 'Owner', 'owner', 'HubSpot Owner Name', 'Record owner') || 'Jonathan Graviss',
        description:    get(row, 'Description', 'description', 'About Us', 'About us', 'Company Description') || null,
        tags:           [],
        contact_ids:    [],
        deal_ids:       [],
        total_deal_value: 0,
        created_date:   get(row, 'Create Date', 'Create date', 'createdate', 'Created', 'Date added') || new Date().toISOString().split('T')[0],
      })

      if (error) { console.error('[crm/import POST] company insert', error); errors.push(`Company ${name}: import failed`); continue }
      inserted++
      existingNames.add(name.toLowerCase())
    }
  } else if (type === 'deals') {
    const { data: existing } = await db.from('deals').select('company, stage, value')
    const existingKeys = new Set(
      (existing ?? []).map(d => `${d.company?.toLowerCase()}|${d.stage?.toLowerCase()}|${d.value}`)
    )

    for (const row of rows) {
      const company = get(row, 'Associated Company', 'Company', 'company', 'Deal Name', 'Deal name', 'Associated company', 'Company Name')
      const stage   = normalizeStage(get(row, 'Deal Stage', 'stage', 'Stage', 'Deal stage', 'Pipeline Stage'))
      const value   = parseNum(get(row, 'Amount', 'value', 'Value', 'Deal Amount', 'Amount in company currency', 'Close Amount')) ?? 0

      if (!company) { skipped++; continue }
      const key = `${company.toLowerCase()}|${stage.toLowerCase()}|${value}`
      if (existingKeys.has(key)) { skipped++; continue }

      const contactName  = get(row, 'Contact Name', 'contact', 'Associated Contact', 'Associated contact', 'Contact name')
      const contactEmail = get(row, 'Contact Email', 'email', 'Contact email')
      const dealName     = get(row, 'Deal Name', 'Deal name', 'Name')

      const { error } = await db.from('deals').insert({
        id:           `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company,
        contact:      { id: '', name: contactName, email: contactEmail, phone: '', title: '' },
        stage,
        value,
        service_type:  normalizeServiceType(get(row, 'Deal Type', 'Service Type', 'servicetype', 'Deal type', 'Pipeline', 'Type'), dealName),
        close_date:    get(row, 'Close Date', 'closedate', 'Close date', 'Expected close date') || null,
        assigned_rep:  get(row, 'Deal owner', 'Assigned Rep', 'owner', 'Owner', 'HubSpot Owner Name', 'Record owner') || 'Jonathan Graviss',
        probability:   parseNum(get(row, 'Deal Probability', 'Probability', 'probability', 'Deal probability', 'Win probability')) ?? 0,
        notes:         [],
        last_activity: get(row, 'Last Activity Date', 'Last activity date', 'Last Modified Date') || new Date().toISOString().split('T')[0],
      })

      if (error) { console.error('[crm/import POST] deal insert', error); errors.push(`Deal ${company}: import failed`); continue }
      inserted++
      existingKeys.add(key)
    }
  }

  return NextResponse.json({ inserted, skipped, errors })
}

function normalizeLifecycle(val?: string): string | null {
  if (!val) return null
  const v = val.toLowerCase()
  if (v.includes('lead') || v.includes('subscriber')) return 'lead'
  if (v.includes('opport') || v.includes('marketing qualified') || v.includes('sales qualified')) return 'opportunity'
  if (v.includes('client') || v.includes('customer') || v.includes('evangelist')) return 'client'
  return 'other'
}

function normalizeStatus(val?: string): string {
  if (!val) return 'Prospect'
  const v = val.toLowerCase()
  if (v.includes('active') || v.includes('customer') || v.includes('client')) return 'Active Client'
  if (v.includes('past') || v.includes('former')) return 'Past Client'
  if (v.includes('partner')) return 'Partner'
  if (v.includes('churn') || v.includes('lost')) return 'Churned'
  return 'Prospect'
}

function normalizeSize(val?: string): string {
  if (!val) return '1-10'
  const n = parseInt(val.replace(/\D/g, '')) || 0
  if (n >= 500) return '500+'
  if (n >= 201) return '201-500'
  if (n >= 51)  return '51-200'
  if (n >= 11)  return '11-50'
  return '1-10'
}

function normalizeStage(val?: string): string {
  if (!val) return 'Lead'
  const v = val.toLowerCase()
  if (v.includes('qualified') || v.includes('discovery'))      return 'Qualified'
  if (v.includes('proposal') || v.includes('presentation'))    return 'Proposal Sent'
  if (v.includes('contract') || v.includes('negotiation') || v.includes('decision')) return 'Contract Sent'
  if (v.includes('won') || v.includes('closed won'))           return 'Closed Won'
  if (v.includes('lost') || v.includes('closed lost'))         return 'Closed Lost'
  if (v.includes('appointment') || v.includes('scheduled'))    return 'Qualified'
  return 'Lead'
}

function normalizeServiceType(val?: string, dealName?: string): string {
  const check = (val ?? dealName ?? '').toLowerCase()
  if (check.includes('seo'))         return 'SEO'
  if (check.includes('website') || check.includes('web design') || check.includes('web dev')) return 'Website'
  if (check.includes('social'))      return 'Social Media'
  if (check.includes('brand'))       return 'Branding'
  if (check.includes('email'))       return 'Email Marketing'
  return 'Custom'
}

function parseNum(val?: string | number): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = parseFloat(val.toString().replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}
