// Renders a proposal's assembled HTML (lib/proposal-template.ts) to PDF via
// headless Chromium. WeasyPrint was the original Cowork kit's target
// renderer (full CSS Paged Media support), but this app deploys on Vercel
// and WeasyPrint needs native system libs (Pango/Cairo) with no clean
// serverless path there — Playwright + @sparticuz/chromium is the standard
// pattern for PDF generation on Vercel instead.
import { readdirSync } from 'fs'
import path from 'path'
import type { Browser } from 'playwright-core'
import { PAGE_MARGIN } from '@/lib/proposal-template'

function localChromiumPath(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (!base) return undefined
  try {
    const dir = readdirSync(base).find(d => d.startsWith('chromium-'))
    return dir ? path.join(base, dir, 'chrome-linux', 'chrome') : undefined
  } catch {
    return undefined
  }
}

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright-core')
  // Vercel (and most serverless hosts) set VERCEL=1 — @sparticuz/chromium
  // bundles a Lambda/Vercel-compatible Chromium binary + required launch
  // args. Locally (this sandbox, or a dev machine with Playwright's own
  // browsers installed) we use the pre-installed/downloaded browser instead.
  if (process.env.VERCEL) {
    const chromiumPkg = (await import('@sparticuz/chromium')).default
    return chromium.launch({
      args: chromiumPkg.args,
      executablePath: await chromiumPkg.executablePath(),
      headless: true,
    })
  }
  return chromium.launch({ headless: true, executablePath: localChromiumPath() })
}

export async function renderProposalPdf(html: string, footerTemplate: string): Promise<Buffer> {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: PAGE_MARGIN,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
    })
    return pdf
  } finally {
    await browser.close()
  }
}
