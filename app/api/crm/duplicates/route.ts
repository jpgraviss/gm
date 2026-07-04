import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().\+]/g, '')
}

function extractDomain(url: string): string {
  try {
    let cleaned = url.trim().toLowerCase()
    if (!cleaned.startsWith('http')) cleaned = `https://${cleaned}`
    const hostname = new URL(cleaned).hostname.replace(/^www\./, '')
    return hostname
  } catch {
    return url.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}

interface DuplicateGroup {
  key: string
  records: Record<string, unknown>[]
  matchType: 'email' | 'name' | 'phone' | 'domain'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type !== 'contacts' && type !== 'companies') {
    return NextResponse.json({ error: 'type must be "contacts" or "companies"' }, { status: 400 })
  }

  const db = createServiceClient()

  // Load dismissed duplicate group keys
  const { data: settings } = await db
    .from('app_settings')
    .select('dismissed_duplicates')
    .eq('id', 'global')
    .maybeSingle()
  const dismissed: Record<string, string[]> = (settings?.dismissed_duplicates as Record<string, string[]>) ?? {}
  const dismissedKeys = new Set<string>(dismissed[type] ?? [])

  if (type === 'contacts') {
    const { data, error } = await db.from('crm_contacts').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const contacts = data ?? []

    const groups: DuplicateGroup[] = []
    const usedIds = new Set<string>()

    const emailMap = new Map<string, typeof contacts>()
    for (const c of contacts) {
      for (const email of (c.emails ?? [])) {
        const key = email.toLowerCase().trim()
        if (!key) continue
        if (!emailMap.has(key)) emailMap.set(key, [])
        emailMap.get(key)!.push(c)
      }
    }
    for (const [email, recs] of emailMap) {
      if (recs.length < 2) continue
      const ids = recs.map(r => r.id).sort().join('|')
      if (usedIds.has(ids)) continue
      usedIds.add(ids)
      groups.push({
        key: `email:${email}`,
        records: recs.map(mapContact),
        matchType: 'email',
      })
      recs.forEach(r => usedIds.add(r.id))
    }

    const nameMap = new Map<string, typeof contacts>()
    for (const c of contacts) {
      if (usedIds.has(c.id)) continue
      const name = (c.full_name ?? '').toLowerCase().trim()
      const company = (c.company_name ?? '').toLowerCase().trim()
      if (!name) continue
      const key = `${name}|${company}`
      if (!nameMap.has(key)) nameMap.set(key, [])
      nameMap.get(key)!.push(c)
    }
    for (const [nameKey, recs] of nameMap) {
      if (recs.length < 2) continue
      groups.push({
        key: `name:${nameKey}`,
        records: recs.map(mapContact),
        matchType: 'name',
      })
      recs.forEach(r => usedIds.add(r.id))
    }

    const phoneMap = new Map<string, typeof contacts>()
    for (const c of contacts) {
      if (usedIds.has(c.id)) continue
      for (const phone of (c.phones ?? [])) {
        const norm = normalizePhone(phone)
        if (!norm || norm.length < 7) continue
        if (!phoneMap.has(norm)) phoneMap.set(norm, [])
        phoneMap.get(norm)!.push(c)
      }
    }
    for (const [phone, recs] of phoneMap) {
      if (recs.length < 2) continue
      const ids = recs.map(r => r.id).sort().join('|')
      if (usedIds.has(ids)) continue
      groups.push({
        key: `phone:${phone}`,
        records: recs.map(mapContact),
        matchType: 'phone',
      })
    }

    const filteredGroups = groups.filter(g => !dismissedKeys.has(g.key))
    filteredGroups.sort((a, b) => b.records.length - a.records.length)
    return NextResponse.json({ groups: filteredGroups })
  }

  const { data, error } = await db.from('crm_companies').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const companies = data ?? []

  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  const nameMap = new Map<string, typeof companies>()
  for (const c of companies) {
    const key = (c.name ?? '').toLowerCase().trim()
    if (!key) continue
    if (!nameMap.has(key)) nameMap.set(key, [])
    nameMap.get(key)!.push(c)
  }
  for (const [name, recs] of nameMap) {
    if (recs.length < 2) continue
    groups.push({
      key: `name:${name}`,
      records: recs.map(mapCompany),
      matchType: 'name',
    })
    recs.forEach(r => usedIds.add(r.id))
  }

  const domainMap = new Map<string, typeof companies>()
  for (const c of companies) {
    if (usedIds.has(c.id)) continue
    const website = c.website
    if (!website) continue
    const domain = extractDomain(website)
    if (!domain) continue
    if (!domainMap.has(domain)) domainMap.set(domain, [])
    domainMap.get(domain)!.push(c)
  }
  for (const [, recs] of domainMap) {
    if (recs.length < 2) continue
    const domain = extractDomain(recs[0].website ?? '')
    groups.push({
      key: `domain:${domain}`,
      records: recs.map(mapCompany),
      matchType: 'domain',
    })
  }

  const filteredGroups = groups.filter(g => !dismissedKeys.has(g.key))
  filteredGroups.sort((a, b) => b.records.length - a.records.length)
  return NextResponse.json({ groups: filteredGroups })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContact(row: any) {
  return {
    id: row.id,
    companyId: row.company_id ?? undefined,
    companyName: row.company_name ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    fullName: row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    title: row.title ?? '',
    emails: row.emails ?? [],
    phones: row.phones ?? [],
    linkedIn: row.linked_in ?? undefined,
    website: row.website ?? undefined,
    isPrimary: row.is_primary ?? false,
    owner: row.owner ?? '',
    tags: row.tags ?? [],
    createdDate: row.created_date ?? '',
    lastActivity: row.last_activity ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompany(row: any) {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    hq: row.hq,
    size: row.size,
    annualRevenue: row.annual_revenue ?? undefined,
    status: row.status,
    owner: row.owner,
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    contactIds: row.contact_ids ?? [],
    dealIds: row.deal_ids ?? [],
    totalDealValue: row.total_deal_value ?? 0,
    createdDate: row.created_date ?? '',
  }
}
