import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai-client'
import { createServiceClient } from '@/lib/supabase'
import { getAuditSystemPrompt } from '@/lib/audit-template'
import { getGSCCoreWebVitals } from '@/lib/google-search-console'
import { withErrorHandler } from '@/lib/api-handler'
import type { AuditSectionResult, AuditType } from '@/lib/types'

async function fetchPageHtml(url: string): Promise<string> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GravHub-SEO-Audit/1.0' },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) return `[Could not fetch page: HTTP ${res.status}]`
    const html = await res.text()
    return html.slice(0, 30000)
  } catch {
    return '[Could not fetch page: request failed]'
  }
}

const AUDIT_SECTIONS: { key: string; label: string; prompt: string }[] = [
  {
    key: 'seo_onpage',
    label: 'On-Page SEO',
    prompt: `Analyze on-page SEO factors for this website. Evaluate:
- Title tags (length, keyword usage, uniqueness)
- Meta descriptions (length, relevance, call-to-action)
- Header hierarchy (H1-H6 usage and structure)
- Keyword density and placement
- Internal linking structure
- Image alt text optimization
- URL structure and readability
- Schema markup / structured data`,
  },
  {
    key: 'seo_technical',
    label: 'Technical SEO',
    prompt: `Analyze technical SEO factors for this website. Evaluate:
- Site speed and Core Web Vitals — use the REAL measured values provided below (Google PageSpeed Insights field data), do not estimate or guess these; if a value is null, PageSpeed data wasn't available for this URL, say so explicitly
- Mobile-friendliness and responsive design
- SSL/HTTPS implementation
- XML sitemap presence and quality
- Robots.txt configuration
- Canonical tags and duplicate content
- 404 error handling
- Crawlability and indexability
- JavaScript rendering concerns`,
  },
  {
    key: 'seo_offpage',
    label: 'Off-Page SEO & Authority',
    prompt: `Analyze off-page SEO and authority signals for this website. IMPORTANT: you have no backlink index or measured domain authority data — do not state a specific domain authority number or precise backlink count as if measured. Frame this section as qualitative signals visible in the HTML/content only, and explicitly say domain authority and backlink profile were not measured and would require a dedicated backlink tool. Evaluate:
- Trust signals visible in the page content (certifications, press mentions, testimonials)
- Qualitative backlink-worthiness of the content (would other sites plausibly link to this?)
- Local SEO presence (Google Business Profile, NAP consistency)
- Social media presence and signals
- Brand mentions and online reputation
- Directory listings and citations
- Content marketing / link-earning potential`,
  },
  {
    key: 'content_quality',
    label: 'Content Quality',
    prompt: `Analyze content quality for this website. Evaluate:
- Content relevance and value proposition clarity
- Writing quality (grammar, readability, tone)
- Content freshness and update frequency
- Unique value vs competitor content
- Blog / resource section quality
- Call-to-action effectiveness
- Content gaps and missing topics
- E-E-A-T signals (Experience, Expertise, Authoritativeness, Trustworthiness)`,
  },
  {
    key: 'ux_design',
    label: 'UX & Design',
    prompt: `Analyze user experience and design for this website. Evaluate:
- Visual design quality and brand consistency
- Navigation clarity and information architecture
- Page layout and content hierarchy
- Typography and readability
- Color contrast and accessibility basics
- Form usability and friction points
- Load experience and perceived performance
- Trust signals (testimonials, certifications, contact info)`,
  },
  {
    key: 'conversion',
    label: 'Conversion Optimization',
    prompt: `Analyze conversion optimization for this website. Evaluate:
- Call-to-action placement and clarity
- Lead capture forms and friction
- Value proposition clarity above the fold
- Social proof and trust elements
- Contact information accessibility
- Pricing transparency (if applicable)
- Landing page effectiveness
- Funnel flow and user journey`,
  },
  {
    key: 'performance',
    label: 'Performance & Security',
    prompt: `Analyze performance and security for this website. Evaluate:
- Expected page load speed
- Image optimization practices
- Code minification and asset optimization
- CDN usage expectations
- SSL certificate and HTTPS
- Security headers expectations
- Cookie consent and privacy compliance
- GDPR / CCPA readiness indicators`,
  },
  {
    key: 'mobile',
    label: 'Mobile Experience',
    prompt: `Analyze mobile experience for this website. Evaluate:
- Responsive design implementation
- Touch target sizes and spacing
- Mobile navigation (hamburger menu, usability)
- Mobile page speed expectations
- Mobile-specific content adjustments
- Viewport configuration
- Font sizes on mobile
- Mobile form usability`,
  },
]

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function parseSection(text: string, label: string): AuditSectionResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const score = Math.min(100, Math.max(0, Number(parsed.score) || 50))
      return {
        name: label,
        score,
        grade: scoreToGrade(score),
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      }
    }
  } catch { /* fall through */ }
  return { name: label, score: 50, grade: 'C', findings: ['Unable to fully analyze this section'], recommendations: ['Manual review recommended'] }
}

