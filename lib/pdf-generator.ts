import jsPDF from 'jspdf'
import { PAGE, PDF_COLORS, drawHeaderBand, drawFooterOnAllPages, checkPageBreak, type PdfCursor } from '@/lib/pdf-brand'

interface PdfOptions {
  title?: string
  eyebrow?: string
  filename?: string
  orientation?: 'portrait' | 'landscape'
  margins?: { top: number; right: number; bottom: number; left: number }
}

/**
 * Generic HTML-to-PDF export used wherever a caller only has an HTML string
 * (not structured data) — e.g. PdfDownloadButton, delivery-template exports.
 * Body content is still flattened to plain text (arbitrary HTML can't be
 * faithfully re-rendered without a much larger investment — a headless
 * browser/html2canvas pipeline this app doesn't currently depend on), but
 * every export now gets the same branded header/footer band as the rest of
 * the system's PDFs instead of being plain black-on-white with no
 * branding at all. For a fully bespoke, structured export (the audit
 * report), see lib/pdf-audit.ts instead.
 */
export function generatePdf(html: string, options: PdfOptions = {}): Blob {
  const { title, eyebrow, orientation = 'portrait' } = options
  // The branded header/footer bands (drawHeaderBand/drawFooterOnAllPages)
  // are portrait-dimensioned, matching every real caller today (no caller
  // in the app currently passes landscape). Landscape still produces a
  // valid PDF, just without the brand band, rather than drawing a
  // portrait-sized band onto a landscape page.
  const isPortrait = orientation === 'portrait'

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  const cursor: PdfCursor = {
    y: title
      ? (isPortrait ? drawHeaderBand(doc, { eyebrow, title, height: 38 }) : (() => {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(16)
          doc.setTextColor(...PDF_COLORS.ink)
          doc.text(title, PAGE.marginLeft, PAGE.marginLeft)
          return PAGE.marginLeft + 12
        })())
      : PAGE.marginLeft,
  }

  const pageWidth = isPortrait ? PAGE.width : PAGE.height
  const pageHeight = isPortrait ? PAGE.height : PAGE.width
  const maxWidth = pageWidth - PAGE.marginLeft - PAGE.marginRight

  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  - ')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<td[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, '->')
    .replace(/&copy;/g, '(c)')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...PDF_COLORS.ink)
  const lines = doc.splitTextToSize(stripped, maxWidth)
  const lineHeight = 4.5

  for (const line of lines) {
    checkPageBreak(doc, cursor, lineHeight, pageHeight)
    doc.text(line, PAGE.marginLeft, cursor.y)
    cursor.y += lineHeight
  }

  if (isPortrait) drawFooterOnAllPages(doc, { label: title })

  return doc.output('blob')
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
