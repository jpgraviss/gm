import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

const LIMIT_PER_TYPE = 5

interface SearchResult {
  id: string
  type: 'contact' | 'company' | 'deal' | 'project' | 'ticket' | 'task' | 'proposal' | 'contract'
  name: string
  subtitle: string
  href: string
}

export const GET = withErrorHandler('search GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const db = createServiceClient()
  const pattern = `%${q}%`
  // PostgREST's .or() filter syntax splits on top-level commas — a search
  // term containing one (e.g. a contact typed "Smith, John") would silently
  // break that filter's parsing without this. Quoting the value, escaping
  // any embedded quote/backslash, is the documented PostgREST escape for a
  // value containing reserved characters (comma, semicolon, parentheses).
  const orPattern = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

  const [contacts, companies, deals, projects, tickets, tasks, proposals, contracts] =
    await Promise.all([
      db
        .from('crm_contacts')
        .select('id, first_name, last_name, company_name, title')
        .or(`first_name.ilike.${orPattern},last_name.ilike.${orPattern},company_name.ilike.${orPattern}`)
        .limit(LIMIT_PER_TYPE),
      db
        .from('crm_companies')
        .select('id, name, industry, status')
        .ilike('name', pattern)
        .limit(LIMIT_PER_TYPE),
      db
        .from('deals')
        .select('id, company, stage, value')
        .ilike('company', pattern)
        .limit(LIMIT_PER_TYPE),
      db
        .from('projects')
        .select('id, company, service_type, status')
        .ilike('company', pattern)
        .limit(LIMIT_PER_TYPE),
      db
        .from('tickets')
        .select('id, subject, company, status')
        .or(`subject.ilike.${orPattern},company.ilike.${orPattern}`)
        .limit(LIMIT_PER_TYPE),
      db
        .from('app_tasks')
        .select('id, title, assigned_to, status')
        .ilike('title', pattern)
        .limit(LIMIT_PER_TYPE),
      db
        .from('proposals')
        .select('id, company, status, value')
        .ilike('company', pattern)
        .limit(LIMIT_PER_TYPE),
      db
        .from('contracts')
        .select('id, company, status, value')
        .ilike('company', pattern)
        .limit(LIMIT_PER_TYPE),
    ])

  // None of these query errors were checked before — a broken filter (or
  // any other Supabase error) on one table silently produced an empty
  // result for that type with zero indication anything went wrong; a
  // normal-looking "no results" is indistinguishable from a real query
  // failure without this.
  const named: [string, { error: unknown } ][] = [
    ['contacts', contacts], ['companies', companies], ['deals', deals],
    ['projects', projects], ['tickets', tickets], ['tasks', tasks],
    ['proposals', proposals], ['contracts', contracts],
  ]
  for (const [name, res] of named) {
    if (res.error) console.error(`[search] ${name} query failed:`, res.error)
  }

  const results: SearchResult[] = []

  for (const row of contacts.data ?? []) {
    results.push({
      id: row.id,
      type: 'contact',
      name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
      subtitle: row.company_name ?? row.title ?? '',
      href: `/crm/contacts?open=${row.id}`,
    })
  }

  for (const row of companies.data ?? []) {
    results.push({
      id: row.id,
      type: 'company',
      name: row.name,
      subtitle: `${row.industry ?? ''} ${row.status ? `- ${row.status}` : ''}`.trim(),
      href: `/crm/companies?open=${row.id}`,
    })
  }

  for (const row of deals.data ?? []) {
    results.push({
      id: row.id,
      type: 'deal',
      name: row.company,
      subtitle: `${row.stage ?? ''} ${row.value ? `- $${Number(row.value).toLocaleString()}` : ''}`.trim(),
      href: `/crm/pipeline?open=${row.id}`,
    })
  }

  for (const row of projects.data ?? []) {
    results.push({
      id: row.id,
      type: 'project',
      name: row.company,
      subtitle: `${row.service_type ?? ''} - ${row.status ?? ''}`,
      // Projects use a dedicated /projects/[id] detail route (AUDIT #117),
      // not an inline ?open= panel like the other result types below.
      href: `/projects/${row.id}`,
    })
  }

  for (const row of tickets.data ?? []) {
    results.push({
      id: row.id,
      type: 'ticket',
      name: row.subject ?? row.company,
      subtitle: `${row.company ?? ''} ${row.status ? `- ${row.status}` : ''}`.trim(),
      href: `/tickets?open=${row.id}`,
    })
  }

  for (const row of tasks.data ?? []) {
    results.push({
      id: row.id,
      type: 'task',
      name: row.title,
      subtitle: `${row.assigned_to ?? ''} ${row.status ? `- ${row.status}` : ''}`.trim(),
      href: `/tasks?open=${row.id}`,
    })
  }

  for (const row of proposals.data ?? []) {
    results.push({
      id: row.id,
      type: 'proposal',
      name: row.company,
      subtitle: `${row.status ?? ''} ${row.value ? `- $${Number(row.value).toLocaleString()}` : ''}`.trim(),
      href: `/proposals?open=${row.id}`,
    })
  }

  for (const row of contracts.data ?? []) {
    results.push({
      id: row.id,
      type: 'contract',
      name: row.company,
      subtitle: `${row.status ?? ''} ${row.value ? `- $${Number(row.value).toLocaleString()}` : ''}`.trim(),
      href: `/contracts?open=${row.id}`,
    })
  }

  return NextResponse.json(results)
})