export const POST = withErrorHandler('ai/audit POST', async (req) => {
    const body = await req.json()
    const { url, auditType = 'full', companyId, companyName } = body as {
      url: string
      auditType?: AuditType
      companyId?: string
      companyName?: string
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const supabase = createServiceClient()

    await supabase.from('audits').insert({
      id: auditId,
      website_url: url,
      company_id: companyId || null,
      company_name: companyName || null,
      audit_type: auditType,
      status: 'running',
      sections: [],
    })

    const sectionsToRun = auditType === 'seo'
      ? AUDIT_SECTIONS.filter(s => s.key.startsWith('seo_'))
      : auditType === 'website'
        ? AUDIT_SECTIONS.filter(s => !s.key.startsWith('seo_'))
        : AUDIT_SECTIONS

    const pageHtml = await fetchPageHtml(url)

    // Real, measured performance data — feeds the technical SEO section so
    // it reports actual field data instead of the LLM guessing at "expected"
    // Core Web Vitals from HTML alone.
    const needsVitals = sectionsToRun.some(s => s.key === 'seo_technical')
    const vitals = needsVitals ? await getGSCCoreWebVitals(url) : null
    const vitalsBlock = vitals
      ? `\n\n--- REAL CORE WEB VITALS (Google PageSpeed Insights field data, mobile) ---\nLCP (Largest Contentful Paint): ${vitals.lcp != null ? `${vitals.lcp}ms` : 'not available'}\nFID/INP (First Input Delay / Interaction to Next Paint): ${vitals.fid != null ? `${vitals.fid}ms` : 'not available'}\nCLS (Cumulative Layout Shift): ${vitals.cls != null ? vitals.cls : 'not available'}\nOverall status: ${vitals.status}\n--- END CORE WEB VITALS ---`
      : ''

    const systemPrompt = getAuditSystemPrompt()

    const sectionResults: AuditSectionResult[] = []
    const MAX_RETRIES = 2

    for (const section of sectionsToRun) {
      let lastResult: Awaited<ReturnType<typeof chatCompletion>> | null = null
      const dataBlock = section.key === 'seo_technical' ? vitalsBlock : ''

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000))

        const result = await chatCompletion({
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `${section.prompt}\n\nWebsite URL: ${url}\n${companyName ? `Company: ${companyName}` : ''}\n\n--- PAGE HTML (first 30KB) ---\n${pageHtml}\n--- END HTML ---${dataBlock}\n\nAnalyze the actual HTML above. Provide your analysis as a JSON object with score (0-100), findings (array of strings), and recommendations (array of strings).`,
          }],
          maxTokens: 2048,
          timeoutMs: 45_000,
        })

        lastResult = result
        if (result.source !== 'none') break
      }

      if (!lastResult || lastResult.source === 'none') {
        sectionResults.push({
          name: section.label,
          score: 0,
          grade: 'F',
          findings: ['AI analysis could not be completed for this section'],
          recommendations: ['Please retry the audit or contact support'],
        })
        continue
      }

      sectionResults.push(parseSection(lastResult.text, section.label))
    }

    const totalScore = Math.round(sectionResults.reduce((sum, s) => sum + s.score, 0) / sectionResults.length)
    const overallGrade = scoreToGrade(totalScore)

    const summaryResult = await chatCompletion({
      system: 'You are a professional digital marketing consultant writing an executive summary for a client website audit report. Be clear, professional, and actionable. Respond with plain text only (no JSON, no markdown).',
      messages: [{
        role: 'user',
        content: `Write a 3-4 sentence executive summary for a website audit of ${url}${companyName ? ` (${companyName})` : ''}. Overall score: ${totalScore}/100 (Grade: ${overallGrade}). Section scores: ${sectionResults.map(s => `${s.name}: ${s.score}/100`).join(', ')}. Top recommendations: ${sectionResults.flatMap(s => s.recommendations).slice(0, 5).join('; ')}.`,
      }],
      maxTokens: 512,
      fast: true,
    })

    const summary = summaryResult.text || `This website scored ${totalScore}/100 overall. Review the detailed section results below for specific findings and recommendations.`

    const now = new Date().toISOString()
    await supabase.from('audits').update({
      status: 'completed',
      overall_score: totalScore,
      overall_grade: overallGrade,
      summary,
      sections: sectionResults,
      completed_at: now,
    }).eq('id', auditId)

    return NextResponse.json({
      id: auditId,
      websiteUrl: url,
      companyId: companyId || null,
      companyName: companyName || null,
      auditType,
      status: 'completed',
      overallScore: totalScore,
      overallGrade,
      summary,
      sections: sectionResults,
      createdAt: now,
      completedAt: now,
    })
})

export const GET = withErrorHandler('ai/audit GET', async (req) => {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
      const { data, error } = await supabase.from('audits').select('*').eq('id', id).single()
      if (error || !data) return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('audits')
      .select('id, website_url, company_name, audit_type, status, overall_score, overall_grade, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json(data ?? [])
})
