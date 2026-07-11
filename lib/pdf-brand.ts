/**
 * Shared branded jsPDF drawing helpers. Extracted from the (already
 * well-designed) proposal PDF in components/crm/ProposalBuilderPanel.tsx so
 * every PDF the system generates — audit reports, delivery-template
 * exports, and anything routed through lib/pdf-generator.ts — gets the
 * same dark-green-header / accent-circle / green-section-bar house style
 * instead of each generator inventing its own look (or, in most cases
 * before this, no styling at all).
 *
 * jsPDF's built-in fonts don't include Syncopate/Montserrat (would require
 * embedding font files as base64), so PDFs use Helvetica — the same
 * constraint the proposal PDF already works within.
 */

import type jsPDF from 'jspdf'
import { BRAND_COLORS, BRAND_NAME, gradeColorHex } from '@/lib/brand'

export type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export const PDF_COLORS = {
  dark: hexToRgb(BRAND_COLORS.darkBg),
  primary: hexToRgb(BRAND_COLORS.primary),
  accent: hexToRgb(BRAND_COLORS.accent),
  cream: hexToRgb(BRAND_COLORS.secondary),
  ink: hexToRgb(BRAND_COLORS.ink),
  stone: hexToRgb(BRAND_COLORS.stone),
  white: [255, 255, 255] as RGB,
  gray: [107, 114, 128] as RGB,
  lightGray: [249, 250, 251] as RGB,
  border: [229, 231, 235] as RGB,
  paleGreen: [240, 253, 244] as RGB,
}

export const PAGE = {
  width: 210,
  height: 297,
  marginLeft: 18,
  marginRight: 18,
  contentWidth: 210 - 18 - 18,
}

export function gradeColorRgb(grade: string): RGB {
  return hexToRgb(gradeColorHex(grade))
}

/** Mutable cursor so callers can thread vertical position through helpers. */
export interface PdfCursor {
  y: number
}

export function checkPageBreak(pdf: jsPDF, cursor: PdfCursor, needed: number, pageHeight: number = PAGE.height): void {
  if (cursor.y + needed > pageHeight - 20) {
    pdf.addPage()
    cursor.y = 20
  }
}

/**
 * Dark green header band with the wordmark, an eyebrow label, and a title —
 * matches the proposal PDF's cover treatment. Returns the y position just
 * below the band so the caller can continue drawing.
 */
export function drawHeaderBand(
  pdf: jsPDF,
  opts: { eyebrow?: string; title: string; subtitle?: string; height?: number },
): number {
  const { eyebrow, title, subtitle, height = 46 } = opts
  const { width, marginLeft } = PAGE

  pdf.setFillColor(...PDF_COLORS.dark)
  pdf.rect(0, 0, width, height, 'F')

  // Decorative circles, same motif as the proposal PDF cover
  pdf.setDrawColor(255, 255, 255)
  pdf.setLineWidth(0.3)
  pdf.circle(width - 8, 6, 22, 'S')
  pdf.circle(width - 2, 2, 14, 'S')

  let y = 12
  pdf.setTextColor(...PDF_COLORS.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text(BRAND_NAME.company.split(' ')[0].toUpperCase(), marginLeft, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  pdf.setTextColor(160, 160, 160)
  pdf.text(BRAND_NAME.company.split(' ').slice(1).join(' ').toUpperCase() || 'MARKETING', marginLeft, y + 4)

  y += 12
  if (eyebrow) {
    pdf.setTextColor(...PDF_COLORS.accent)
    pdf.setFontSize(7.5)
    pdf.setFont('helvetica', 'bold')
    pdf.text(eyebrow.toUpperCase(), marginLeft, y)
    y += 7
  }

  pdf.setTextColor(...PDF_COLORS.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(title, marginLeft, y)

  if (subtitle) {
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(200, 200, 200)
    pdf.text(subtitle, marginLeft, y)
  }

  return height + 10
}

/** Green accent bar + uppercase label + hairline divider, matching the proposal PDF. */
export function drawSectionTitle(pdf: jsPDF, cursor: PdfCursor, title: string): void {
  checkPageBreak(pdf, cursor, 18)
  const { marginLeft, width, marginRight } = PAGE
  pdf.setFillColor(...PDF_COLORS.primary)
  pdf.rect(marginLeft, cursor.y - 4, 2, 11, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(...PDF_COLORS.ink)
  pdf.text(title.toUpperCase(), marginLeft + 6, cursor.y + 3)
  pdf.setDrawColor(...PDF_COLORS.border)
  pdf.setLineWidth(0.3)
  pdf.line(marginLeft + 6, cursor.y + 5, width - marginRight, cursor.y + 5)
  cursor.y += 13
}

/** Light footer band with company name + generated-on date, repeated per page. */
export function drawFooterBand(pdf: jsPDF, opts: { label?: string } = {}): void {
  const { width, height } = { width: PAGE.width, height: PAGE.height }
  const bandY = height - 14
  pdf.setFillColor(...PDF_COLORS.dark)
  pdf.rect(0, bandY, width, 14, 'F')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor(180, 180, 180)
  pdf.text(BRAND_NAME.company, PAGE.marginLeft, bandY + 9)
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  pdf.text(opts.label ? `${opts.label} · ${dateStr}` : dateStr, width - PAGE.marginRight, bandY + 9, { align: 'right' })
}

/** Adds the footer band to every page currently in the document. */
export function drawFooterOnAllPages(pdf: jsPDF, opts: { label?: string } = {}): void {
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    drawFooterBand(pdf, opts)
  }
}

/** Small filled circle with a centered score number, colored by letter grade. */
export function drawScoreBadge(pdf: jsPDF, x: number, y: number, radius: number, score: number, grade: string): void {
  const color = gradeColorRgb(grade)
  pdf.setFillColor(...color)
  pdf.circle(x, y, radius, 'F')
  pdf.setTextColor(...PDF_COLORS.white)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(radius * 0.9)
  pdf.text(String(score), x, y + radius * 0.32, { align: 'center' })
}

/** Pale rounded card, used for findings/recommendations/summary blocks. */
export function drawInfoCard(
  pdf: jsPDF,
  cursor: PdfCursor,
  opts: { fill?: RGB; borderColor?: RGB; height: number },
): void {
  const { marginLeft, width, marginRight } = PAGE
  const cardWidth = width - marginLeft - marginRight
  pdf.setFillColor(...(opts.fill ?? PDF_COLORS.lightGray))
  pdf.roundedRect(marginLeft, cursor.y, cardWidth, opts.height, 2, 2, 'F')
  if (opts.borderColor) {
    pdf.setDrawColor(...opts.borderColor)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(marginLeft, cursor.y, cardWidth, opts.height, 2, 2, 'S')
  }
}
