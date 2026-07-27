// Clones the ADCO gold-standard proposal layout (reference/template/ in the
// original Cowork kit) as a programmatic HTML/CSS builder. Renders via
// Chromium print-to-PDF (lib/proposal-render.ts), not WeasyPrint, so the
// original CSS Paged Media footer (@page margin boxes) is replaced by
// Playwright's headerTemplate/footerTemplate mechanism, and the cover's
// full-bleed background uses a negative-margin trick instead of a named
// @page — see buildFooterTemplate() and the .cover rule below.
import { readFileSync } from 'fs'
import path from 'path'

// AUDIT — brand-style.md flags a conflict: the ADCO gold-standard example
// used gold (#B98A3E), but house style calls for Terracotta going forward.
// Standardized here so every generated proposal is on-brand immediately.
const ACCENT = '#CC7853'
const GREEN = '#015035'
const CREAM = '#FFF3EA'
const CREAM_LINE = '#ece0d4'
const INK = '#1c2320'
const MUTED = '#5c6560'

// Physical page margins — must match the `margin` option passed to
// page.pdf() in lib/proposal-render.ts, since the cover's bleed relies on
// negating exactly this margin.
export const PAGE_MARGIN = { top: '20mm', right: '18mm', bottom: '18mm', left: '18mm' }

// US Letter (8.5in x 11in) — must match `format: 'Letter'` in
// lib/proposal-render.ts's page.pdf() call. The cover's height is set to
// this explicitly (block boxes don't auto-fill page height), so a mismatch
// here (e.g. an A4 value) makes the cover overflow onto a second page and
// silently drop whatever was absolutely-positioned near its bottom.
const PAGE_HEIGHT_MM = 279.4

const FONT_FILES: Record<string, string> = {
  'Syncopate-Regular': 'Syncopate-Regular.ttf',
  'Syncopate-Bold': 'Syncopate-Bold.ttf',
  'Montserrat': 'Montserrat.ttf',
  'Montserrat-Italic': 'Montserrat-Italic.ttf',
}

function fontDataUri(file: string): string {
  const buf = readFileSync(path.join(process.cwd(), 'lib/proposal-template/fonts', file))
  return `data:font/ttf;base64,${buf.toString('base64')}`
}

let cachedFontFaces: string | null = null

// Embeds the 4 brand fonts as base64 data URIs rather than file:// paths —
// the safe, portable choice for a serverless renderer with no guaranteed
// filesystem layout at request time.
function buildFontFaces(): string {
  if (cachedFontFaces) return cachedFontFaces
  cachedFontFaces = `
    @font-face { font-family: 'Syncopate'; src: url('${fontDataUri(FONT_FILES['Syncopate-Regular'])}') format('truetype'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'Syncopate'; src: url('${fontDataUri(FONT_FILES['Syncopate-Bold'])}') format('truetype'); font-weight: 700; font-style: normal; }
    @font-face { font-family: 'Montserrat'; src: url('${fontDataUri(FONT_FILES['Montserrat'])}') format('truetype'); font-weight: 100 900; font-style: normal; }
    @font-face { font-family: 'Montserrat'; src: url('${fontDataUri(FONT_FILES['Montserrat-Italic'])}') format('truetype'); font-weight: 100 900; font-style: italic; }
  `
  return cachedFontFaces
}

