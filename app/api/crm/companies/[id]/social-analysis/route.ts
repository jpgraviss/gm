import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzeSocialPresence } from '@/lib/ai/social-analysis'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { parseWebsiteUrl, fetchSafeHtml } from '@/lib/website-fetch'

export const GET = withErrorHandler('crm/companies/[id]/social-analysis GET', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()

  // `social_links` was previously selected here, but no such column exists
  // on crm_companies (confirmed against schema.sql) and nothing anywhere
  // in the app ever writes one — selecting it made PostgREST error on
  // every call, which this route silently swallowed by destructuring
  // `company` as undefined, so this endpoint 404'd for every real company.
  const { data: company } = await db
    .from('crm_companies')
    .select('id, name, website')
    .eq('id', id)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const socialUrls: Record<string, string> = {}

  if (company.website) {
    try {
      // AUDIT #764 — was a bare fetch() on the company's stored website with
      // `redirect: 'follow'`, so a website field pointing at an internal
      // address (or a site 302-ing to one) made the server issue that
      // request. fetchSafeHtml pins the connection to a validated address
      // and re-checks each hop; parseWebsiteUrl does the same
      // scheme-prefixing this used to hand-roll.
      const parsed = parseWebsiteUrl(company.website)
      const fetched = parsed ? await fetchSafeHtml(parsed) : null
      if (fetched?.ok) {
        const html = fetched.html
        const patterns: [string, RegExp][] = [
          ['linkedin', /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/i],
          ['facebook', /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i],
          ['twitter', /href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s]+)["']/i],
          ['instagram', /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i],
        ]
        for (const [name, re] of patterns) {
          const m = re.exec(html)
          if (m) socialUrls[name] = m[1]
        }
      }
    } catch {
      // website unreachable
    }
  }

  const result = await analyzeSocialPresence(company.name, socialUrls)
  return NextResponse.json(result)
})
