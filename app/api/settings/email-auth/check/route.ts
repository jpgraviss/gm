import { NextResponse } from 'next/server'
import { resolveTxt, resolveCname } from 'node:dns/promises'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { getSettings } from '@/lib/settings'

function extractDomain(website: string): string {
  return website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
}

async function hasSpfRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveTxt(domain)
    return records.some(r => r.join('').toLowerCase().startsWith('v=spf1'))
  } catch {
    return false
  }
}

async function hasDmarcRecord(domain: string): Promise<boolean> {
  try {
    const records = await resolveTxt(`_dmarc.${domain}`)
    return records.some(r => r.join('').toLowerCase().startsWith('v=dmarc1'))
  } catch {
    return false
  }
}

// Resend issues 3 CNAME records (resend._domainkey, resend2._domainkey,
// resend3._domainkey) once a sending domain is verified — any one
// resolving to a resend.com target confirms DKIM is set up.
async function hasDkimRecord(domain: string): Promise<boolean> {
  const hosts = ['resend._domainkey', 'resend2._domainkey', 'resend3._domainkey']
  for (const host of hosts) {
    try {
      const records = await resolveCname(`${host}.${domain}`)
      if (records.some(r => r.toLowerCase().includes('resend.com'))) return true
    } catch {
      // try the next host
    }
  }
  return false
}

/** Real DNS lookups for the Email Domain Authentication settings page —
 *  previously this page's "configured" indicators were hardcoded false. */
export const GET = withErrorHandler('settings/email-auth/check GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const settings = await getSettings()
  const domain = extractDomain(settings.company.website)
  if (!domain) {
    return NextResponse.json({ domain: '', spf: false, dkim: false, dmarc: false })
  }

  const [spf, dkim, dmarc] = await Promise.all([
    hasSpfRecord(domain),
    hasDkimRecord(domain),
    hasDmarcRecord(domain),
  ])

  return NextResponse.json({ domain, spf, dkim, dmarc })
})