function buildCss(): string {
  return `
  ${buildFontFaces()}
  * { box-sizing: border-box; }
  body { font-family: 'Montserrat', sans-serif; color: ${INK}; font-size: 10pt; line-height: 1.55; margin: 0; }

  /* Cover bleeds full-page by negating the physical page margin (Chromium
     print-to-PDF has no per-page margin, unlike WeasyPrint's named @page). */
  .cover {
    background: ${GREEN}; color: ${CREAM};
    margin: -${PAGE_MARGIN.top} -${PAGE_MARGIN.right} -${PAGE_MARGIN.bottom} -${PAGE_MARGIN.left};
    padding: 26mm 22mm; height: ${PAGE_HEIGHT_MM}mm; box-sizing: border-box;
    position: relative; page-break-after: always;
  }
  .cover .brandmark { font-family: 'Syncopate'; font-weight: 700; font-size: 13pt; letter-spacing: 3px; color: ${CREAM}; }
  .cover .brandmark span { color: ${ACCENT}; }
  .cover .rule { height: 2px; width: 54px; background: ${ACCENT}; margin: 60mm 0 8mm 0; }
  .cover .kicker { font-weight: 600; letter-spacing: 4px; text-transform: uppercase; font-size: 8.5pt; color: rgba(255,243,234,0.72); }
  .cover h1 { font-family: 'Syncopate'; font-weight: 700; font-size: 27pt; line-height: 1.18; margin: 6mm 0 0 0; color: ${CREAM}; max-width: 150mm; }
  .cover .sub { font-size: 11pt; color: rgba(255,243,234,0.85); margin-top: 6mm; max-width: 130mm; }
  .cover .meta { position: absolute; left: 22mm; right: 22mm; bottom: 24mm; display: flex; justify-content: space-between; border-top: 1px solid rgba(255,243,234,0.28); padding-top: 6mm; }
  .cover .meta .block { font-size: 8.5pt; line-height: 1.7; }
  .cover .meta .label { text-transform: uppercase; letter-spacing: 2px; font-size: 7pt; color: ${ACCENT}; font-weight: 600; display: block; margin-bottom: 1.5mm; }

  .section { margin-bottom: 8mm; }
  h2.sec { font-family: 'Syncopate'; font-weight: 700; font-size: 12.5pt; color: ${GREEN}; letter-spacing: 0.5px; margin: 0 0 4mm 0; padding-bottom: 2.5mm; border-bottom: 2px solid ${CREAM_LINE}; }
  h2.sec .num { color: ${ACCENT}; font-size: 10.5pt; margin-right: 4mm; }
  h3.subsec { font-family: 'Montserrat'; font-weight: 700; font-size: 10pt; color: ${GREEN}; margin: 5mm 0 1.5mm 0; letter-spacing: 0.2px; }
  p { margin: 0 0 3mm 0; }
  .lead { font-size: 10.5pt; color: ${INK}; }
  strong { font-weight: 700; color: ${INK}; }
  .muted { color: ${MUTED}; }

  ul.clean { margin: 0 0 3mm 0; padding: 0; list-style: none; }
  ul.clean li { position: relative; padding-left: 6mm; margin-bottom: 1.8mm; }
  ul.clean li::before { content: "\\00B7"; color: ${ACCENT}; font-weight: 700; position: absolute; left: 1.5mm; top: -0.5mm; font-size: 13pt; }

  .callout { background: ${CREAM}; border-left: 3px solid ${ACCENT}; padding: 5mm 6mm; margin: 4mm 0; border-radius: 0 3px 3px 0; }
  .callout .tag { font-weight: 700; font-size: 7.5pt; letter-spacing: 2px; text-transform: uppercase; color: ${ACCENT}; display: block; margin-bottom: 1.5mm; }
  .callout p:last-child { margin-bottom: 0; }

  table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9pt; }
  .analysis th, .analysis td { text-align: left; padding: 3mm 3.5mm; vertical-align: top; border-bottom: 1px solid ${CREAM_LINE}; }
  .analysis thead th { font-weight: 700; font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; color: #fff; background: ${GREEN}; }
  .analysis td.dim { color: ${MUTED}; }
  .analysis td.win { color: ${GREEN}; font-weight: 600; }
  .analysis tr:last-child td { border-bottom: none; }
  .analysis .rowlabel { font-weight: 700; color: ${INK}; width: 34%; }

  .invest { display: flex; gap: 5mm; margin: 4mm 0 2mm 0; }
  .opt { flex: 1; border: 1px solid ${CREAM_LINE}; border-radius: 5px; padding: 6mm; position: relative; }
  .opt.reco { border: 2px solid ${GREEN}; background: #fbfaf7; }
  .opt .badge { position: absolute; top: -3mm; left: 6mm; background: ${ACCENT}; color: #fff; font-weight: 700; font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase; padding: 1.5mm 3mm; border-radius: 3px; }
  .opt .optname { font-family: 'Syncopate'; font-weight: 700; font-size: 9.5pt; color: ${GREEN}; margin: 2mm 0 1mm 0; line-height: 1.3; }
  .opt .price { font-family: 'Syncopate'; font-weight: 700; font-size: 20pt; color: ${INK}; margin: 2mm 0 0.5mm 0; }
  .opt .price small { font-family: 'Montserrat'; font-size: 8pt; font-weight: 600; color: ${MUTED}; }
  .opt .optdesc { font-size: 8.5pt; color: ${MUTED}; margin-top: 2mm; }

  .terms-grid { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .terms-grid td { padding: 2.5mm 3mm; border-bottom: 1px solid ${CREAM_LINE}; font-size: 9pt; vertical-align: top; }
  .terms-grid td.k { font-weight: 700; color: ${GREEN}; width: 32%; }

  .timeline th, .timeline td { padding: 2.8mm 3.5mm; border-bottom: 1px solid ${CREAM_LINE}; font-size: 9pt; text-align: left; vertical-align: top; }
  .timeline thead th { font-weight: 700; font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; color: ${GREEN}; border-bottom: 2px solid ${GREEN}; }
  .timeline td.phase { font-weight: 700; color: ${INK}; }
  .timeline td.wk { color: ${ACCENT}; font-weight: 700; white-space: nowrap; }

  .two-col { display: flex; gap: 8mm; }
  .two-col > div { flex: 1; }

  .signoff { margin-top: 8mm; padding-top: 5mm; border-top: 2px solid ${CREAM_LINE}; }
  .signoff .name { font-family: 'Syncopate'; font-weight: 700; font-size: 10pt; color: ${GREEN}; }
  .signoff .role { font-size: 8.5pt; color: ${MUTED}; margin-top: 1mm; }

  .avoid-break { break-inside: avoid; }
  `
}

