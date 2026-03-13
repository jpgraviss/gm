import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
    // Fetch existing contacts to deduplicate by email or full name + company
    const { data: existing } = await db.from('crm_contacts').select('emails, full_name, company_name')
    const existingEmails = new Set<string>()
    const existingNameKeys = new Set<string>()
    for (const c of existing ?? []) {
      for (const e of (c.emails ?? [])) existingEmails.add(e.toLowerCase())
      existingNameKeys.add(`${(c.full_name ?? '').toLowerCase()}|${(c.company_name ?? '').toLowerCase()}`)
    }

    for (const row of rows) {
      const firstName = (row['First Name'] ?? row['firstname'] ?? '').trim()
      const lastName  = (row['Last Name']  ?? row['lastname']  ?? '').trim()
      if (!firstName && !lastName) { skipped++; continue }

      const email = (row['Email'] ?? row['email'] ?? '').trim().toLowerCase()
      const companyName = (row['Company Name'] ?? row['company'] ?? row['Company'] ?? '').trim()
      const nameKey = `${(firstName + ' ' + lastName).toLowerCase().trim()}|${companyName.toLowerCase()}`

      if ((email && existingEmails.has(email)) || existingNameKeys.has(nameKey)) {
        skipped++
        continue
      }

      const { error } = await db.from('crm_contacts').insert({
        id:              `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        first_name:      firstName,
        last_name:       lastName,
        full_name:       `${firstName} ${lastName}`.trim(),
        company_name:    companyName,
        title:           (row['Job Title'] ?? row['jobtitle'] ?? row['Title'] ?? null) || null,
        emails:          email ? [email] : [],
        phones:          row['Phone'] ?? row['phone'] ? [(row['Phone'] ?? row['phone']).toString().trim()] : [],
        linked_in:       (row['LinkedIn URL'] ?? row['linkedin'] ?? null) || null,
        lifecycle_stage: normalizeLifecycle(row['Lifecycle Stage'] ?? row['lifecyclestage']),
        owner:           (row['Owner'] ?? row['owner'] ?? 'Jonathan Graviss').trim(),
        tags:            [],
        contact_notes:   [],
        contact_tasks:   [],
        created_date:    new Date().toISOString().split('T')[0],
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
      const name = (row['Company Name'] ?? row['name'] ?? row['Name'] ?? '').trim()
      if (!name) { skipped++; continue }
      if (existingNames.has(name.toLowerCase())) { skipped++; continue }

      const { error } = await db.from('crm_companies').insert({
        id:             `co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        industry:       (row['Industry'] ?? row['industry'] ?? 'Other').trim(),
        website:        (row['Website'] ?? row['website'] ?? null) || null,
        phone:          (row['Phone'] ?? row['phone'] ?? null) || null,
        hq:             (row['City'] ?? row['HQ'] ?? row['hq'] ?? '').trim(),
        size:           normalizeSize(row['Company Size'] ?? row['size'] ?? row['Number of Employees']),
        annual_revenue: parseNum(row['Annual Revenue'] ?? row['annualrevenue']),
        status:         normalizeStatus(row['Status'] ?? row['status']),
        owner:          (row['Owner'] ?? row['owner'] ?? 'Jonathan Graviss').trim(),
        description:    (row['Description'] ?? row['description'] ?? null) || null,
        tags:           [],
        contact_ids:    [],
        deal_ids:       [],
        total_deal_value: 0,
        created_date:   new Date().toISOString().split('T')[0],
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
      const company = (row['Company'] ?? row['company'] ?? row['Deal Name'] ?? '').trim()
      const stage   = normalizeStage(row['Deal Stage'] ?? row['stage'] ?? row['Stage'] ?? 'Lead')
      const value   = parseNum(row['Amount'] ?? row['value'] ?? row['Value']) ?? 0

      if (!company) { skipped++; continue }
      const key = `${company.toLowerCase()}|${stage.toLowerCase()}|${value}`
      if (existingKeys.has(key)) { skipped++; continue }

      const contactName  = (row['Contact Name']  ?? row['contact'] ?? '').trim()
      const contactEmail = (row['Contact Email'] ?? row['email']   ?? '').trim()

      const { error } = await db.from('deals').insert({
        id:           `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company,
        contact:      { id: '', name: contactName, email: contactEmail, phone: '', title: '' },
        stage,
        value,
        service_type:  (row['Service Type'] ?? row['servicetype'] ?? 'General').trim(),
        close_date:    (row['Close Date'] ?? row['closedate'] ?? null) || null,
        assigned_rep:  (row['Assigned Rep'] ?? row['owner'] ?? row['Owner'] ?? 'Jonathan Graviss').trim(),
        probability:   parseNum(row['Probability'] ?? row['probability']) ?? 0,
        notes:         [],
        last_activity: new Date().toISOString().split('T')[0],
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
  if (v.includes('lead')) return 'lead'
  if (v.includes('opport')) return 'opportunity'
  if (v.includes('client') || v.includes('customer')) return 'client'
  return 'other'
}

function normalizeStatus(val?: string): string {
  if (!val) return 'Prospect'
  const v = val.toLowerCase()
  if (v.includes('active') || v.includes('customer')) return 'Active Client'
  if (v.includes('past')) return 'Past Client'
  if (v.includes('partner')) return 'Partner'
  if (v.includes('churn')) return 'Churned'
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
  if (v.includes('qualified'))         return 'Qualified'
  if (v.includes('proposal'))          return 'Proposal Sent'
  if (v.includes('contract'))          return 'Contract Sent'
  if (v.includes('won') || v.includes('closed won'))  return 'Closed Won'
  if (v.includes('lost') || v.includes('closed lost')) return 'Closed Lost'
  return 'Lead'
}

function parseNum(val?: string | number): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = parseFloat(val.toString().replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}