// ── Draft data shape ─────────────────────────────────────────────────────

export interface ProposalOption {
  name: string
  priceLabel: string // e.g. "$6,000" — pre-formatted, currency is the AI's job upstream
  cadence: string // "one-time" | "monthly" etc.
  description: string
  recommended: boolean
}

export interface ProposalDraft {
  preparedForNames: string
  preparedForCompany: string
  preparedBy: string
  date: string
  validDays: number
  kicker: string
  headline: string
  subhead: string
  introParagraphs: [string, string]
  goals: { title: string; body: string }[]
  hasAnalysis: boolean
  analysisIntro: string
  analysisRows: { factor: string; recommended: string; alternative: string }[]
  recommendationNote: string
  services: { title: string; body: string }[]
  alternativeServicesTitle: string
  alternativeServices: string[]
  serviceNote: { tag: string; body: string } | null
  options: ProposalOption[]
  existingAgreementNote: string
  timelineNote: string
  timeline: { phase: string; focus: string; window: string; output: string }[]
  paymentStructure: string
  invoicing: string
  engagementType: string
  scopeChanges: string
  existingAgreementTerm: string
  ownershipNote: string
  clientResponsibilities: string[]
  providerResponsibilities: string[]
  closingNote: string
  footerRunningTitle: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function bulletList(items: { title?: string; body: string }[] | string[]): string {
  return `<ul class="clean">${items.map(item => {
    if (typeof item === 'string') return `<li>${esc(item)}</li>`
    return `<li>${item.title ? `<strong>${esc(item.title)}.</strong> ` : ''}${esc(item.body)}</li>`
  }).join('')}</ul>`
}

export function buildProposalHtml(d: ProposalDraft): string {
  const sections: string[] = []
  let n = 1
  const num = () => String(n++).padStart(2, '0')

  sections.push(`
    <div class="section">
      <h2 class="sec"><span class="num">${num()}</span>Introduction</h2>
      <p class="lead">${esc(d.introParagraphs[0])}</p>
      <p>${esc(d.introParagraphs[1])}</p>
    </div>`)

  sections.push(`
    <div class="section">
      <h2 class="sec"><span class="num">${num()}</span>Goals &amp; Objectives</h2>
      ${bulletList(d.goals)}
    </div>`)

  if (d.hasAnalysis) {
    sections.push(`
    <div class="section">
      <h2 class="sec"><span class="num">${num()}</span>Research &amp; Analysis</h2>
      <p>${esc(d.analysisIntro)}</p>
      <table class="analysis avoid-break">
        <thead><tr><th>Factor</th><th>Recommended</th><th>Alternative</th></tr></thead>
        <tbody>
          ${d.analysisRows.map(r => `<tr><td class="rowlabel">${esc(r.factor)}</td><td class="win">${esc(r.recommended)}</td><td class="dim">${esc(r.alternative)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="callout avoid-break"><span class="tag">Our Recommendation</span><p>${esc(d.recommendationNote)}</p></div>
    </div>`)
  }

  sections.push(`
    <div class="section">
      <h2 class="sec"><span class="num">${num()}</span>Proposed Services</h2>
      <h3 class="subsec">${d.options.find(o => o.recommended) ? esc(d.options.find(o => o.recommended)!.name) : 'Recommended Scope'}</h3>
      ${bulletList(d.services)}
      ${d.alternativeServices.length > 0 ? `
      <h3 class="subsec">${esc(d.alternativeServicesTitle)}</h3>
      ${bulletList(d.alternativeServices)}` : ''}
      ${d.serviceNote ? `<div class="callout avoid-break"><span class="tag">${esc(d.serviceNote.tag)}</span><p>${esc(d.serviceNote.body)}</p></div>` : ''}
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Investment Summary</h2>
      <div class="invest">
        ${d.options.map(o => `
        <div class="opt ${o.recommended ? 'reco' : ''}">
          ${o.recommended ? '<span class="badge">Recommended</span>' : ''}
          <div class="optname">${esc(o.name)}</div>
          <div class="price">${esc(o.priceLabel)}<small> ${esc(o.cadence)}</small></div>
          <div class="optdesc">${esc(o.description)}</div>
        </div>`).join('')}
      </div>
      ${d.existingAgreementNote ? `<p class="muted" style="font-size:8.5pt; margin-top:3mm;">${esc(d.existingAgreementNote)}</p>` : ''}
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Project Timeline</h2>
      <p class="muted" style="font-size:9pt;">${esc(d.timelineNote)}</p>
      <table class="timeline">
        <thead><tr><th style="width:8%;">Phase</th><th style="width:32%;">Focus</th><th style="width:16%;">Window</th><th>Key Output</th></tr></thead>
        <tbody>
          ${d.timeline.map((t, i) => `<tr><td class="phase">${i + 1}</td><td>${esc(t.focus)}</td><td class="wk">${esc(t.window)}</td><td>${esc(t.output)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Payment &amp; Commitment Terms</h2>
      <table class="terms-grid">
        <tr><td class="k">Payment structure</td><td>${esc(d.paymentStructure)}</td></tr>
        <tr><td class="k">Invoicing</td><td>${esc(d.invoicing)}</td></tr>
        <tr><td class="k">Engagement type</td><td>${esc(d.engagementType)}</td></tr>
        <tr><td class="k">Scope changes</td><td>${esc(d.scopeChanges)}</td></tr>
        <tr><td class="k">Existing agreement</td><td>${esc(d.existingAgreementTerm)}</td></tr>
      </table>
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Platform &amp; Ownership</h2>
      <p>${esc(d.ownershipNote)}</p>
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Responsibilities</h2>
      <div class="two-col">
        <div><h3 class="subsec">Client (${esc(d.preparedForCompany)})</h3>${bulletList(d.clientResponsibilities)}</div>
        <div><h3 class="subsec">Service Provider (Graviss Marketing)</h3>${bulletList(d.providerResponsibilities)}</div>
      </div>
    </div>`)

  sections.push(`
    <div class="section avoid-break">
      <h2 class="sec"><span class="num">${num()}</span>Next Steps</h2>
      <ul class="clean">
        <li>Select your option${d.options.length > 1 ? ` (${d.options.map(o => esc(o.name)).join(' or ')})` : ''}.</li>
        <li>Approve and sign this proposal.</li>
        <li>Submit payment per the terms above to reserve your project start date.</li>
        <li>Schedule the kickoff call.</li>
      </ul>
      <div class="signoff">
        <p style="margin-bottom:4mm;">${esc(d.closingNote)}</p>
        <div class="name">Jonathan P. Graviss</div>
        <div class="role">CEO &amp; Co-Founder, Graviss Marketing<br>jonathan@gravissmarketing.com</div>
      </div>
    </div>`)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${buildCss()}</style>
</head>
<body>
<div class="cover">
  <div class="brandmark">GRAVISS<span>.</span></div>
  <div class="rule"></div>
  <div class="kicker">${esc(d.kicker)}</div>
  <h1>${esc(d.headline)}</h1>
  <div class="sub">${esc(d.subhead)}</div>
  <div class="meta">
    <div class="block"><span class="label">Prepared For</span>${esc(d.preparedForNames)}<br>${esc(d.preparedForCompany)}</div>
    <div class="block"><span class="label">Prepared By</span>${esc(d.preparedBy)}<br>Graviss Marketing</div>
    <div class="block"><span class="label">Date</span>${esc(d.date)}<br>Valid ${d.validDays} days</div>
  </div>
</div>
${sections.join('\n')}
</body>
</html>`
}

// Playwright's footer is a fixed HTML fragment applied identically to every
// page — pageNumber/totalPages spans are Playwright's own placeholders, not
// CSS content, since Chromium print-to-PDF doesn't support @page margin
// boxes the way the original WeasyPrint-targeted template assumed.
export function buildFooterTemplate(runningTitle: string): string {
  return `
    <div style="width:100%; font-family: Arial, sans-serif; font-size: 7.5pt; color: #9aa39d; display:flex; justify-content:space-between; padding: 0 18mm;">
      <span>${esc(runningTitle)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`
}
